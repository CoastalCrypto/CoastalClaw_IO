import type { FastifyInstance } from 'fastify'
import type { AgentRegistry } from '../../agents/registry.js'
import type { ModelRouter } from '../../models/router.js'
import type { ToolRegistry } from '../../tools/registry.js'
import type { PermissionGate } from '../../agents/permission-gate.js'
import type { ActionLog } from '../../agents/action-log.js'
import type { PersonaManager } from '../../persona/manager.js'
import type { SteerQueue } from '../../pipeline/steer-queue.js'
import type { PipelineStore } from '../../pipeline/store.js'
import type { AsyncPipelineRunner } from '../../pipeline/runner.js'
import { AgentPipeline } from '../../agents/pipeline.js'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: {
    registry: AgentRegistry
    router: ModelRouter
    toolRegistry: ToolRegistry
    gate: PermissionGate
    log: ActionLog
    personaMgr: PersonaManager
    steerQueue: SteerQueue
    pipelineStore: PipelineStore
    runner: AsyncPipelineRunner
  },
) {
  const { registry, router, toolRegistry, gate, log, personaMgr, steerQueue, pipelineStore, runner } = opts

  // ── Existing sync run (kept for backward compat) ──────────────────────────
  fastify.post<{
    Body: { stages: Array<{ agentId: string; modelPref?: string }>; input: string; sessionId?: string }
  }>('/api/pipeline/run', {
    schema: {
      body: {
        type: 'object',
        required: ['stages', 'input'],
        properties: {
          stages: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', required: ['agentId'], properties: { agentId: { type: 'string' }, modelPref: { type: 'string' } } } },
          input: { type: 'string', minLength: 1, maxLength: 16384 },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { stages, input, sessionId } = req.body
    for (const stage of stages) {
      const agent = registry.get(stage.agentId)
      if (!agent) return reply.status(400).send({ error: `Agent not found: ${stage.agentId}` })
      if (!agent.active) return reply.status(400).send({ error: `Agent is offline: ${stage.agentId}` })
    }
    const pipeline = new AgentPipeline(registry, router, toolRegistry, gate, log, personaMgr)
    try {
      const result = await pipeline.run(stages, input, sessionId)
      return reply.send(result)
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  // ── Async run ─────────────────────────────────────────────────────────────
  fastify.post<{
    Body: { stages: Array<{ agentId: string; modelPref?: string; type?: 'agent' | 'ralph-loop'; loopBack?: { toStageIdx: number; condition: string; maxIterations: number } }>; input: string; pipelineId?: string; pipelineName?: string }
  }>('/api/pipeline/run/async', async (req, reply) => {
    const { stages, input, pipelineId, pipelineName } = req.body
    for (const stage of stages) {
      if (stage.type === 'ralph-loop') continue
      const agent = registry.get(stage.agentId)
      if (!agent) return reply.status(400).send({ error: `Agent not found: ${stage.agentId}` })
      if (!agent.active) return reply.status(400).send({ error: `Agent is offline: ${stage.agentId}` })
    }
    const { runId } = runner.start(stages, input, pipelineId, pipelineName)
    return reply.status(202).send({ runId })
  })

  // ── Run status ────────────────────────────────────────────────────────────
  fastify.get<{ Params: { runId: string } }>('/api/pipeline/run/:runId', async (req, reply) => {
    const run = runner.getStatus(req.params.runId)
    if (!run) return reply.status(404).send({ error: 'Run not found' })
    return reply.send({ runId: run.runId, status: run.status, stageIdx: run.stageIdx, startedAt: run.startedAt })
  })

  // ── SSE stream for a run ──────────────────────────────────────────────────
  fastify.get<{ Params: { runId: string } }>('/api/pipeline/run/:runId/events', async (req, reply) => {
    const { runId } = req.params
    const run = runner.getStatus(runId)
    if (!run) return reply.status(404).send({ error: 'Run not found' })

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const send = (event: AgentEvent) => {
      if (!('runId' in event) || (event as any).runId !== runId) return
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    // Replay recent history filtered to this runId
    eventBus.getHistory(200).filter(e => 'runId' in e && (e as any).runId === runId).forEach(send)

    eventBus.onAgent(send)

    // Close stream when pipeline finishes
    const cleanup = (e: AgentEvent) => {
      if (!('runId' in e) || (e as any).runId !== runId) return
      if (e.type === 'pipeline_done' || e.type === 'pipeline_error') {
        eventBus.offAgent(send)
        eventBus.offAgent(cleanup)
        reply.raw.end()
      }
    }
    eventBus.onAgent(cleanup)

    req.raw.on('close', () => {
      eventBus.offAgent(send)
      eventBus.offAgent(cleanup)
    })
  })

  // ── Steer active run ──────────────────────────────────────────────────────
  fastify.post<{ Params: { runId: string }; Body: { message: string } }>(
    '/api/pipeline/run/:runId/steer',
    async (req, reply) => {
      const { runId } = req.params
      const run = runner.getStatus(runId)
      if (!run) return reply.status(404).send({ error: 'Run not found' })
      if (run.status !== 'running') return reply.status(409).send({ error: 'Run is not active' })
      steerQueue.push(runId, req.body.message)
      return reply.status(204).send()
    },
  )

  // ── Abort run ─────────────────────────────────────────────────────────────
  fastify.delete<{ Params: { runId: string } }>('/api/pipeline/run/:runId', async (req, reply) => {
    const ok = runner.abort(req.params.runId)
    return ok ? reply.status(204).send() : reply.status(404).send({ error: 'Run not found or not active' })
  })

  // ── Saved pipeline CRUD ───────────────────────────────────────────────────
  fastify.get('/api/admin/pipelines', async (_req, reply) => {
    return reply.send(pipelineStore.list())
  })

  fastify.post<{ Body: { name: string; stages: any[] } }>('/api/admin/pipelines', async (req, reply) => {
    const { name, stages } = req.body
    if (!name) return reply.status(400).send({ error: 'name is required' })
    return reply.status(201).send(pipelineStore.create(name, stages ?? []))
  })

  fastify.get<{ Params: { id: string } }>('/api/admin/pipelines/:id', async (req, reply) => {
    const p = pipelineStore.get(req.params.id)
    return p ? reply.send(p) : reply.status(404).send({ error: 'Not found' })
  })

  fastify.patch<{ Params: { id: string }; Body: { name?: string; stages?: any[] } }>(
    '/api/admin/pipelines/:id',
    async (req, reply) => {
      const updated = pipelineStore.update(req.params.id, req.body)
      return updated ? reply.send(updated) : reply.status(404).send({ error: 'Not found' })
    },
  )

  fastify.delete<{ Params: { id: string } }>('/api/admin/pipelines/:id', async (req, reply) => {
    pipelineStore.delete(req.params.id)
    return reply.status(204).send()
  })

  // ── Run history ────────────────────────────────────────────────────────────
  fastify.get('/api/admin/pipeline-runs', async (_req, reply) => {
    return reply.send(pipelineStore.listRuns(20))
  })
}
