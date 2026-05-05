import type { FastifyInstance } from 'fastify'
import type { CycleStore } from '../../architect/cycle-store.js'

export interface CallbackRouteDeps {
  cycleStore: CycleStore
  verifyToken: (token: string) => { cycleId: string; gate: string; decision: string; expiresAt: number } | null
}

export async function architectCallbackRoutes(app: FastifyInstance, deps: CallbackRouteDeps): Promise<void> {
  // POST for API clients
  app.post<{ Params: { token: string } }>('/api/admin/architect/callbacks/:token', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const payload = deps.verifyToken(req.params.token)
    if (!payload) return reply.code(410).send({ error: 'expired_or_invalid', message: 'This link has expired or is invalid.' })
    deps.cycleStore.recordApproval(payload.cycleId, {
      gate: payload.gate,
      decision: payload.decision,
      decidedBy: 'callback',
    })
    return { ok: true, decision: payload.decision }
  })

  // GET for browser link clicks (Telegram taps etc.)
  app.get<{ Params: { token: string } }>('/api/admin/architect/callbacks/:token', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const payload = deps.verifyToken(req.params.token)
    if (!payload) return reply.code(410).type('text/html').send('<h1>Link Expired</h1><p>This approval link has expired or is invalid.</p>')
    deps.cycleStore.recordApproval(payload.cycleId, {
      gate: payload.gate,
      decision: payload.decision,
      decidedBy: 'callback',
    })
    return reply.type('text/html').send(`<h1>Done</h1><p>Decision: ${payload.decision}</p><p><a href="/">Back to dashboard</a></p>`)
  })
}
