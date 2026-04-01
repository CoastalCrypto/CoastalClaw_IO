# Agentic Tool Use — Sub-project A Design

**Goal:** Give CoastalClaw agents (and user-created custom agents) full tool-use capabilities — file system access, shell execution, plugin/MCP integrations, and a permission gate — so they operate with the same autonomous control as Claude Code and OpenClaw.

**Architecture:** A new `agents/` module and `tools/` module sit between `ModelRouter` and the client. The `CascadeRouter` (Phase 2) classifies the domain; `AgentSession` loads that agent's soul and tool set; `AgenticLoop` iterates LLM ↔ tool calls until the agent is done. Core tools are built-in TypeScript. External tools come via an MCP adapter layer.

**Tech Stack:** Node 22 ESM, TypeScript, Ollama tool-call API, MCP JSON-RPC (stdio + SSE transports), better-sqlite3 (action log + agent registry), `fs.watch` (hot-reload souls), Fastify + WebSocket (approval gate + streaming), React + Tailwind v4 (agent management UI).

---

## 1. Architecture Overview

```
User message
     │
     ▼
CascadeRouter (existing)     ← classifies domain + urgency
     │
     ▼
AgentSession                 ← loads SOUL_<domain>.md + domain tool set
     │
     ▼
AgenticLoop                  ← LLM ↔ tool execution, iterates until done
  ├── ToolRegistry            ← resolves tool name → executor
  │     ├── CoreToolSet       ← file, shell, git, sqlite, web (TypeScript)
  │     └── McpAdapter        ← proxies calls to external MCP servers
  ├── PermissionGate          ← allow / block / queue-for-approval
  └── ActionLog               ← SQLite audit trail of every tool execution
     │
     ▼
Final reply + action summary → client (streamed via WebSocket)
```

---

## 2. File Structure

```
packages/core/src/
  agents/
    souls/
      SOUL_COO.md        — built-in COO identity (1200 word max)
      SOUL_CFO.md        — built-in CFO identity
      SOUL_CTO.md        — built-in CTO identity
      SOUL_GENERAL.md    — general assistant fallback
    types.ts             — ToolDefinition, ToolCall, ToolResult, AgentConfig
    session.ts           — AgentSession: loads soul + tools, builds system prompt
    loop.ts              — AgenticLoop: iterates tool calls until completion
    permission-gate.ts   — ApprovalRule evaluation, QUEUE hold management
    action-log.ts        — SQLite-backed audit trail

  tools/
    registry.ts          — ToolRegistry: name → executor map
    core/
      file.ts            — read_file, write_file, list_dir, delete_file
      shell.ts           — run_command (sandboxed to CC_AGENT_WORKDIR)
      git.ts             — git_status, git_commit, git_diff, git_log
      sqlite.ts          — query_db (read + write modes)
      web.ts             — http_get
    mcp/
      adapter.ts         — orchestrates MCP server connections + tool routing
      client.ts          — MCP JSON-RPC client (stdio + SSE transports)
      registry.ts        — SQLite-backed MCP server registry

  api/routes/
    agents.ts            — CRUD /api/admin/agents/*
    mcp.ts               — CRUD /api/admin/mcp/*

packages/web/src/
  pages/
    Agents.tsx           — Agent workforce management page
  components/
    AgentCard.tsx        — Agent card with edit/delete
    AgentEditor.tsx      — Create/edit form (soul editor + tool checkboxes)
    McpServerPanel.tsx   — MCP server list + add form
    ApprovalCard.tsx     — Inline approval gate UI in chat
    ActionLogPanel.tsx   — Collapsible "what your agents did" in chat
```

---

## 3. Agent Registry

Agents are stored in SQLite. Four built-in agents ship with the product (`built_in = 1`, non-deletable). Users can add unlimited custom agents.

```sql
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  soul_path   TEXT NOT NULL,       -- path to .md file, loaded at runtime
  tools       TEXT NOT NULL,       -- JSON array of permitted tool names
  model_pref  TEXT,                -- optional model override
  built_in    INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1,
  created_at  INTEGER
);
```

Soul files for user-created agents are stored at `CC_DATA_DIR/agents/souls/<id>.md`. On `POST /api/admin/agents`, the server writes the `soul` body field to that path and stores it in the `soul_path` column; `CC_DATA_DIR/agents/souls/` is created on first write if it does not exist. Soul files are hot-reloaded via `fs.watch` — edits take effect on the next request without a restart.

