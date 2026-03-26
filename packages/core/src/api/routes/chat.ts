import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { loadConfig } from '../../config.js'
import { randomUUID } from 'node:crypto'

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

  fastify.addHook('onClose', async () => {
    await memory.close()
    router.close()
  })

  fastify.post<{
    Body: { sessionId?: string; message: string; model?: string }
  }>('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          sessionId: { type: 'string', maxLength: 128, pattern: '^[a-zA-Z0-9_-]+$' },
          message: { type: 'string', minLength: 1, maxLength: 8192 },
          model: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { message, model } = req.body
    const sessionId = req.body.sessionId ?? randomUUID()

    // Get history first (before persisting user message, to avoid including it)
    const history = await memory.queryHistory({ sessionId, limit: 20 })
    // Flush entries beyond the context window to mem0 (fire-and-forget)
    memory.flushOldEntries(sessionId, 20).catch(() => {})
    const messages = history
      .slice()
      .reverse()
      .map((e) => ({ role: e.role, content: e.content }))
    messages.push({ role: 'user', content: message })

    // Route to model — cascade router classifies the message
    const { reply: replyText, decision } = await router.chat(messages, { model })
    const retention = decision.signals.retention

    // Persist user message with retention signal from tiny-router
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }, retention)

    // Assistant replies always persisted
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      content: replyText,
      timestamp: Date.now(),
    }, 'useful')

    return reply.send({ sessionId, reply: replyText })
  })
}
