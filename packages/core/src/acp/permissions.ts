// Bridges ACP permission requests to Coastal's tool-approval shape.
//
// Coastal's PermissionGate expects a callback returning 'once' | 'always' | 'deny'.
// ACP returns either an AllowedOutcome with an option_id we control, or a
// CancelledOutcome. We map our own option ids back to Coastal strings.

import type { AgentSideConnection } from '@agentclientprotocol/sdk'

export type CoastalApprovalResult = 'once' | 'always' | 'deny'

interface AcpPermissionOption {
  optionId: string
  kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always'
  name: string
}

const OPTIONS: readonly AcpPermissionOption[] = [
  { optionId: 'allow_once',   kind: 'allow_once',   name: 'Allow once' },
  { optionId: 'allow_always', kind: 'allow_always', name: 'Allow always' },
  { optionId: 'deny',         kind: 'reject_once',  name: 'Deny' },
]

const OUTCOME_MAP: Record<string, CoastalApprovalResult> = {
  allow_once: 'once',
  allow_always: 'always',
  deny: 'deny',
}

export function makeApprovalBridge(
  conn: AgentSideConnection,
  sessionId: string,
  timeoutMs = 60_000,
): (toolName: string, description: string) => Promise<CoastalApprovalResult> {
  return async (toolName, description) => {
    const toolCallId = `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const requestPromise = conn.requestPermission({
      sessionId,
      toolCall: {
        toolCallId,
        title: toolName,
        kind: 'execute',
        status: 'pending',
        rawInput: { description },
      },
      options: OPTIONS as unknown as Parameters<typeof conn.requestPermission>[0]['options'],
    })

    let timer: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<'deny'>((resolve) => {
      timer = setTimeout(() => resolve('deny'), timeoutMs)
    })

    try {
      const result = await Promise.race([requestPromise, timeoutPromise])
      if (result === 'deny') return 'deny'
      const outcome = result.outcome
      if (outcome.outcome !== 'selected') return 'deny'
      return OUTCOME_MAP[outcome.optionId] ?? 'deny'
    } catch {
      return 'deny'
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
