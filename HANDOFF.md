# CoastalClaw — Agent Handoff Document

> Hand this file to a new Claude agent to continue development exactly where we left off.

---

## What We're Building

**CoastalClaw** is an AI-powered executive OS for **Coastal Crypto**, a crypto mining company. It gives the leadership team a single chat interface backed by autonomous AI agents — each scoped to a business domain (COO, CFO, CTO, General). Agents can use real tools: read files, run shell commands, query databases, call git, fetch web pages, and ask for human approval before irreversible actions.

**Repo:** `https://github.com/CoastalCrypto/CoastalClaw_IO.git` (branch: `master`)

**Stack:** Node 22 ESM, TypeScript, Fastify, WebSocket, better-sqlite3, Ollama (local LLM), React + Tailwind v4, pnpm monorepo (`packages/core` + `packages/web`).

**Constraint:** Local-only stack — no cloud APIs, no rate limiting on `/api/chat`. All inference via Ollama / vLLM / AirLLM.

---

## Current State (as of 2026-04-10, commit `6d1a4d9`)

### What's been shipped

| Version | What shipped |
|---------|-------------|
| Foundation | CascadeRouter, LosslessMemory, model quant pipeline, web portal |
| v1.0.0 | APT repo, SSE streaming, signed packages, security audit |
| v1.1.0 | Live dashboard, analytics, custom tool builder, output channels, multi-user auth |
| v1.2.0 | Skills library, cron scheduler, agent voice, version update banner, Electron auto-updater |
| **v1.3.0** | Pipeline builder — save/load pipelines, live SSE execution view, live steering, loop-back stages |

### v1.3.0 Pipeline Files (just merged)

| File | What it does |
|------|-------------|
| `packages/core/src/events/types.ts` | 7 pipeline SSE event types added |
| `packages/core/src/pipeline/steer-queue.ts` | In-memory steer message queue per runId |
| `packages/core/src/pipeline/store.ts` | SQLite CRUD for saved pipeline definitions |
| `packages/core/src/pipeline/runner.ts` | Async background runner, loop-back, event emission |
| `packages/core/src/agents/loop.ts` | Drains steer queue between tool calls |
| `packages/core/src/api/routes/pipeline.ts` | Async run, SSE stream, steer, CRUD endpoints |
| `packages/core/src/server.ts` | Wires PipelineStore + SteerQueue + Runner |
| `packages/web/src/hooks/usePipelineRun.ts` | SSE subscription hook — builds stage state from events |
| `packages/web/src/pages/PipelineRun.tsx` | Live execution view (timeline, stage threads, steer bar) |
| `packages/web/src/pages/Pipeline.tsx` | Save, library panel, loop-back controls, async run |

### Pipeline API endpoints

```
POST   /api/pipeline/run/async            { stages, input } → { runId }
GET    /api/pipeline/run/:runId           → { status, stageIdx }
GET    /api/pipeline/run/:runId/events    SSE stream
POST   /api/pipeline/run/:runId/steer     { message } → 204
DELETE /api/pipeline/run/:runId           abort

GET    /api/admin/pipelines               → [pipeline]
POST   /api/admin/pipelines               { name, stages } → pipeline
PATCH  /api/admin/pipelines/:id
DELETE /api/admin/pipelines/:id
```

### SSE event flow

`pipeline_start` → `stage_start` → `tool_call_start` → `tool_call_end` → `stage_end` → `pipeline_done` | `pipeline_error`

Steer messages: `POST /api/pipeline/run/:runId/steer` → echoed as `stage_steer` event.

---

## Architecture Quick Reference

### Frontend (`packages/web/src/`)

- **Router:** `App.tsx` — single-page app, nav via `setPage` state (no URL routing)
- **Pages (12):** Chat, Dashboard, Analytics, Agents, Pipeline, PipelineRun, Models, Tools, Skills, Channels, Settings, Users, System, Login, Onboarding, ChangePassword
- **Hooks:** `useEventStream` (SSE /api/events), `usePipelineRun` (SSE per runId), `useIsMobile`
- **Design tokens:** `index.css` — CSS custom properties, utility classes (`.glass-panel`, `.btn-primary`, `.badge-*`, `.card-hover`). Fonts: Space Grotesk / Inter / JetBrains Mono. Accent: `#00D4FF`.
- **Auth:** Session token in `sessionStorage` as `cc_admin_session`. `AuthContext` provides `currentUser`.

