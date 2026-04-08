import type { FastifyInstance } from 'fastify'
import type { SkillStore } from '../../skills/store.js'

export async function skillRoutes(fastify: FastifyInstance, opts: { store: SkillStore }) {
  const { store } = opts

  // Public — chat needs to read skills for autocomplete
  fastify.get('/api/skills', async (_req, reply) => {
    return reply.send(store.list().filter(s => s.enabled))
  })

  fastify.get('/api/admin/skills', async (_req, reply) => {
    return reply.send(store.list())
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/skills/:id', async (req, reply) => {
    const skill = store.get(req.params.id)
    if (!skill) return reply.status(404).send({ error: 'Not found' })
    return reply.send(skill)
  })

  fastify.post<{
    Body: { name: string; description: string; prompt: string; agentId?: string }
  }>('/api/admin/skills', async (req, reply) => {
    const { name, description, prompt, agentId = 'general' } = req.body ?? {}
    if (!name || !description || !prompt)
      return reply.status(400).send({ error: 'name, description, and prompt are required' })
    const slug = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (!slug) return reply.status(400).send({ error: 'Invalid name' })
    const skill = store.create({ name: slug, description, prompt, agentId })
    return reply.status(201).send(skill)
  })

  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ name: string; description: string; prompt: string; agentId: string; enabled: boolean }>
  }>('/api/admin/skills/:id', async (req, reply) => {
    const updated = store.update(req.params.id, req.body)
    if (!updated) return reply.status(404).send({ error: 'Not found' })
    return reply.send(updated)
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/skills/:id', async (req, reply) => {
    store.delete(req.params.id)
    return reply.status(204).send()
  })
}
