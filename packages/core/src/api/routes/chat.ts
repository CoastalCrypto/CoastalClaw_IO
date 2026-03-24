import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { loadConfig } from '../../config.js'
import { randomUUID } from 'crypto'

export async function chatRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const router = new ModelRouter({
    ollamaUrl: config.ollamaUrl,
    defaultModel: process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
  })
  const memory = new UnifiedMemory({
    dataDir: config.dataDir,
    mem0ApiKey: config.mem0ApiKey,
  })

  fastify.post<{
    Body: { sessionId?: string; message: string; model?: string }
  }>('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          sessionId: { type: 'string' },
          message: { type: 'string', minLength: 1 },
          model: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { message, model } = req.body
    const sessionId = req.body.sessionId ?? randomUUID()

    // Persist user message
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    })

    // Get history for context (newest-first from DB → reverse for chronological order)
    const history = await memory.queryHistory({ sessionId, limit: 20 })
    const messages = history
      .slice()
      .reverse()
      .map((e) => ({ role: e.role, content: e.content }))

    // Route to model
    const replyText = await router.chat(messages, { model })

    // Persist assistant reply
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      content: replyText,
      timestamp: Date.now(),
    })

    return reply.send({ sessionId, reply: replyText })
  })
}
