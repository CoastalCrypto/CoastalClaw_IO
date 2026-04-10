import type { FastifyInstance } from 'fastify'
import type { UnifiedMemory } from '../../memory/index.js'

export async function searchRoutes(fastify: FastifyInstance, opts: { memory: UnifiedMemory }) {
  const { memory } = opts

  fastify.get<{ Querystring: { q: string; limit?: string } }>(
    '/api/search',
    async (req, reply) => {
      const q = req.query.q?.trim()
      if (!q) return reply.status(400).send({ error: 'q is required' })
      const limit = Math.min(parseInt(req.query.limit ?? '20', 10) || 20, 100)
      const results = memory.search(q, limit)
      return reply.send(results)
    }
  )
}