**`CC_SOUL_MAX_TOKENS`** — default 1500 (~1200 words). The soul editor shows a live token estimate and warns at 90% capacity.

---

## 4. Agent Identity (SOUL files)

Each soul file is injected into the system prompt position (not message history) on every request. Ollama's KV prefix cache means these tokens are processed once per session, not once per message.

The system prompt passed to the agentic loop is assembled as:

```
[SOUL file content]

Available tools:
- read_file(path): Read a file at the given path. Returns file contents.
- write_file(path, content): Write content to a file.
... (one line per permitted tool)

Current date/time: {ISO timestamp}
Session ID: {sessionId}
```

Built-in soul example (`SOUL_CTO.md`, abbreviated):

```markdown
# Chief Technology Officer — CoastalClaw

You are the CTO of this organization. Your responsibilities:
- Architecture: system design, technology selection, technical direction
- Engineering: code quality, deployment, infrastructure, security
- Operations: uptime, monitoring, performance, incident response

Tone: precise, analytical, evidence-based. Prefer concrete examples over abstractions.
When reviewing code or systems, always identify the root cause before proposing a fix.

You have access to file operations, shell execution, and git. Use them to investigate
before answering technical questions — do not guess at system state when you can check.
Always show your work: if you ran a command, include its output in your reply.
```

---

## 5. Tool Registry

### 5.1 Core Tools

| Category | Tool | Reversible | Default permission |
|----------|------|-----------|-------------------|
| File | `read_file(path)` | Yes | ALLOW |
| File | `write_file(path, content)` | No | QUEUE |
| File | `list_dir(path)` | Yes | ALLOW |
| File | `delete_file(path)` | No | QUEUE |
| Shell | `run_command(cmd, cwd?)` | No | QUEUE |
| Git | `git_status(repo?)` | Yes | ALLOW |
| Git | `git_diff(path?)` | Yes | ALLOW |
| Git | `git_commit(message, files[])` | No | QUEUE |
| Git | `git_log(limit?)` | Yes | ALLOW |
| Database | `query_db(sql, mode)` | Write = No | ALLOW (read) / QUEUE (write) |
| Web | `http_get(url)` | Yes | ALLOW |

`push_notification` is deferred to Sub-project B (Proactive Engine), which will own all notification delivery infrastructure.

Shell execution is sandboxed to `CC_AGENT_WORKDIR` (default: `CC_DATA_DIR/workspace`). Commands that attempt to `cd` outside this directory are blocked at the executor level.

### 5.2 MCP Adapter

The `McpAdapter` connects to external MCP servers at startup and whenever a new server is registered via the admin API. On connect it calls `tools/list` and caches the tool manifest. The `ToolRegistry` merges MCP tools alongside core tools — the agent and the loop have no awareness of which transport a tool uses.

```
MCP server registry (SQLite):
  CREATE TABLE mcp_servers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    transport   TEXT NOT NULL,   -- 'stdio' | 'sse'
    command     TEXT,            -- stdio: full shell command to spawn
    url         TEXT,            -- sse: endpoint URL
    enabled     INTEGER DEFAULT 1,
    tools       TEXT,            -- JSON: cached tool manifest
    last_seen   INTEGER
  );
```

Reconnect policy: exponential backoff (1s → 2s → 4s → max 60s). If a server is unreachable, its tools are removed from the registry until reconnected. Agents that call an unavailable MCP tool receive a clear error result so they can inform the user.

---

## 6. Agentic Execution Loop

```typescript
// Simplified loop logic
async function run(session: AgentSession, userMessage: string): Promise<LoopResult> {
  const messages = session.buildMessages(userMessage)
  let turns = 0

  while (turns < CC_AGENT_MAX_TURNS) {
    const response = await ollama.chat(session.model, messages, session.toolSchemas)

    if (!response.toolCalls?.length) {
      return { reply: response.content, actions: session.actionSummary() }
    }

    // Append assistant turn (with tool_calls) before executing
    messages.push({ role: 'assistant', content: response.content, tool_calls: response.toolCalls })

    // Execute each tool call and append one 'tool' message per result (Ollama requires per-call messages)
    for (const call of response.toolCalls) {
      const result = await executeToolCall(call, session)  // runs gate + executor
      messages.push({ role: 'tool', tool_call_id: call.id, content: result.output })
    }
    turns++
  }

  return { reply: session.partialReply() + '\n\n[Reached maximum turns]', actions: session.actionSummary() }
}
```