### Backend (`packages/core/src/`)

- **Server:** Fastify port 4747, better-sqlite3
- **Key services:** AgenticLoop, EventBus (200-event ring), AsyncPipelineRunner, SteerQueue, PipelineStore, ModelRouter, UnifiedMemory, PersonaManager, ChannelManager, CronScheduler

### Key type interfaces

```typescript
interface LoopResult { reply, actions: ActionSummary[], domain, status: 'complete'|'error'|'interrupted', error? }
interface ActionSummary { tool, args, output, decision: GateDecision, durationMs }
type GateDecision = 'allow'|'block'|'queued'|'approved'|'denied'|'timeout'
interface RunStage { agentId, modelPref?, type?, loopBack?: { toStageIdx, condition, maxIterations } }
interface ActiveRun { runId, status: 'running'|'done'|'error'|'aborted', stageIdx, abort(), startedAt }
```

---

## Active Improvement Backlog

This is the work to do next, in priority order. Do not skip ahead.

### HIGH PRIORITY

#### 1. Shared UI component library
**Why:** Every page re-defines `INPUT_STYLE`, `BTN_CYAN`, `PANEL` inline — 10+ files with duplicated magic hex values and font strings. Any design change requires grep-and-replace across the whole codebase.

**Files to create:**
- `packages/web/src/styles/tokens.ts` — export `PANEL`, `BTN_CYAN`, `INPUT_STYLE`, `MONO`, `BTN_RED` as shared constants
- `packages/web/src/components/ui/Input.tsx` — styled `<input>` with consistent focus ring
- `packages/web/src/components/ui/Textarea.tsx`
- `packages/web/src/components/ui/Select.tsx`
- `packages/web/src/components/ui/Button.tsx` — variants: primary, secondary, danger, ghost
- `packages/web/src/components/ui/Modal.tsx` — portal-based, keyboard-dismissible, focus-trapped

**Then replace** the inline styles in: Login.tsx, Settings.tsx, Tools.tsx, Users.tsx, Pipeline.tsx, PipelineRun.tsx, Agents.tsx (CredentialsPanel, BindingsPanel).

#### 2. Empty states on all list pages
**Why:** Agents, Skills, Tools, Channels, Pipeline library, Dashboard event feed all show a blank area when empty — no guidance, no call to action.

Each should show: icon + description of what the section does + primary action button ("+ Create your first agent", etc.).

**Files to modify:** Agents.tsx, Skills.tsx, Tools.tsx, Channels.tsx, Pipeline.tsx (library panel), Dashboard.tsx (event feed).

#### 3. Chat typing indicator + timeout feedback
**Why:** Between sending a message and the first token arriving, the UI freezes with no feedback. The 90s timeout (`ChatPane.tsx:74`) gives no indication of progress.

**Changes:**
- Add a pulsing "..." assistant bubble that appears immediately when a message is sent, removed when first token arrives
- After 3s with no token, update the send button to show elapsed time: `Thinking… (4s)`
- Animate the dots using the existing `blink` keyframe in `index.css`

**File:** `packages/web/src/components/ChatPane.tsx`

#### 4. Pipeline: warn before navigating away from active run
**Why:** Clicking a NavBar link during an active run silently abandons it with no warning.

**Change:** When `usePipelineRun` state is `running`, have the Pipeline page intercept NavBar's `onNav` prop and show a confirm dialog before allowing navigation.

**Files:** `packages/web/src/pages/Pipeline.tsx`, `packages/web/src/pages/PipelineRun.tsx`

#### 5. Pipeline run history
**Why:** Once you navigate away from a completed run it's gone forever. Users want to review past results.

**Backend:** Add `pipeline_runs` SQLite table (runId, pipelineId, pipelineName, status, totalDurationMs, finalOutput, startedAt). Runner writes a row on `pipeline_done` and `pipeline_error`. Add `GET /api/admin/pipeline-runs` endpoint (last 20 rows).

