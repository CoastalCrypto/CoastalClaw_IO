// Bridges AgenticLoop's onApprovalNeeded fire-and-forget callback to ACP's
// request-response permission flow.
//
// AgenticLoop holds the gate; when a tool needs approval, it calls
// gate.createPendingApproval() to get a promise, then notifies us via
// onApprovalNeeded. We must call gate.resolveApproval(approvalId, ...)
// once the IDE user responds, otherwise the loop stalls until timeout.
//
// Phase-2 scope: maps allow_once → 'approved', deny → 'denied'.
// allow_always is treated as allow_once (no setAlwaysAllow yet — that needs
// agentId, but the AgenticLoop signature only passes agentName). Phase 3.

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

const APPROVE_IDS = new Set(['allow_once', 'allow_always'])

export type ApprovalNotifier = (
  approvalId: string,
  agentName: string,
  toolName: string,
  cmd: string,
) => void

export function makeApprovalNotifier(
  gate: PermissionGate,
  conn: AgentSideConnection,
  acpSessionId: string,
  logToStderr: (...parts: unknown[]) => void = () => {},
): ApprovalNotifier {
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
        if (outcome.outcome === 'selected' && APPROVE_IDS.has(outcome.optionId)) {
          gate.resolveApproval(approvalId, 'approved')
        } else {
          gate.resolveApproval(approvalId, 'denied')
        }
      } catch (err) {
        logToStderr('approval bridge error:', err instanceof Error ? err.message : String(err))
        gate.resolveApproval(approvalId, 'denied')
      }
    })()
  }
}
