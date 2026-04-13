import type { FastifyInstance } from 'fastify'
import { McpStore, McpServerConfig } from '../../tools/mcp/store.js'

export async function mcpRoutes(fastify: FastifyInstance, opts: { store: McpStore }) {
  const { store } = opts

  fastify.get('/api/admin/mcp', async () => {
    return store.list()
  })

  fastify.post<{ Body: McpServerConfig }>('/api/admin/mcp', async (req, reply) => {
    const config = req.body
    if (!config.id || !config.name || !config.command) {
      return reply.status(400).send({ error: 'Missing required fields' })
    }
    store.upsert(config)
    return reply.send({ success: true })
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/mcp/:id', async (req) => {
    store.delete(req.params.id)
    return { success: true }
  })
}