**Note on message format:** Ollama's tool-call API requires one `role: 'tool'` message per tool call entry, each referencing the originating `tool_call_id`. Batching all results into a single message causes mis-correlation and must be avoided.

**Parallel execution:** when the LLM requests multiple read-only tools in one turn (`read_file`, `list_dir`, `git_status`, `git_diff`, `git_log`, `query_db` read mode, `http_get`), they execute concurrently via `Promise.all`. Any turn containing at least one write or shell tool executes all calls in that turn sequentially.

**Tool result truncation:** the string passed back to the LLM is capped at `CC_TOOL_RESULT_MAX_CHARS` (default: 4000 chars). The action log stores the full untruncated result in `result_full`; the `result` display column is capped at a fixed 2000 chars for UI rendering only. These are two independent limits.

**`CC_AGENT_MAX_TURNS`** — default: 10. Configurable via env. If reached, the agent returns its current state with a note.

**Streaming:** the final text reply streams token-by-token via WebSocket as today. A compact action summary (e.g. "Read 2 files · Ran 1 command · Committed 1 change") is appended to the streamed reply so the user always knows what the agent did.

---

## 7. Permission Gate

Every tool call passes through the gate before execution using this exact precedence order:

1. **Tool not in `agent.tools`** → `BLOCK` (return error result to LLM; it must try another approach)
2. **Tool is irreversible AND not yet always-allowed for this agent** → `QUEUE` (pause loop, push approval card to UI)
3. **Otherwise** → `ALLOW` (execute immediately)

"Always allow" (set via the approval card or the `/agents` editor) clears condition 2 for that tool + agent combination by writing a flag to the database. Future calls to that tool by that agent skip straight to `ALLOW`.

| Decision | Behaviour |
|----------|-----------|
| `ALLOW` | Execute immediately, record to action log |
| `BLOCK` | Return structured error result to LLM — loop continues |
| `QUEUE` | Pause loop, push approval card to UI, await response |

**Approval hold mechanism:** when `QUEUE` fires, the gate generates a UUID approval ID and stores `{ resolve, reject }` from a `Promise` in an in-memory `pendingApprovals` Map keyed by that ID. The loop `await`s this Promise. The `POST /api/admin/approvals/:id` handler looks up the ID in the Map and calls `resolve('approved')` or `resolve('denied')`. If no response arrives within `CC_APPROVAL_TIMEOUT_MS` (default: 300000 — 5 minutes), the gate auto-denies and the loop returns a timeout message. If the WebSocket drops while a decision is pending, the timeout path handles cleanup. The approval ID is sent to the client in the `approval_request` WebSocket event.

When `QUEUE` fires, the loop holds the WebSocket open and pushes an `approval_request` event to the client. The chat UI renders an inline approval card:

```
┌─────────────────────────────────────────────────┐
│  CTO wants to run a shell command               │
│  > git commit -m "fix: update mining config"   │
│                                                  │
│  [Approve]   [Deny]   [Always allow for CTO]    │
└─────────────────────────────────────────────────┘
```

"Always allow" upgrades that tool to `ALLOW` for that agent in the database — no future prompts for that tool + agent combination.

Users can pre-configure per-agent tool trust levels from the `/agents` page to avoid runtime prompts entirely.

---

## 8. Action Log

```sql
CREATE TABLE action_log (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  agent_id    TEXT NOT NULL,
  tool_name   TEXT NOT NULL,
  args        TEXT,            -- JSON
  result      TEXT,            -- JSON, truncated at 2000 chars for display
  result_full TEXT,            -- JSON, full untruncated result
  decision    TEXT,            -- 'allow' | 'block' | 'queued' | 'approved' | 'denied'
  duration_ms INTEGER,
  created_at  INTEGER
);
```

Visible in the chat as a collapsible "What your agents did" panel below each assistant message. Filterable by agent, tool, and date on the `/agents` page.

---

## 9. Admin API

