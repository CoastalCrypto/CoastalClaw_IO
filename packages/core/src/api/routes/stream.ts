import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { AgentRegistry } from '../../agents/registry.js'
import { AgentSession } from '../../agents/session.js'
import { AgenticLoop } from '../../agents/loop.js'
import { PermissionGate } from '../../agents/permission-gate.js'
import { ActionLog } from '../../agents/action-log.js'
import { ToolRegistry } from '../../tools/registry.js'
import { createBackend } from '../../tools/backends/index.js'
import { PersonaManager } from '../../persona/manager.js'
import { loadConfig } from '../../config.js'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

export async function streamRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.agentWorkdir, { recursive: true })

  const db = new Database(join(config.dataDir, 'coastal-claw.db'))
  const router = new ModelRouter({ ollamaUrl: config.ollamaUrl, vllmUrl: config.vllmUrl, airllmUrl: config.airllmUrl, defaultModel: config.defaultModel })
  const memory = new UnifiedMemory({ dataDir: config.dataDir, mem0ApiKey: config.mem0ApiKey })
  const agentRegistry = new AgentRegistry(join(config.dataDir, 'agents.db'))
  const backend = await createBackend(config.agentTrustLevel, [config.agentWorkdir])
  const toolRegistry = new ToolRegistry(backend)
  const gate = new PermissionGate(db)
  const log = new ActionLog(db)
  const personaMgr = new PersonaManager(join(config.dataDir, 'persona.db'))

  // POST /api/chat/stream — SSE streaming chat
  fastify.post<{
    Body: { message: string; sessionId?: string; images?: string[] }
  }>('/api/chat/stream', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 8192 },
          sessionId: { type: 'string' },
          images: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        },
      },
    },
  }, async (req, reply) => {
    const { message, images } = req.body
    const sessionId = req.body.sessionId ?? randomUUID()

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')

    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const history = await memory.queryHistory({ sessionId, limit: 20 })
      const messages = history.slice().reverse().map(e => ({ role: e.role as any, content: e.content }))

      const decision = await router.cascade.route(message)
      write('domain', { domain: decision.domain })

      const agent = agentRegistry.getByDomain(decision.domain) ?? agentRegistry.get('general')!
      const toolDefs = toolRegistry.getDefinitionsFor(agent.tools)
      const session = new AgentSession(agent, toolDefs, personaMgr.get())

      const onApprovalNeeded = (approvalId: string, agentName: string, toolName: string, cmd: string) => {
        write('approval', { approvalId, agentName, toolName, cmd })
      }

      const onToken = (token: string) => {
        write('token', { token })
      }

      const loop = new AgenticLoop(router.ollama, toolRegistry, gate, log, onApprovalNeeded, undefined, onToken)
      const result = await loop.run(session, message, sessionId, messages, undefined, undefined, images)

      // If there was no streaming (content came back non-empty without onToken),
      // send the full reply as a single flush
      if (result.reply && !result.reply.startsWith('\n\n[')) {
        // Check if we already streamed (onToken was called); if not, send now
        write('reply', { reply: result.reply, domain: result.domain })
      }

      await memory.write({ id: randomUUID(), sessionId, role: 'user', content: message, timestamp: Date.now() }, decision.signals.retention)
      await memory.write({ id: randomUUID(), sessionId, role: 'assistant', content: result.reply, timestamp: Date.now() }, 'useful')

      // Upsert session title
      const title = message.slice(0, 80).replace(/\s+/g, ' ').trim()
      fetch(`http://127.0.0.1:${config.port}/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }).catch(() => {})

      write('done', { sessionId, domain: result.domain })
    } catch (e: unknown) {
      write('error', { message: e instanceof Error ? e.message : String(e) })
    } finally {
      reply.raw.end()
    }

    return reply
  })

  fastify.addHook('onClose', async () => {
    agentRegistry.close()
    db.close()
    personaMgr.close()
  })
}
