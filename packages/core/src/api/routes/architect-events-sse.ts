import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'

export interface ArchitectSSEDeps {
  db: Database.Database
}

export async function architectSSERoutes(app: FastifyInstance, deps: ArchitectSSEDeps): Promise<void> {
  app.get('/api/admin/architect/events', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    let lastTimestamp = Number((req.query as any)?.since ?? 0)

    // Send initial batch
    const initial = deps.db.prepare(
      'SELECT * FROM architect_events WHERE created_at > ? ORDER BY created_at ASC LIMIT 50'
    ).all(lastTimestamp) as any[]
    for (const event of initial) {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      lastTimestamp = Math.max(lastTimestamp, event.created_at)
    }

    // Poll for new events every 2 seconds
    const interval = setInterval(() => {
      try {
        const newEvents = deps.db.prepare(
          'SELECT * FROM architect_events WHERE created_at > ? ORDER BY created_at ASC LIMIT 20'
        ).all(lastTimestamp) as any[]
        for (const event of newEvents) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
          lastTimestamp = Math.max(lastTimestamp, event.created_at)
        }
      } catch { /* db may be closed during shutdown */ }
    }, 2000)

    req.raw.on('close', () => clearInterval(interval))
    await new Promise<void>(resolve => req.raw.on('close', resolve))
  })
}
