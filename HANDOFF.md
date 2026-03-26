# CoastalClaw — Agent Handoff Document

> Hand this file to a new Claude agent to continue development exactly where we left off.

---

## What We're Building

**CoastalClaw** is an AI-powered executive OS for **Coastal Crypto**, a crypto mining company. It gives the leadership team a single chat interface backed by autonomous AI agents — each scoped to a business domain (COO, CFO, CTO, General). Agents can use real tools: read files, run shell commands, query databases, call git, fetch web pages, and ask for human approval before irreversible actions.

**Repo:** `https://github.com/CoastalCrypto/CoastalClaw_IO.git` (branch: `master`)

**Stack:** Node 22 ESM, TypeScript, Fastify, WebSocket, better-sqlite3, Ollama (local LLM), React + Tailwind v4, pnpm monorepo (`packages/core` + `packages/web`).

---

## Key Design Documents

| Document | Purpose |
|---|---|
| `docs/superpowers/specs/2026-03-26-agentic-tool-use-design.md` | Full architecture spec for the agentic layer |
| `docs/superpowers/plans/2026-03-26-agentic-tool-use.md` | Detailed implementation plan (16 tasks, 3 chunks) |

**Read both before touching anything.**

---

## Current State — What's Done

Tasks 1–10 of the 16-task plan are complete. Build is green. 113 tests passing (2 pre-existing skips). All code is on `master`.

### Completed Files

```
packages/core/src/
  agents/
    types.ts             ✅ ToolDefinition, ToolCall, ToolResult, GateDecision, AgentConfig, LoopResult, ActionSummary
    registry.ts          ✅ AgentRegistry (SQLite, 4 built-in agents: coo/cfo/cto/general)
    session.ts           ✅ AgentSession (soul loading + caching, system prompt assembly, tool schemas)
    loop.ts              ✅ AgenticLoop (LLM↔tool iteration, parallel reads, sequential writes, gate, approval)
    permission-gate.ts   ✅ PermissionGate (allow/block/queue decisions, always-allow DB table, approval promises)
    action-log.ts        ✅ ActionLog (SQLite audit trail, result truncated at 2000 chars for display)
    souls/
      SOUL_COO.md        ✅ Built-in COO identity
      SOUL_CFO.md        ✅ Built-in CFO identity (Crypto Operations section)
      SOUL_CTO.md        ✅ Built-in CTO identity (Mining Operations section)
      SOUL_GENERAL.md    ✅ General assistant fallback
  tools/
    registry.ts          ✅ ToolRegistry (name → CoreTool map, isReversible, parallel/sequential classification)
    core/
      file.ts            ✅ read_file, write_file, list_dir, delete_file
      shell.ts           ✅ run_command (sandboxed to CC_AGENT_WORKDIR)
      git.ts             ✅ git_status, git_diff, git_log, git_commit
      sqlite.ts          ✅ query_db (read/write modes)
      web.ts             ✅ http_get (10s timeout, 4000 char cap)
  models/
    ollama.ts            ✅ chatWithTools() added; LocalChatMessage (simple 3-role) vs ChatMessage (full 4-role)
    router.ts            ✅ ollama + cascade now public (needed for Task 11)
  config.ts              ✅ agentWorkdir, soulMaxTokens, agentMaxTurns, toolResultMaxChars, approvalTimeoutMs, defaultModel
```

### Key Type Interfaces (memorize these)

```typescript
// types.ts
interface ToolDefinition { name, description, parameters: { type:'object', properties, required? }, reversible: boolean }
interface ToolCall { id: string, name: string, args: Record<string, unknown> }
type GateDecision = 'allow' | 'block' | 'queued' | 'approved' | 'denied' | 'timeout'
interface AgentConfig { id, name, role, soulPath, tools: string[], modelPref?, builtIn: boolean, active: boolean, createdAt: number }
interface LoopResult { reply: string, actions: ActionSummary[], domain: string, status: 'complete'|'error'|'interrupted', error?: string }
interface ActionSummary { tool: string, args: Record<string, unknown>, output: string, decision: GateDecision, durationMs: number }

// session.ts
interface ChatMessage { role: 'system'|'user'|'assistant'|'tool', content: string|null, tool_calls?: Array<{ id?: string; function: { name: string; arguments: Record<string, unknown> } }>, tool_call_id?: string }
interface OllamaToolSchema { type: 'function', function: { name, description, parameters } }
```

### Config Env Vars

```
CC_AGENT_WORKDIR        Sandbox for shell tool (default: ./data/workspace)
CC_SOUL_MAX_TOKENS      Max soul file tokens (default: 1500)
CC_AGENT_MAX_TURNS      Max agentic loop iterations (default: 10)
CC_TOOL_RESULT_MAX_CHARS  Truncation before LLM (default: 4000)
CC_APPROVAL_TIMEOUT_MS  Approval wait before auto-deny (default: 300000 = 5 min)
CC_DEFAULT_MODEL        Ollama model (default: llama3.2)
```

---

## What Remains — Tasks 11–16

