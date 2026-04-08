import type { FastifyInstance } from 'fastify'
import type { CronStore } from '../../cron/store.js'
import type { CronScheduler } from '../../cron/scheduler.js'

export async function cronRoutes(
  fastify: FastifyInstance,
  opts: { store: CronStore; scheduler: CronScheduler },
) {
  const { store, scheduler } = opts

  fastify.get('/api/admin/crons', async (_req, reply) => {
    return reply.send(store.list())
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/crons/:id', async (req, reply) => {
    const job = store.get(req.params.id)
    if (!job) return reply.status(404).send({ error: 'Not found' })
    return reply.send(job)
  })

  fastify.post<{
    Body: { name: string; schedule: string; task: string; agentId?: string }
  }>('/api/admin/crons', async (req, reply) => {
    const { name, schedule, task, agentId = 'general' } = req.body ?? {}
    if (!name || !schedule || !task)
      return reply.status(400).send({ error: 'name, schedule, and task are required' })
    const job = store.create({ name, schedule, task, agentId })
    scheduler.schedule(job.id, job.schedule, job.agentId, job.task)
    return reply.status(201).send(job)
  })

  fastify.patch<{
    Params: { id: string }
    Body: Partial<{ name: string; schedule: string; task: string; agentId: string; enabled: boolean }>
  }>('/api/admin/crons/:id', async (req, reply) => {
    const existing = store.get(req.params.id)
    if (!existing) return reply.status(404).send({ error: 'Not found' })
    store.update(req.params.id, req.body)
    const updated = store.get(req.params.id)!
    if (updated.enabled) {
      scheduler.schedule(updated.id, updated.schedule, updated.agentId, updated.task)
    } else {
      scheduler.unschedule(updated.id)
    }
    return reply.send(updated)
  })

  fastify.delete<{ Params: { id: string } }>('/api/admin/crons/:id', async (req, reply) => {
    scheduler.unschedule(req.params.id)
    store.delete(req.params.id)
    return reply.status(204).send()
  })

  fastify.post<{ Params: { id: string } }>('/api/admin/crons/:id/trigger', async (req, reply) => {
    try {
      const result = await scheduler.triggerNow(req.params.id)
      return reply.send(result)
    } catch (err: any) {
      return reply.status(404).send({ error: err.message })
    }
  })
}
