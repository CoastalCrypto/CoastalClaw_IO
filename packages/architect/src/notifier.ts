import type { CallbackSigner } from './callback-signer.js'

export interface NotifierDeps {
  broadcast: (message: string) => Promise<void>
  signer: CallbackSigner
  callbackBaseUrl: string
  dashboardBaseUrl: string
}

export class ArchitectNotifier {
  constructor(private deps: NotifierDeps) {}

  async notifyApprovalNeeded(opts: {
    cycleId: string
    gate: 'plan' | 'pr'
    workItemTitle: string
    planSummary: string
    diffStats: string
    reviewTimeoutMin: number
  }): Promise<void> {
    const expiresAt = Date.now() + opts.reviewTimeoutMin * 60 * 1000
    const approveToken = this.deps.signer.sign({
      cycleId: opts.cycleId,
      gate: opts.gate,
      decision: 'approved',
      expiresAt,
    })
    const rejectToken = this.deps.signer.sign({
      cycleId: opts.cycleId,
      gate: opts.gate,
      decision: 'rejected',
      expiresAt,
    })

    const message = [
      `Architect needs you`,
      '',
      `Task: ${opts.workItemTitle}`,
      `Plan: ${opts.planSummary.slice(0, 200)}`,
      '',
      `Changes: ${opts.diffStats}`,
      '',
      `Approve: ${this.deps.callbackBaseUrl}/api/admin/architect/callbacks/${approveToken}`,
      `Reject: ${this.deps.callbackBaseUrl}/api/admin/architect/callbacks/${rejectToken}`,
      '',
      `Or review in dashboard: ${this.deps.dashboardBaseUrl}/architect/cycles/${opts.cycleId}`,
    ].join('\n')

    await this.deps.broadcast(message)
  }

  async notifyDigest(opts: {
    merged: number
    opened: number
    rejected: number
    errors: number
    openPrUrl?: string
  }): Promise<void> {
    const lines = [
      `Architect daily digest`,
      '',
      `Merged: ${opts.merged} PRs`,
      `Opened: ${opts.opened} PRs awaiting review`,
      `Rejected: ${opts.rejected} plans`,
      `Errors: ${opts.errors}`,
    ]
    if (opts.openPrUrl) lines.push('', `Review: ${opts.openPrUrl}`)
    await this.deps.broadcast(lines.join('\n'))
  }
}
