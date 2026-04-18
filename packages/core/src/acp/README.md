# Coastal ACP Adapter

Coastal speaks the [Agent Client Protocol](https://agentclientprotocol.com)
(ACP) — a stdio JSON-RPC bridge that lets ACP-aware IDEs (Zed, and any other
client implementing the spec) talk to Coastal's local agents directly, without
going through the web UI or HTTP API.

The adapter is a single binary entry: `coastal-acp` (`packages/core/src/acp/entry.ts`).
It boots the same `CoastalRuntime` the Fastify API uses (Ollama client, agent
registry, persona, tool registry, permission gate, action log) and exposes it
over `stdin`/`stdout`. **`stdout` is reserved for ACP framing — every log line
goes to `stderr`.**

## Quick start

```bash
# from the repo root, build once
pnpm --filter @coastal-ai/core build

# run the adapter (it speaks ACP on stdio)
pnpm --filter @coastal-ai/core acp

# or, after install, the bin is on PATH
coastal-acp
```

## IDE configuration

### Zed

Add an entry under `agent_servers` in your Zed `settings.json`:

```jsonc
{
  "agent_servers": {
    "Coastal": {
      "command": "node",
      "args": [
        "/absolute/path/to/Coastal.AI/packages/core/dist/acp/entry.js"
      ],
      "env": {
        "COASTAL_ACP_PERSONA": "cto"
      }
    }
  }
}
```

After reloading, Zed's agent panel will list **Coastal** alongside its
built-in agents. Switching to it routes prompts through the adapter.

### Cursor / other ACP clients

Any client that supports ACP stdio servers takes the same shape: a `command`,
its `args`, and optional `env`. Use the same `node …/dist/acp/entry.js` entry
or the `coastal-acp` bin.

## Persona / domain routing

Coastal has multiple built-in agents (`cto`, `cfo`, `coo`, `general`, …). The
adapter resolves which agent runs each ACP session in two steps:

1. **Env pin** — if `COASTAL_ACP_PERSONA` is set to a known domain, that
   wins for the lifetime of the process. Useful when a workspace should
   always talk to the same agent.
2. **Keyword classification** — on the first prompt of a session with no
   pin, the adapter runs `classifyPrompt(userText)` to pick a domain. The
   choice is **locked for the session**, so follow-up turns stay on the
   same agent.

Falls back to `general` when neither produces a match.

## Tool approvals

Tools that the agent's permission tier marks `queued` (irreversible writes,
shell commands without an always-allow entry) trigger ACP's
`session/request_permission`. The IDE shows the prompt with three options:

| Option         | Effect                                                                     |
|----------------|-----------------------------------------------------------------------------|
| Allow once     | Approves this single call only.                                             |
| Allow always   | Persists `(agentId, toolName)` to the gate's always-allow table, then approves. |
| Deny           | Rejects the call; the loop continues with the failure as tool output.       |

Cancelling the prompt or losing the IDE connection is treated as **deny**.

## Tool-call activity stream

While a prompt is being handled, the adapter subscribes to Coastal's
`eventBus` and forwards every `tool_call_start` / `tool_call_end` as ACP
`tool_call` / `tool_call_update` notifications. The IDE renders these as
live activity entries with `in_progress` → `completed | failed` status,
plus the tool kind (`read` / `edit` / `delete` / `execute` / `fetch` / `other`).

## Scope (Phase 2/3)

Wired:
- Real `AgenticLoop` (Ollama, tools, gate, action log)
- Token streaming via `agent_message_chunk`
- Permission bridge with `allow_always` persistence
- Tool-call activity surfacing
- Per-session abort on `session/cancel`

Not yet wired (each is a clean follow-up):
- Per-session MCP servers from the IDE
- IDE filesystem access (read_file/write_file via ACP FS methods)
- `UnifiedMemory`, `ContextStore`, and `UserModelStore` integration
- Session resume

## Layout

| File                       | Role                                                                  |
|----------------------------|-----------------------------------------------------------------------|
| `entry.ts`                 | CLI bootstrap (loads `.env.local`, starts stdio stream).              |
| `runtime.ts`               | Process-scoped composition root (Ollama, registries, gate, log).      |
| `server.ts`                | `CoastalACPAgent` — implements the SDK `Agent` interface.             |
| `sessions.ts`              | In-memory ACP session store (id, locked domain, history, pending abort). |
| `persona-resolver.ts`      | Env-pin + keyword classifier producing a `Domain`.                    |
| `permissions.ts`           | Bridges fire-and-forget `onApprovalNeeded` to ACP `requestPermission`. |
| `tool-call-bridge.ts`      | Subscribes to `eventBus` and emits ACP tool-call sessionUpdates.      |

## Tests

```bash
pnpm --filter @coastal-ai/core test src/acp
```