All task text is in `docs/superpowers/plans/2026-03-26-agentic-tool-use.md`. Read the plan file — it has complete implementation code for each task. Do not guess; follow it.

### Task 11: Wire AgenticLoop into chatRoutes
**File:** `packages/core/src/api/routes/chat.ts`

Replace the existing simple `ModelRouter.chat()` call with the full agentic loop:
- Create `AgentRegistry`, `ToolRegistry`, `PermissionGate`, `ActionLog` instances
- Use `router.cascade.route(message)` to classify domain → select agent
- Create `AgentSession` and `AgenticLoop`
- Wire `onApprovalNeeded` callback → sends `approval_request` WS event to matching client via `client._sessionId`
- Return `{ sessionId, reply, domain }` — no streaming yet

Plan location: search for `### Task 11` in the plan file (~line 1954).

### Task 12: Admin API — Agents + Approvals
**Files:** Create `packages/core/src/api/routes/agents.ts`, modify registration in `packages/core/src/index.ts`

REST endpoints:
```
GET    /api/admin/agents
POST   /api/admin/agents       { name, role, soul, tools, modelPref? }
PATCH  /api/admin/agents/:id
DELETE /api/admin/agents/:id   (403 for built-in)
POST   /api/admin/approvals/:id  { decision: 'approve'|'deny'|'always_allow', agentId?, toolName? }
```

All require `x-admin-token` header (same as existing admin routes). Register `agentRoutes` in `index.ts` passing `{ registry, gate }`.

Plan location: search for `### Task 12` (~line 2077).

### Task 13: Web UI — ApprovalCard + ActionLogPanel
**Files:** Create `packages/web/src/components/ApprovalCard.tsx`, `packages/web/src/components/ActionLogPanel.tsx`

- `ApprovalCard`: shows inline approval request with Approve / Deny / Always Allow buttons. Posts to `POST /api/admin/approvals/:id`. Tailwind v4 styled.
- `ActionLogPanel`: collapsible panel below each assistant message listing tool actions taken. Read from `LoopResult.actions` (passed through the WS message).

Plan location: search for `### Task 13` (~line 2206).

### Task 14: Web UI — Agents Page
**Files:** Create `packages/web/src/pages/Agents.tsx`, `packages/web/src/components/AgentCard.tsx`, `packages/web/src/components/AgentEditor.tsx`

Three panels:
1. **Workforce** — AgentCard list (name, role, tool count, built-in lock badge, edit/delete)
2. **Add/Edit Agent** — soul textarea with live token counter (warn at 90% of 1500), tool checkboxes grouped by category, model dropdown
3. **MCP Servers** — stub for now (Task 15 is deferred)

Plan location: search for `### Task 14` (~line varies, after Task 13).

### Task 15: MCP Adapter (Deferred)
Create stub files only — `packages/core/src/tools/mcp/adapter.ts`, `client.ts`, `registry.ts`. Scaffold the interfaces and exports so the build doesn't break but no actual MCP connections yet.

### Task 16: Full Build + Test Run
```bash
pnpm build && pnpm test
```
Fix any remaining issues. Verify 0 TS errors, all tests passing.

---

## How to Execute

Use the **subagent-driven-development** skill if available. It dispatches a fresh implementer subagent per task, then runs spec compliance review + code quality review before marking the task complete.

Process per task:
1. Read the task text from the plan file (provide it to the implementer, don't make them read it)
2. Dispatch implementer subagent
3. Dispatch spec compliance reviewer (verify against design doc Section matching the task)
4. Dispatch code quality reviewer
5. Fix issues, re-review, mark complete

---

## Architecture Notes to Keep in Mind

**Ollama tool-call API quirks:**
- One `role: 'tool'` message per tool call (never batch)
- `tool_call_id` must match `id` in the assistant's `tool_calls` array
- Model returns `content: null` on tool-only turns — guard with `?? ''`
- Tool call IDs are client-generated via `randomUUID()` (Ollama doesn't assign them)

**Permission gate precedence:**
1. Tool not in `agent.tools` → BLOCK
2. Tool reversible → ALLOW
3. Tool in `agent_always_allow` DB table → ALLOW
4. Otherwise → QUEUE (pause loop, await human approval via Promise)

**ActionLog vs LLM truncation:**
- LLM receives output truncated at `CC_TOOL_RESULT_MAX_CHARS` (4000)
- `action_log.result` capped at 2000 chars for UI display
- `action_log.result_full` stores the complete untruncated result

**AgenticLoop.run() error handling:**
- Entire loop wrapped in try/catch; catches return `LoopResult { status: 'error' }` — never throw to caller
- BLOCK/QUEUE-denied/QUEUE-timeout all return error strings to the LLM (loop continues)

**Shell sandbox:**
- `CC_AGENT_WORKDIR` must be set in env for path-level sandbox to activate (Windows compatibility)
- Command-level escape check (`cd /`) is always active regardless of env var

---

## Running Locally

```bash
pnpm install
pnpm build
pnpm start          # core + web concurrently
# OR
pnpm dev            # turbo dev mode
```

Tests:
```bash
cd packages/core && pnpm test
```
