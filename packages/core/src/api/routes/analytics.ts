import type { FastifyInstance } from 'fastify'
import { AnalyticsStore } from '../../analytics/store.js'
import type Database from 'better-sqlite3'

export async function analyticsRoutes(fastify: FastifyInstance, opts: { db: Database.Database }) {
  const store = new AnalyticsStore(opts.db)

  fastify.get('/api/analytics', async (_req, reply) => {
    return reply.send(store.getSnapshot())
  })
}
