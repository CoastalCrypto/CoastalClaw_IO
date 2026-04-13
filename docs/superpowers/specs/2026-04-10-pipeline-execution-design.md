# Pipeline Execution — Live View & Interaction

**Date:** 2026-04-10
**Status:** Approved

---

## Problem

Clicking "Run Pipeline" currently produces no feedback. The request hangs until the full pipeline completes, then dumps a static result. Users cannot see what agents are doing, cannot intervene mid-run, and cannot save or reuse pipeline configurations.

---

## Decisions Made

| Decision | Choice |
|----------|--------|
| Execution view layout | Chat-style — each stage as a live thread |
| Intervention model | Live steering — type any time, injected on agent's next loop |
| Transport | Async run + SSE stream (Approach B) |
| Stage limit | None — unlimited stages, timeline scrolls horizontally |
| Loop support | Both loop-back arrows (within-run) + Ralph Loop stage (recurring) |
| Saving | Library panel in builder + SQLite pipeline store |

---

## Architecture

### Async Execution Flow

```
User clicks Run
  → POST /api/pipeline/run  →  { runId }  (immediate)
  → Frontend navigates to /pipeline/run/:runId
  → GET /api/pipeline/run/:runId/events  (SSE subscription)
  → Pipeline runs in background, emits events keyed by runId
  → User types in steer bar
  → POST /api/pipeline/run/:runId/steer  →  queued message
  → AgenticLoop reads queue after each tool call, injects as user message
```

### SSE Event Types

| Event | Payload |
|-------|---------|
| `pipeline_start` | `{ runId, pipelineId, stageCount }` |
| `stage_start` | `{ stageIdx, agentId, agentName, iteration }` |
| `tool_call_start` | `{ stageIdx, toolName, args }` |
| `tool_call_end` | `{ stageIdx, toolName, result, durationMs }` |
| `stage_steer` | `{ stageIdx, message }` — echoed when steering message is injected |
| `loop_iteration` | `{ stageIdx, iteration, condition }` — emitted when a loop-back fires |
| `stage_end` | `{ stageIdx, output, durationMs }` |
| `pipeline_done` | `{ runId, totalDurationMs, finalOutput }` |
| `pipeline_error` | `{ stageIdx, error }` |

---

## Components

### 1. Pipeline Store (backend — new)

SQLite table `pipelines`:

```sql
CREATE TABLE pipelines (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  stages      TEXT NOT NULL DEFAULT '[]',  -- JSON array of stage configs
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
)
```

Stage config schema:
```ts
interface StageConfig {
  agentId: string
  type: 'agent' | 'ralph-loop'        // ralph-loop = recurring trigger stage
  loopBack?: { toStageIdx: number; condition: string; maxIterations: number }
  ralphLoop?: { cron?: string; condition?: string }
}
```

Endpoints: `GET/POST /api/admin/pipelines`, `GET/PATCH/DELETE /api/admin/pipelines/:id`

### 2. Async Pipeline Runner (backend — modify existing)

- `POST /api/pipeline/run` returns `{ runId }` immediately
- Background task executes stages, emitting SSE events per runId
- Maintains a `steerQueue: Map<runId, string[]>` — steer endpoint pushes here, AgenticLoop drains after each tool call
- Loop-back: after `stage_end`, checks `loopBack.condition` against output; if truthy and `iteration < maxIterations`, rewinds stage pointer and emits `loop_iteration`
- Ralph Loop stage: on pipeline save, registers a cron job (reuses `CronScheduler`) or condition watcher that re-POSTs `/api/pipeline/run` with the saved pipeline's stages

### 3. SSE Stream Endpoint (backend — new)

`GET /api/pipeline/run/:runId/events`
Filters the existing EventBus stream to events tagged with `runId`. Sends `text/event-stream`. Closes when `pipeline_done` or `pipeline_error` fires.

### 4. Steer Endpoint (backend — new)

`POST /api/pipeline/run/:runId/steer`
Body: `{ message: string }`
Pushes to `steerQueue[runId]`. Returns `204`. AgenticLoop checks queue after every tool call completion and injects queued messages as user-turn messages before the next LLM call.

### 5. Pipeline Run Page (frontend — new)

Route: `/pipeline/run/:runId`

**Layout (top to bottom):**
- **Header** — pipeline name, live status badge, Abort button
- **Timeline** — scrollable horizontal stage dots (done ✓ / active pulse / waiting ○), loop-back arrows shown as curved lines between dots, loop iteration counter (`×2`, `×3`)
- **Stage threads** — scrollable list; done stages collapsed, active stage expanded showing live tool calls; steering messages appear inline in amber; loop stages show iteration header
- **Steer bar** — always shows active stage name, free-text input, Send button

**Hooks:**
- `usePipelineRun(runId)` — subscribes to SSE, builds state from events, exposes `{ stages, status, steer(msg) }`

### 6. Builder Updates (frontend — modify existing)

- **Name field** at top of builder form
- **Save button** → `POST /api/admin/pipelines`
- **Library panel** (collapsible left sidebar) — lists saved pipelines, click to load into builder
- **Loop-back control** — "↩ Loop" button on each stage opens a popover: target stage selector, condition text field, max iterations number input
- **Ralph Loop stage type** — selectable stage type alongside agent stages; config: cron expression OR condition string

---

## UI Design Reference

Design system: Coastal.AI dark console aesthetic.

- Backgrounds: `#0A0F1C` page, `rgba(26,39,68,0.80)` panels
- Borders: `1px solid rgba(0,212,255,0.15)` default, `rgba(0,212,255,0.30)` active
- Accent: `#00D4FF` cyan
- Status: `#00e676` done, `#ffb300` steering/warning, `#ff5252` abort/error
- Fonts: Space Grotesk (headings/labels), JetBrains Mono (tool calls/badges), Inter (body)
- Border radius: 12px panels, 8px inputs/buttons

Approved mockup: `.superpowers/brainstorm/9374-1775866294/pipeline-run-v2.html`

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `packages/core/src/pipeline/store.ts` | New — SQLite pipeline CRUD |
| `packages/core/src/pipeline/runner.ts` | Modify — async background execution + event emission |
| `packages/core/src/pipeline/steer-queue.ts` | New — in-memory steer message queue |
| `packages/core/src/api/routes/pipeline.ts` | Modify — add async run, SSE stream, steer, pipeline CRUD |
| `packages/core/src/server.ts` | Modify — wire up pipeline store + steer queue |
| `packages/web/src/pages/PipelineRun.tsx` | New — live execution view |
| `packages/web/src/pages/Pipeline.tsx` | Modify — name field, save, library panel, loop controls, Ralph Loop stage |
| `packages/web/src/hooks/usePipelineRun.ts` | New — SSE subscription hook |

---

## Out of Scope

- Branching (stage forks / parallel stage execution) — future phase
- Pipeline versioning / history — future phase
- Shared/published pipelines — future phase
