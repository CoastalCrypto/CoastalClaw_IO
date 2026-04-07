import type { FastifyInstance } from 'fastify'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'

export async function eventRoutes(fastify: FastifyInstance) {
  // SSE stream — GET /api/events
  fastify.get('/api/events', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    const send = (event: AgentEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    // Replay recent history so the page populates immediately
    for (const event of eventBus.getHistory(50)) {
      send(event)
    }

    eventBus.onAgent(send)

    req.raw.on('close', () => {
      eventBus.offAgent(send)
    })

    // Keep the connection open
    await new Promise<void>((resolve) => {
      req.raw.on('close', resolve)
    })
  })

  // Snapshot — GET /api/events/history
  fastify.get('/api/events/history', async (_req, reply) => {
    return reply.send({ events: eventBus.getHistory(100) })
  })
}
