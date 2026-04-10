import type { FastifyInstance } from 'fastify'
import type { UserModelStore } from '../../persona/user-model.js'

export async function userModelRoutes(fastify: FastifyInstance, opts: { store: UserModelStore }) {
  const { store } = opts

  fastify.get('/api/admin/user-model', async (_req, reply) => reply.send(store.getAll()))

  fastify.put<{ Body: { key: string; value: string } }>(
    '/api/admin/user-model',
    async (req, reply) => {
      const { key, value } = req.body ?? {}
      if (!key || value === undefined) return reply.status(400).send({ error: 'key and value are required' })
      store.set(key, value)
      return reply.send({ key, value })
    }
  )

  fastify.delete<{ Params: { key: string } }>(
    '/api/admin/user-model/:key',
    async (req, reply) => {
      store.delete(decodeURIComponent(req.params.key))
      return reply.status(204).send()
    }
  )
}
