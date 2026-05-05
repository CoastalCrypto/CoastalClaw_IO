import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { CycleStore } from '../../architect/cycle-store.js'
import type { WorkItemStore } from '../../architect/store.js'

export interface CycleRouteDeps {
  cycleStore: CycleStore
  workStore: WorkItemStore
}

export async function architectCycleRoutes(app: FastifyInstance, deps: CycleRouteDeps): Promise<void> {
  const { cycleStore } = deps

  app.get('/api/admin/architect/activity', async (req) => {
    const q = req.query as any
    const stage = q?.status && q.status !== 'all' ? q.status : undefined
    const rawSince = q?.since ? Number(q.since) : undefined
    const since = rawSince != null && Number.isFinite(rawSince) && rawSince >= 0 ? rawSince : undefined
    const rawLimit = Number(q?.limit ?? 50)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 50
    return cycleStore.listRecent(limit, { stage, sinceMs: since })
  })

  app.get<{ Params: { id: string } }>('/api/admin/architect/cycles/:id', async (req, reply) => {
    const cycle = cycleStore.getById(req.params.id)
    if (!cycle) return reply.code(404).send({ error: 'not_found' })
    return cycle
  })

  const approvalSchema = z.object({
    gate: z.enum(['plan', 'diff', 'merge']),
    decision: z.enum(['approved', 'rejected', 'revised']),
    comment: z.string().max(2000).optional(),
  })

  app.post<{ Params: { id: string } }>('/api/admin/architect/cycles/:id/approval', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const parsed = approvalSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() })
    const cycle = cycleStore.getById(req.params.id)
    if (!cycle) return reply.code(404).send({ error: 'not_found' })
    cycleStore.recordApproval(cycle.id, {
      gate: parsed.data.gate,
      decision: parsed.data.decision,
      comment: parsed.data.comment,
      decidedBy: (req as any).user?.id ?? 'admin',
    })
    return { ok: true }
  })
}
