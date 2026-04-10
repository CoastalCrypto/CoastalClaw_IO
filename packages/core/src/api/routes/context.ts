import type { FastifyInstance } from 'fastify'
import type { ContextStore } from '../../context/store.js'

export async function contextRoutes(fastify: FastifyInstance, opts: { store: ContextStore }) {
  const { store } = opts

  fastify.get('/api/admin/context', async (_req, reply) => reply.send(store.list()))

  fastify.get<{ Params: { id: string } }>('/api/admin/context/:id', async (req, reply) => {
    const doc = store.get(req.params.id)
    if (!doc) return reply.status(404).send({ error: 'Not found' })
    return reply.send(doc)
  })

  fastify.post<{ Body: { title: string; content: string; scope?: string } }>(
    '/api/admin/context',
    async (req, reply) => {
      const { title, content, scope = 'global' } = req.body ?? {}
      if (!title || !content) return reply.status(400).send({ error: 'title and content are required' })
      return reply.status(201).send(store.create({ title, content, scope }))
    }
  )

  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ title: string; content: string; scope: string; enabled: boolean }>
  }>('/api/admin/context/:id', async (req, reply) => {
    const updated = store.update(req.params.id, req.body)
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send(updated)
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/context/:id', async (req, reply) => {
    store.delete(req.params.id)
    return reply.status(204).send()
  })
}
