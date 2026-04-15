import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { AgentRegistry } from '../../agents/registry.js'
import { ToolRegistry } from '../../tools/registry.js'
import { BossAgent } from '../../agents/boss-agent.js'
import { TeamChannel } from '../../agents/team-channel.js'
import { createBackend } from '../../tools/backends/index.js'
import { loadConfig } from '../../config.js'
import { randomUUID } from 'node:crypto'

export async function teamRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const router = new ModelRouter({ ollamaUrl: config.ollamaUrl, vllmUrl: config.vllmUrl, airllmUrl: config.airllmUrl, defaultModel: config.defaultModel })
  const agentRegistry = new AgentRegistry(`${config.dataDir}/agents.db`)
  const backend = await createBackend(config.agentTrustLevel, [config.agentWorkdir])
  const toolRegistry = new ToolRegistry({
    backend,
    trustLevel: config.agentTrustLevel,
    workdir: config.agentWorkdir,
  })
  const channel = new TeamChannel()

  fastify.post<{
    Body: { task: string; sessionId?: string }
    Reply: { reply: string; subtaskCount: number; subtasks: Array<{ subtaskId: string; reply: string }> }
  }>('/api/team/run', {
    schema: {
      body: {
        type: 'object',
        required: ['task'],
        properties: {
          task: { type: 'string' },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { task, sessionId = randomUUID() } = req.body
    const boss = new BossAgent(router, agentRegistry, channel, toolRegistry)
    const result = await boss.run(task, sessionId)
    return reply.send(result)
  })
}
