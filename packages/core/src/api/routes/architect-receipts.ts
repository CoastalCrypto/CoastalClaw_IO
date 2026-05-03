import type { FastifyInstance } from 'fastify'
import type { CycleStore } from '../../architect/cycle-store.js'

export interface ReceiptRouteDeps {
  cycleStore: CycleStore
}

export async function architectReceiptRoutes(app: FastifyInstance, deps: ReceiptRouteDeps): Promise<void> {
  const { cycleStore } = deps

  app.get('/api/admin/architect/receipts', async (req) => {
    const release = (req.query as any)?.release
    const merged = cycleStore.listMergedWithPR()
    return {
      release: release ?? 'current',
      prs: merged.map(c => ({
        cycleId: c.id,
        workItemId: c.workItemId,
        prUrl: c.prUrl,
        branchName: c.branchName,
        planText: c.planText,
        testSummary: c.testSummary,
        modelUsed: c.modelUsed,
        iteration: c.iteration,
        mergedAt: c.updatedAt,
      })),
      totals: { prsMerged: merged.length },
    }
  })
}
