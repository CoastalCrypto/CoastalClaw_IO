import type { FastifyInstance } from 'fastify'
import type { ChannelManager } from '../../channels/manager.js'
import type { ChannelType } from '../../channels/types.js'

export async function channelRoutes(fastify: FastifyInstance, opts: { manager: ChannelManager }) {
  const { manager } = opts

  fastify.get('/api/admin/channels', async (_req, reply) => {
    return reply.send(manager.list().map(c => ({ ...c, config: '[redacted]' })))
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/channels/:id', async (req, reply) => {
    const ch = manager.get(req.params.id)
    if (!ch) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ...ch, config: '[redacted]' })
  })

  fastify.post<{
    Body: { type: ChannelType; name: string; config: Record<string, string> }
  }>('/api/admin/channels', async (req, reply) => {
    const { type, name, config } = req.body
    if (!type || !name || !config)
      return reply.status(400).send({ error: 'type, name, and config are required' })
    const ch = manager.create({ type, name, config })
    return reply.status(201).send({ ...ch, config: '[redacted]' })
  })

  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ name: string; config: Record<string, string>; enabled: boolean }>
  }>('/api/admin/channels/:id', async (req, reply) => {
    const updated = manager.update(req.params.id, req.body)
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send({ ...updated, config: '[redacted]' })
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/channels/:id', async (req, reply) => {
    manager.delete(req.params.id)
    return reply.status(204).send()
  })

  // Test — send a message to one channel
  fastify.post<{
    Params: { id: string }
    Body: { message?: string }
  }>('/api/admin/channels/:id/test', async (req, reply) => {
    const results = await manager.broadcast(
      req.body?.message ?? '👋 Test message from Coastal.AI',
      req.params.id,
    )
    return reply.send(results[0] ?? { error: 'Channel not found' })
  })

  // Broadcast to all enabled channels
  fastify.post<{ Body: { message: string } }>('/api/admin/channels/broadcast', async (req, reply) => {
    if (!req.body?.message)
      return reply.status(400).send({ error: 'message is required' })
    const results = await manager.broadcast(req.body.message)
    return reply.send(results)
  })
}
