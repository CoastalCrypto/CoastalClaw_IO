import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import type { AgentSideConnection } from '@agentclientprotocol/sdk'

import { PermissionGate } from '../../agents/permission-gate.js'
import { makeApprovalNotifier } from '../permissions.js'

function makeGate(): { gate: PermissionGate; db: Database.Database } {
  const db = new Database(':memory:')
  return { gate: new PermissionGate(db), db }
}

function makeFakeConn(outcome: unknown, throwInstead = false) {
  const requestPermission = vi.fn(async () => {
    if (throwInstead) throw new Error('IDE disconnected')
    return { outcome }
  })
  return { requestPermission }
}

describe('makeApprovalNotifier', () => {
  let gate: PermissionGate
  let db: Database.Database
  const agentId = 'cto'

  beforeEach(() => {
    ;({ gate, db } = makeGate())
  })

  it('allow_once resolves approved without setting always-allow', async () => {
    const conn = makeFakeConn({ outcome: 'selected', optionId: 'allow_once' })
    const notifier = makeApprovalNotifier({
      gate,
      conn: conn as unknown as AgentSideConnection,
      acpSessionId: 'sess-1',
      agentId,
    })

    const { approvalId, promise } = gate.createPendingApproval()
    notifier(approvalId, 'CTO', 'run_command', 'ls')
    const decision = await promise

    expect(decision).toBe('approved')
    expect(conn.requestPermission).toHaveBeenCalledTimes(1)
    const row = db.prepare('SELECT 1 FROM agent_always_allow WHERE agent_id = ? AND tool_name = ?').get(agentId, 'run_command')
    expect(row).toBeUndefined()
  })

  it('allow_always persists agent+tool to gate AND resolves approved', async () => {
    const conn = makeFakeConn({ outcome: 'selected', optionId: 'allow_always' })
    const notifier = makeApprovalNotifier({
      gate,
      conn: conn as unknown as AgentSideConnection,
      acpSessionId: 'sess-1',
      agentId,
    })

    const { approvalId, promise } = gate.createPendingApproval()
    notifier(approvalId, 'CTO', 'write_file', '{"path":"x"}')
    const decision = await promise

    expect(decision).toBe('approved')
    const row = db.prepare('SELECT 1 FROM agent_always_allow WHERE agent_id = ? AND tool_name = ?').get(agentId, 'write_file')
    expect(row).toBeDefined()

    expect(gate.evaluate(agentId, 'write_file', false, ['write_file'])).toBe('allow')
  })

  it('deny option resolves denied', async () => {
    const conn = makeFakeConn({ outcome: 'selected', optionId: 'deny' })
    const notifier = makeApprovalNotifier({
      gate,
      conn: conn as unknown as AgentSideConnection,
      acpSessionId: 'sess-1',
      agentId,
    })

    const { approvalId, promise } = gate.createPendingApproval()
    notifier(approvalId, 'CTO', 'delete_file', '{"path":"x"}')
    expect(await promise).toBe('denied')
  })

  it('cancelled outcome resolves denied', async () => {
    const conn = makeFakeConn({ outcome: 'cancelled' })
    const notifier = makeApprovalNotifier({
      gate,
      conn: conn as unknown as AgentSideConnection,
      acpSessionId: 'sess-1',
      agentId,
    })

    const { approvalId, promise } = gate.createPendingApproval()
    notifier(approvalId, 'CTO', 'delete_file', '{}')
    expect(await promise).toBe('denied')
  })

  it('requestPermission throw resolves denied and logs', async () => {
    const conn = makeFakeConn({}, true)
    const log = vi.fn()
    const notifier = makeApprovalNotifier({
      gate,
      conn: conn as unknown as AgentSideConnection,
      acpSessionId: 'sess-1',
      agentId,
      logToStderr: log,
    })

    const { approvalId, promise } = gate.createPendingApproval()
    notifier(approvalId, 'CTO', 'run_command', 'ls')
    expect(await promise).toBe('denied')
    expect(log).toHaveBeenCalled()
  })
})
