import type { FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'

export interface ArchitectSSEDeps {
  db: Database.Database
  maxConnections?: number
}

const DEFAULT_MAX_CONNECTIONS = 10

export async function architectSSERoutes(app: FastifyInstance, deps: ArchitectSSEDeps): Promise<void> {
  const maxConns = deps.maxConnections ?? DEFAULT_MAX_CONNECTIONS
  let activeConnections = 0

  app.get('/api/admin/architect/events', async (req, reply) => {
    if (activeConnections >= maxConns) {
      return reply.code(429).send({ error: 'too_many_connections', message: `Max ${maxConns} SSE connections reached.` })
    }
    activeConnections++

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const rawSince = Number((req.query as any)?.since ?? 0)
    let lastTimestamp = Number.isFinite(rawSince) && rawSince >= 0 ? rawSince : 0

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

    const cleanup = () => {
      clearInterval(interval)
      activeConnections--
    }

    req.raw.on('close', cleanup)
    await new Promise<void>(resolve => req.raw.on('close', resolve))
  })
}
