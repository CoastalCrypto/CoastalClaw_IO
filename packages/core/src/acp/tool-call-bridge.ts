// Bridges Coastal's internal eventBus tool_call_start/tool_call_end events to
// ACP sessionUpdate('tool_call' | 'tool_call_update') notifications. This lets
// the IDE show live activity for every tool the agent runs.
//
// Correlation: AgenticLoop emits start with ts=startTime and end with
// ts=Date.now(), durationMs. We recover startTs = end.ts - end.durationMs to
// pair them. Same-name tools that start in the same millisecond would collide,
// which is acceptable for v1 (the IDE just shows one entry instead of two).

import { randomUUID } from 'node:crypto'
import type { AgentSideConnection, ToolKind } from '@agentclientprotocol/sdk'
import { eventBus } from '../events/bus.js'
import type { AgentEvent } from '../events/types.js'

export interface ToolCallBridgeOptions {
  conn: AgentSideConnection
  acpSessionId: string
  loopSessionId: string
  logToStderr?: (...parts: unknown[]) => void
}

export function subscribeToolCalls(opts: ToolCallBridgeOptions): () => void {
  const { conn, acpSessionId, loopSessionId } = opts
  const log = opts.logToStderr ?? (() => {})
  const inflight = new Map<string, string>()

  const listener = (event: AgentEvent): void => {
    if (event.type !== 'tool_call_start' && event.type !== 'tool_call_end') return
    if (event.sessionId !== loopSessionId) return

    if (event.type === 'tool_call_start') {
      const toolCallId = randomUUID()
      inflight.set(keyFor(event.ts, event.toolName), toolCallId)
      void conn.sessionUpdate({
        sessionId: acpSessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId,
          title: titleFor(event.toolName, event.args),
          kind: kindFor(event.toolName),
          status: 'in_progress',
          rawInput: event.args,
        },
      }).catch((err) => log('tool_call sessionUpdate failed:', String(err)))
      return
    }

    const startTs = event.ts - event.durationMs
    const key = keyFor(startTs, event.toolName)
    const toolCallId = inflight.get(key)
    if (!toolCallId) return
    inflight.delete(key)

    void conn.sessionUpdate({
      sessionId: acpSessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: event.success ? 'completed' : 'failed',
      },
    }).catch((err) => log('tool_call_update sessionUpdate failed:', String(err)))
  }

  eventBus.onAgent(listener)
  return () => { eventBus.offAgent(listener) }
}

function keyFor(ts: number, toolName: string): string {
  return `${ts}:${toolName}`
}

function titleFor(toolName: string, args: Record<string, unknown>): string {
  const detail =
    typeof args.command === 'string' ? args.command :
    typeof args.path === 'string' ? args.path :
    typeof args.url === 'string' ? args.url :
    typeof args.query === 'string' ? args.query :
    typeof args.message === 'string' ? args.message : ''
  const trimmed = detail.length > 80 ? `${detail.slice(0, 77)}...` : detail
  return trimmed ? `${toolName}: ${trimmed}` : toolName
}

function kindFor(toolName: string): ToolKind {
  switch (toolName) {
    case 'read_file':
    case 'list_dir':
    case 'git_status':
    case 'git_diff':
    case 'git_log':
    case 'query_db':
    case 'analyze_dataset':
      return 'read'
    case 'write_file':
      return 'edit'
    case 'delete_file':
      return 'delete'
    case 'run_command':
    case 'git_commit':
      return 'execute'
    case 'http_get':
      return 'fetch'
    default:
      return 'other'
  }
}