```
# Agent management
GET    /api/admin/agents              → list all agents (built-in + custom)
POST   /api/admin/agents              → create agent { name, role, soul, tools, model_pref }
PATCH  /api/admin/agents/:id          → update agent (name, role, soul, tools, model_pref)
DELETE /api/admin/agents/:id          → delete agent (built_in=1 returns 403)

# MCP server management
GET    /api/admin/mcp                 → list all MCP servers + connection status
POST   /api/admin/mcp                 → register new MCP server { name, transport, command/url }
PATCH  /api/admin/mcp/:id             → update or enable/disable
DELETE /api/admin/mcp/:id             → remove server

# Approval gate
POST   /api/admin/approvals/:id       → { decision: 'approve' | 'deny' | 'always_allow' }
```

All routes require `x-admin-token` header (same token as Phase 2 admin routes).

---

## 10. Web UI — /agents Page

**Panel 1 — Current Workforce**
Agent cards: name, role, tool count, model, built-in lock badge. Edit + Delete buttons on custom agents. Click to expand soul preview.

**Panel 2 — Add / Edit Agent**
- Name + role fields
- Soul editor: textarea with token counter (warns at 90% of 1500-token limit)
- Tool permissions: checkboxes grouped by category (File Ops, Shell, Git, Database, Web, MCP Plugins)
  - Each irreversible tool shows a "requires approval" badge that can be toggled to "always allow"
- Model preference: optional dropdown (inherits from domain registry if unset)

**Panel 3 — MCP Servers**
- Server list: name, transport, status dot (green/red), tool count
- Add server form: name, transport toggle (stdio/SSE), command/URL, Test Connection button
- Test Connection runs `tools/list` and shows discovered tool names before saving

---

## 11. Config Variables

```
CC_SOUL_MAX_TOKENS       Max soul file size in tokens (default: 1500, ~1200 words)
CC_AGENT_MAX_TURNS       Max agentic loop iterations per request (default: 10)
CC_AGENT_WORKDIR         Sandbox directory for shell tool execution (default: CC_DATA_DIR/workspace)
CC_TOOL_RESULT_MAX_CHARS Max chars returned from a tool call to the LLM (default: 4000)
CC_APPROVAL_TIMEOUT_MS   Ms to wait for human approval before auto-denying (default: 300000 — 5 min)
```

---

## 12. Testing

- **AgenticLoop** — unit tested with mocked ToolRegistry and PermissionGate. Verifies: single-turn (no tools), multi-turn tool use, max-turns cutoff, parallel read execution, sequential write execution, QUEUE pause/resume.
- **PermissionGate** — tests all three decisions (ALLOW, BLOCK, QUEUE), "always allow" promotion, per-agent tool permission check.
- **ToolRegistry** — tests core tool resolution, MCP tool resolution, unknown tool returns clear error.
- **CoreToolSet** — integration tests for each tool (file read/write/delete, shell sandboxing, git ops, db query). Shell sandbox test: verify commands outside CC_AGENT_WORKDIR are blocked.
- **McpAdapter** — tests connect/disconnect, tool manifest merge, reconnect backoff, unavailable server graceful error.
- **AgentSession** — tests soul hot-reload (write file, verify next session picks up change), system prompt assembly, tool schema inclusion.
- **Action Log** — tests ALLOW/BLOCK/QUEUE records written correctly, result truncation at 2000 chars with full result preserved.
- **Agent API** — REST tests for CRUD, built-in delete rejection (403), soul file creation/deletion on disk.
- **Agents UI** — React Testing Library: workforce panel render, create agent form, tool permission toggle, MCP server add + test connection, approval card approve/deny flow.

---

## 13. Roadmap Placement

Depends on: Phase 1 (Fastify, WebSocket, SQLite, OllamaClient), Phase 2 (CascadeRouter for domain classification).

No dependency on Sub-project B (Proactive Engine) or Sub-project C (Mirofish). Delivers standalone value: agents that can take real actions when asked.

**Suggested build sequence:**
1. Types + AgentRegistry (SQLite schema, CRUD API)
2. Soul files + AgentSession (hot-reload, system prompt assembly)
3. Core tool set (file, shell, git, db, web)
4. ToolRegistry + PermissionGate + ActionLog
5. AgenticLoop (single-turn → multi-turn → parallel reads)
6. MCP adapter (client, registry, adapter)
7. Admin API (agents + MCP endpoints)
8. Web UI (workforce page, agent editor, MCP panel, approval card, action log panel)
