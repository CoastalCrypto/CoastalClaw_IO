// packages/core/src/api/routes/architect.ts
//
// Admin-auth pattern verified during Chunk 3 Step 1:
//   This codebase enforces admin auth via a GLOBAL onRequest hook in
//   packages/core/src/server.ts. The hook accepts either an `x-admin-token`
//   header (raw token) or an `x-admin-session` header (HMAC session token
//   from /api/admin/login or a user JWT with role=admin), and rejects any
//   /api/admin/* request that lacks a valid header with 401.
//
//   There is NO `app.verifyAdmin` decorator and NO per-route preHandler in
//   any existing admin-route plugin (see admin.ts, admin-actions.ts,
//   skills.ts). This route plugin therefore intentionally adds no preHandler
//   — auth is the server-level hook's responsibility, and registering this
//   plugin on a Fastify instance that lacks the hook (e.g. tests) bypasses
//   auth as intended for unit-level coverage.
//
//   Route paths begin with /api/admin/architect/work-items so the global
//   hook applies in production.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { WorkItemStore, DedupConflictError } from '../../architect/store.js'
import { APPROVAL_POLICIES, PRIORITIES } from '../../architect/types.js'

const insertSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().default(''),
  targetHints: z.array(z.string()).optional(),
  acceptance: z.string().optional(),
  budgetLoc: z.number().int().positive().optional(),
  budgetIters: z.number().int().positive().max(20).optional(),
  approvalPolicy: z.enum(APPROVAL_POLICIES).optional(),
  reviewTimeoutMin: z.number().int().positive().optional(),
  onTimeout: z.enum(['revise', 'reject', 'auto_approve']).optional(),
  priority: z.enum(PRIORITIES).optional(),
  allowSelfModify: z.boolean().optional(),
})

export interface ArchitectRouteDeps {
  store: WorkItemStore
}

export async function architectRoutes(
  app: FastifyInstance,
  deps: ArchitectRouteDeps,
): Promise<void> {
  const { store } = deps

  app.post('/api/admin/architect/work-items', async (req, reply) => {
    const parsed = insertSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      })
    }
    try {
      const item = store.insert({
        source: 'ui',
        ...parsed.data,
        createdByUserId: (req as any).user?.id ?? null,
      })
      return reply.code(201).send(item)
    } catch (err) {
      if (err instanceof DedupConflictError) {
        return reply.code(409).send({
          error: 'dedup_conflict',
          message:
            'A work item with the same title and target_hints is already active.',
          existingId: err.existingId,
        })
      }
      throw err
    }
  })

  app.get('/api/admin/architect/work-items', async (req) => {
    // For Plan 1, only support status=pending. Plan 3 extends this.
    const status = (req.query as any)?.status
    if (status !== 'pending') return [] // out of scope for backbone
    return store.listPending(100)
  })

  app.get<{ Params: { id: string } }>(
    '/api/admin/architect/work-items/:id',
    async (req, reply) => {
      const { id } = req.params
      const item = store.getById(id)
      if (!item) return reply.code(404).send({ error: 'not_found' })
      return item
    },
  )
}
