// Bridges AgenticLoop's onApprovalNeeded fire-and-forget callback to ACP's
// request-response permission flow.
//
// AgenticLoop holds the gate; when a tool needs approval, it calls
// gate.createPendingApproval() to get a promise, then notifies us via
// onApprovalNeeded. We must call gate.resolveApproval(approvalId, ...)
// once the IDE user responds, otherwise the loop stalls until timeout.
//
// agentId is captured in the closure (not passed by AgenticLoop) so that
// 'allow_always' can persist via gate.setAlwaysAllow before resolving.

import type { AgentSideConnection } from '@agentclientprotocol/sdk'
import type { PermissionGate } from '../agents/permission-gate.js'

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

export type ApprovalNotifier = (
  approvalId: string,
  agentName: string,
  toolName: string,
  cmd: string,
) => void

export interface ApprovalBridgeOptions {
  gate: PermissionGate
  conn: AgentSideConnection
  acpSessionId: string
  agentId: string
  logToStderr?: (...parts: unknown[]) => void
}

export function makeApprovalNotifier(opts: ApprovalBridgeOptions): ApprovalNotifier {
  const { gate, conn, acpSessionId, agentId } = opts
  const logToStderr = opts.logToStderr ?? (() => {})

  return (approvalId, agentName, toolName, cmd) => {
    void (async () => {
      try {
        const response = await conn.requestPermission({
          sessionId: acpSessionId,
          toolCall: {
            toolCallId: approvalId,
            title: `${agentName}: ${toolName}`,
            kind: 'execute',
            status: 'pending',
            rawInput: { command: cmd },
          },
          options: OPTIONS as unknown as Parameters<typeof conn.requestPermission>[0]['options'],
        })

        const outcome = response.outcome
        if (outcome.outcome !== 'selected') {
          gate.resolveApproval(approvalId, 'denied')
          return
        }

        switch (outcome.optionId) {
          case 'allow_always':
            gate.setAlwaysAllow(agentId, toolName)
            gate.resolveApproval(approvalId, 'approved')
            return
          case 'allow_once':
            gate.resolveApproval(approvalId, 'approved')
            return
          default:
            gate.resolveApproval(approvalId, 'denied')
        }
      } catch (err) {
        logToStderr('approval bridge error:', err instanceof Error ? err.message : String(err))
        gate.resolveApproval(approvalId, 'denied')
      }
    })()
  }
}
