import type { FastifyInstance } from 'fastify'
import type { CycleStore } from '../../architect/cycle-store.js'
import type { WorkItemStore } from '../../architect/store.js'

export interface InsightRouteDeps {
  cycleStore: CycleStore
  workStore: WorkItemStore
}

export async function architectInsightRoutes(app: FastifyInstance, deps: InsightRouteDeps): Promise<void> {
  const { cycleStore, workStore } = deps

  app.get('/api/admin/architect/insights', async (req) => {
    const range = Number((req.query as any)?.range ?? 30)
    const insights = cycleStore.getInsights(range)
    const counts = workStore.countByStatus()
    return {
      ...insights,
      openQueueDepth: (counts.pending ?? 0) + (counts.active ?? 0) + (counts.awaiting_human ?? 0),
      errorCount: counts.error ?? 0,
    }
  })
}
