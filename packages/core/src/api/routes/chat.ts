import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { AgentRegistry } from '../../agents/registry.js'
import { AgentSession } from '../../agents/session.js'
import { AgenticLoop } from '../../agents/loop.js'
import { PermissionGate } from '../../agents/permission-gate.js'
import { ActionLog } from '../../agents/action-log.js'
import { SkillGapsLog } from '../../agents/skill-gaps.js'
import { ToolRegistry } from '../../tools/registry.js'
import { createBackend } from '../../tools/backends/index.js'
import { BrowserSessionManager } from '../../tools/browser/session-manager.js'
import { McpAdapter } from '../../tools/mcp/adapter.js'
import { loadConfig } from '../../config.js'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join as pathJoin } from 'node:path'

export async function chatRoutes(fastify: FastifyInstance) {
  const config = loadConfig()

  // Ensure data dir and workspace exist
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.agentWorkdir, { recursive: true })

  const db = new Database(pathJoin(config.dataDir, 'coastal-claw.db'))
  const router = new ModelRouter({ ollamaUrl: config.ollamaUrl, vllmUrl: config.vllmUrl, defaultModel: config.defaultModel })
  const memory = new UnifiedMemory({ dataDir: config.dataDir, mem0ApiKey: config.mem0ApiKey })
  const agentRegistry = new AgentRegistry(pathJoin(config.dataDir, 'agents.db'))
  const backend = await createBackend(config.agentTrustLevel, [config.agentWorkdir])
  const browserManager = config.agentTrustLevel !== 'sandboxed'
    ? new BrowserSessionManager()
    : undefined
  const toolRegistry = new ToolRegistry(backend, browserManager)
  const gate = new PermissionGate(db)
  const log = new ActionLog(db)
  const skillGaps = new SkillGapsLog(config.dataDir)

  // Pass only PATH to MCP subprocesses — never expose secrets via process.env
  const mcpEnv: Record<string, string> = { PATH: process.env.PATH ?? '' }
  const mcpThinking = new McpAdapter(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['@modelcontextprotocol/server-sequential-thinking@2025.12.18'],
    mcpEnv,
    'logic'
  )
  const mcpMemory = new McpAdapter(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['@modelcontextprotocol/server-memory@2026.1.26'],
    mcpEnv,
    'memory'
  )
  mcpThinking.connect(toolRegistry).catch(e => console.error('MCP Thinking failed', e))
  mcpMemory.connect(toolRegistry).catch(e => console.error('MCP Memory failed', e))

  fastify.addHook('onClose', async () => {
    await memory.close()
    router.close()
    agentRegistry.close()
    db.close()
    skillGaps.close()
    await mcpThinking.close()
    await mcpMemory.close()
    await browserManager?.closeAll()
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

    const history = await memory.queryHistory({ sessionId, limit: 20 })
    memory.flushOldEntries(sessionId, 20).catch(() => {})
    const messages = history.slice().reverse().map(e => ({ role: e.role as any, content: e.content }))

    // Classify domain via CascadeRouter
    const decision = await router.cascade.route(message)
    const agent = agentRegistry.getByDomain(decision.domain) ?? agentRegistry.get('general')!
    const toolDefs = toolRegistry.getDefinitionsFor(agent.tools)
    const session = new AgentSession(agent, toolDefs)

    // Pending approval callback — sends WS event to client
    const pendingApprovals = new Map<string, string>()
    const onApprovalNeeded = (approvalId: string, agentName: string, toolName: string, cmd: string) => {
      pendingApprovals.set(approvalId, toolName)
      fastify.websocketServer?.clients.forEach((client: any) => {
        if (client._sessionId === sessionId) {
          client.send(JSON.stringify({ type: 'approval_request', approvalId, agentName, toolName, cmd }))
        }
      })
    }

    const loop = new AgenticLoop(router.ollama, toolRegistry, gate, log, onApprovalNeeded, skillGaps)
    const result = await loop.run(session, message, sessionId, messages)

    await memory.write({ id: randomUUID(), sessionId, role: 'user', content: message, timestamp: Date.now() }, decision.signals.retention)
    await memory.write({ id: randomUUID(), sessionId, role: 'assistant', content: result.reply, timestamp: Date.now() }, 'useful')

    // START PREDICTIVE THREAD
    setTimeout(async () => {
      try {
        const predictiveAgent = agentRegistry.get('general')!
        const predSession = new AgentSession(predictiveAgent, toolDefs)
        const prompt = `Based on the latest user message "${message}" and your reply "${result.reply}", proactively predict the single most helpful next action or follow-up question the user might need. Respond ONLY with a short, actionable phrasing (max 6 words). Do not execute tools. Just provide the suggestion string.`
        const predLoop = new AgenticLoop(router.ollama, toolRegistry, gate, log, onApprovalNeeded)
        const pResult = await predLoop.run(predSession, prompt, sessionId, [])
        fastify.websocketServer?.clients.forEach((client: any) => {
          if (client._sessionId === sessionId || !client._sessionId) {
            client.send(JSON.stringify({ type: 'proactive_suggestion', suggestion: pResult.reply, sessionId }))
          }
        })
      } catch (e) {
        console.error('Prediction failed', e)
      }
    }, 1000)

    return reply.send({ sessionId, reply: result.reply, domain: result.domain })
  })
}
