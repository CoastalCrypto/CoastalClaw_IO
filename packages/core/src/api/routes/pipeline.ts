import type { FastifyInstance } from 'fastify'
import type { AgentRegistry } from '../../agents/registry.js'
import type { ModelRouter } from '../../models/router.js'
import type { ToolRegistry } from '../../tools/registry.js'
import type { PermissionGate } from '../../agents/permission-gate.js'
import type { ActionLog } from '../../agents/action-log.js'
import type { PersonaManager } from '../../persona/manager.js'
import { AgentPipeline } from '../../agents/pipeline.js'

export async function pipelineRoutes(
  fastify: FastifyInstance,
  opts: {
    registry: AgentRegistry
    router: ModelRouter
    toolRegistry: ToolRegistry
    gate: PermissionGate
    log: ActionLog
    personaMgr: PersonaManager
  },
) {
  fastify.post<{
    Body: {
      stages: Array<{ agentId: string; modelPref?: string }>
      input: string
      sessionId?: string
    }
  }>('/api/pipeline/run', {
    schema: {
      body: {
        type: 'object',
        required: ['stages', 'input'],
        properties: {
          stages: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: {
              type: 'object',
              required: ['agentId'],
              properties: {
                agentId: { type: 'string' },
                modelPref: { type: 'string' },
              },
            },
          },
          input: { type: 'string', minLength: 1, maxLength: 16384 },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { stages, input, sessionId } = req.body
    // Validate all agents exist before starting
    for (const stage of stages) {
      const agent = opts.registry.get(stage.agentId)
      if (!agent) return reply.status(400).send({ error: `Agent not found: ${stage.agentId}` })
      if (!agent.active) return reply.status(400).send({ error: `Agent is offline: ${stage.agentId}` })
    }

    const pipeline = new AgentPipeline(
      opts.registry,
      opts.router,
      opts.toolRegistry,
      opts.gate,
      opts.log,
      opts.personaMgr,
    )

    try {
      const result = await pipeline.run(stages, input, sessionId)
      return reply.send(result)
    } catch (e: unknown) {
      return reply.status(500).send({ error: e instanceof Error ? e.message : String(e) })
    }
  })
}
