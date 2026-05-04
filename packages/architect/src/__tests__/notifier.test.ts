import { describe, it, expect, vi } from 'vitest'
import { ArchitectNotifier } from '../notifier.js'
import { CallbackSigner } from '../callback-signer.js'

describe('ArchitectNotifier', () => {
  it('notifyApprovalNeeded calls broadcast with message containing callback URLs', async () => {
    const key = CallbackSigner.generateKey()
    const signer = new CallbackSigner(key)
    const broadcast = vi.fn().mockResolvedValue(undefined)

    const notifier = new ArchitectNotifier({
      broadcast,
      signer,
      callbackBaseUrl: 'https://api.example.com',
      dashboardBaseUrl: 'https://dashboard.example.com',
    })

    await notifier.notifyApprovalNeeded({
      cycleId: 'cycle-123',
      gate: 'plan',
      workItemTitle: 'Implement feature X',
      planSummary: 'Add support for new authentication method',
      diffStats: '+42 -8',
      reviewTimeoutMin: 30,
    })

    expect(broadcast).toHaveBeenCalledOnce()
    const message = broadcast.mock.calls[0][0]
    expect(message).toContain('Architect needs you')
    expect(message).toContain('Implement feature X')
    expect(message).toContain('Add support for new authentication method')
    expect(message).toContain('+42 -8')
    expect(message).toContain('https://api.example.com/api/admin/architect/callbacks/')
    expect(message).toContain('https://dashboard.example.com/architect/cycles/cycle-123')
  })

  it('notifyDigest calls broadcast with digest summary containing counts', async () => {
    const key = CallbackSigner.generateKey()
    const signer = new CallbackSigner(key)
    const broadcast = vi.fn().mockResolvedValue(undefined)

    const notifier = new ArchitectNotifier({
      broadcast,
      signer,
      callbackBaseUrl: 'https://api.example.com',
      dashboardBaseUrl: 'https://dashboard.example.com',
    })

    await notifier.notifyDigest({
      merged: 5,
      opened: 3,
      rejected: 1,
      errors: 0,
      openPrUrl: 'https://github.com/org/repo/pulls',
    })

    expect(broadcast).toHaveBeenCalledOnce()
    const message = broadcast.mock.calls[0][0]
    expect(message).toContain('Architect daily digest')
    expect(message).toContain('Merged: 5 PRs')
    expect(message).toContain('Opened: 3 PRs awaiting review')
    expect(message).toContain('Rejected: 1 plans')
    expect(message).toContain('Errors: 0')
    expect(message).toContain('https://github.com/org/repo/pulls')
  })

  it('callback URLs in the message contain verifiable signed tokens', async () => {
    const key = CallbackSigner.generateKey()
    const signer = new CallbackSigner(key)
    const broadcast = vi.fn().mockResolvedValue(undefined)

    const notifier = new ArchitectNotifier({
      broadcast,
      signer,
      callbackBaseUrl: 'https://api.example.com',
      dashboardBaseUrl: 'https://dashboard.example.com',
    })

    const cycleId = 'cycle-456'
    const gate = 'pr'

    await notifier.notifyApprovalNeeded({
      cycleId,
      gate,
      workItemTitle: 'Test task',
      planSummary: 'Test plan',
      diffStats: '+1 -1',
      reviewTimeoutMin: 60,
    })

    const message = broadcast.mock.calls[0][0]
    const approveMatch = message.match(/Approve: https:\/\/api\.example\.com\/api\/admin\/architect\/callbacks\/([^\s]+)/)
    const rejectMatch = message.match(/Reject: https:\/\/api\.example\.com\/api\/admin\/architect\/callbacks\/([^\s]+)/)

    expect(approveMatch).not.toBeNull()
    expect(rejectMatch).not.toBeNull()

    const approveToken = approveMatch![1]
    const rejectToken = rejectMatch![1]

    const approveVerified = signer.verify(approveToken)
    const rejectVerified = signer.verify(rejectToken)

    expect(approveVerified).not.toBeNull()
    expect(rejectVerified).not.toBeNull()
    expect(approveVerified?.cycleId).toBe(cycleId)
    expect(approveVerified?.gate).toBe(gate)
    expect(approveVerified?.decision).toBe('approved')
    expect(rejectVerified?.decision).toBe('rejected')
  })
})