**Frontend:** Collapsible "Recent Runs" section on the Pipeline builder page. Each row: pipeline name, status badge, duration, timestamp. Click navigates to PipelineRun with that runId (the SSE stream closes but the status endpoint still returns final state).

**Files:** `packages/core/src/pipeline/store.ts` (add run history), `packages/core/src/pipeline/runner.ts`, `packages/core/src/api/routes/pipeline.ts`, `packages/web/src/pages/Pipeline.tsx`

#### 6. Credential values as password fields with eye toggle
**Why:** In `Agents.tsx` `CredentialsPanel`, agent API keys and tokens are rendered as plain text inputs — fully visible to anyone looking at the screen.

**Change:** Render value inputs as `type="password"`. Add an eye icon (👁) button that toggles visibility per field.

**File:** `packages/web/src/pages/Agents.tsx` (CredentialsPanel component)

#### 7. EventSource cleanup on pipeline unmount
**Why:** `usePipelineRun.ts` opens an EventSource but the `useEffect` cleanup doesn't close it. If the user navigates away before the pipeline completes, the browser keeps the connection alive.

**Change:** Store the EventSource in a ref and call `.close()` in the `useEffect` return function.

**File:** `packages/web/src/hooks/usePipelineRun.ts`

#### 8. Thinking animation in PipelineRun stage threads
**Why:** The `StageThread` component renders `● ● ● thinking` as static text. The `blink` animation keyframe already exists in `index.css` but isn't applied.

**Change:** Replace the static span with three individually animated dots using `animation: blink 1.2s infinite step-end` and staggered `animation-delay` (0s, 0.3s, 0.6s).

**File:** `packages/web/src/pages/PipelineRun.tsx` (StageThread function, bottom of expanded body)

#### 9. React error boundary at app root
**Why:** Any unhandled JS exception currently shows a blank white screen. Users don't know if the app crashed or is loading.

**Change:** Create `packages/web/src/components/ErrorBoundary.tsx` (class component with `componentDidCatch`). Wrap the main `<App />` render in `index.tsx` with it. Show a friendly "Something went wrong — reload the page" UI with the error message in a collapsed `<details>`.

### MEDIUM PRIORITY (tackle after high-priority items)

#### 10. Dashboard: expandable tool call events
Tool call events in the feed should expand in-place on click to show full args and result JSON.

#### 11. Chat: message retry button
Hovering the last assistant message shows a "↺ Retry" button that re-sends the previous user message.

#### 12. Chat: file drag-and-drop zone
Add a drag-and-drop overlay (dashed cyan border on dragover) over the chat input area, in addition to the existing paperclip button.

#### 13. Models page: Ollama pull progress bar
`step` and `total` are in the WebSocket progress event. Render a `<progress>` bar instead of text-only.

### LOW PRIORITY (separate pass)

#### 14. Breadcrumb for sub-views — `Pipeline › Live Run abc123`
#### 15. ARIA labels on icon-only buttons — ↑ ↓ ✕ ▸ ▾
#### 16. Contrast fix — bump inactive/waiting labels from `rgba(255,255,255,0.25)` to `rgba(255,255,255,0.45)`

---

## Known Issues

| Issue | Location | Status |
|-------|----------|--------|
| `tests/api/admin.test.ts` — 9 failures | `packages/core` | Pre-existing Windows EPERM on temp dir cleanup. Not related to pipeline work. Do not fix during UI pass. |

---

## Design Reference

- Pipeline mockup: `.superpowers/brainstorm/9374-1775866294/pipeline-run-v2.html`
- Pipeline spec: `docs/superpowers/specs/2026-04-10-pipeline-execution-design.md`
- Design system: `packages/web/src/index.css`
- Color palette: `#0A0F1C` page bg, `rgba(26,39,68,0.80)` panels, `#00D4FF` cyan accent, `#00e676` success, `#ffb300` warning, `#ff5252` error

---

## Running the Project

```bash
pnpm install
pnpm dev                          # core (:4747) + web (:5173)
cd packages/core && pnpm test     # run tests
pnpm vitest run src/pipeline      # pipeline tests only
pnpm build                        # core build
cd packages/web && pnpm build     # web build
```
