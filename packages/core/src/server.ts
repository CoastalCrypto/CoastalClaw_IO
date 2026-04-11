import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import { wsRoutes } from './api/routes/ws.js'
import { chatRoutes } from './api/routes/chat.js'
import { adminRoutes, getOrCreateAdminToken, validateSessionToken } from './api/routes/admin.js'
import { agentRoutes } from './api/routes/agents.js'
import { teamRoutes } from './api/routes/team.js'
import { personaRoutes } from './api/routes/persona.js'
import { systemRoutes } from './api/routes/system.js'
import { sessionRoutes } from './api/routes/sessions.js'
import { uploadRoutes } from './api/routes/upload.js'
import { streamRoutes } from './api/routes/stream.js'
import { pipelineRoutes } from './api/routes/pipeline.js'
import { ModelRouter } from './models/router.js'
import { ToolRegistry } from './tools/registry.js'
import { ActionLog } from './agents/action-log.js'
import { PersonaManager } from './persona/manager.js'
import { createBackend } from './tools/backends/index.js'
import { mkdirSync } from 'node:fs'
import { eventRoutes } from './api/routes/events.js'
import { analyticsRoutes } from './api/routes/analytics.js'
import { toolRoutes } from './api/routes/tools.js'
import { channelRoutes } from './api/routes/channels.js'
import { userRoutes } from './api/routes/users.js'
import { cronRoutes } from './api/routes/crons.js'
import { skillRoutes } from './api/routes/skills.js'
import { searchRoutes } from './api/routes/search.js'
import { contextRoutes } from './api/routes/context.js'
import { userModelRoutes } from './api/routes/user-model.js'
import { CronStore } from './cron/store.js'
import { CronScheduler } from './cron/scheduler.js'
import { SkillStore } from './skills/store.js'
import { ContextStore } from './context/store.js'
import { UserModelStore } from './persona/user-model.js'
import { SkillGapsLog } from './agents/skill-gaps.js'
import { PipelineStore } from './pipeline/store.js'
import { SteerQueue } from './pipeline/steer-queue.js'
import { AsyncPipelineRunner } from './pipeline/runner.js'
import { UnifiedMemory } from './memory/index.js'
import { UserStore } from './users/store.js'
import { AgentRegistry } from './agents/registry.js'
import { PermissionGate } from './agents/permission-gate.js'
import { CustomToolLoader } from './tools/custom/loader.js'
import { ChannelManager } from './channels/manager.js'
import { loadConfig } from './config.js'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { timingSafeEqual } from 'node:crypto'

export async function buildServer() {
  const fastify = Fastify({ logger: false })
  const config = loadConfig()

  // Root-level admin auth — applies to ALL /api/admin/* routes across all plugins
  const adminToken = getOrCreateAdminToken(config.dataDir)
  // UserStore is created here so the auth hook can reference it for user session tokens.
  // It is also passed to userRoutes below.
  const db = new Database(join(config.dataDir, 'coastal-claw.db'))
  const userStore = new UserStore(db, adminToken)

  fastify.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/admin')) return
    if (req.url === '/api/admin/login') return

    // 1. Raw admin token (legacy / CLI usage)
    const rawHeader = req.headers['x-admin-token'] ?? ''
    const raw = typeof rawHeader === 'string' ? rawHeader : rawHeader[0] ?? ''
    if (raw) {
      const a = Buffer.from(raw, 'utf8')
      const b = Buffer.from(adminToken, 'utf8')
      if (a.length === b.length && timingSafeEqual(a, b)) return
    }

    const sessionHeader = req.headers['x-admin-session'] ?? ''
    const session = typeof sessionHeader === 'string' ? sessionHeader : sessionHeader[0] ?? ''
    if (session) {
      // 2. Legacy admin session token (issued by /api/admin/login)
      if (validateSessionToken(adminToken, session)) return
      // 3. User session token (issued by /api/auth/login) — admin role required
      const claims = userStore.verifySessionToken(session)
      if (claims?.role === 'admin') return
    }

    return reply.status(401).send({ error: 'Unauthorized' })
  })

  const allowedOrigins = process.env.CC_CORS_ORIGINS?.split(',').map(o => o.trim())
    ?? ['http://localhost:5173', 'http://127.0.0.1:5173']
  await fastify.register(cors, { origin: allowedOrigins })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)
  await fastify.register(wsRoutes)
  await fastify.register(adminRoutes)

  const agentRegistry = new AgentRegistry(join(config.dataDir, 'agents.db'))
  const gate = new PermissionGate(db)
  const customToolLoader = new CustomToolLoader(db)
  const channelManager = new ChannelManager(db)

  await fastify.register(agentRoutes, { registry: agentRegistry, gate })
  await fastify.register(teamRoutes)
  await fastify.register(personaRoutes, { registry: agentRegistry })
  await fastify.register(systemRoutes)
  await fastify.register(sessionRoutes)
  await fastify.register(uploadRoutes)
  await fastify.register(chatRoutes)
  await fastify.register(streamRoutes)

  // Pipeline: needs its own instances of shared infrastructure
  mkdirSync(config.dataDir, { recursive: true })
  mkdirSync(config.agentWorkdir, { recursive: true })
  const pipelineRouter = new ModelRouter({ ollamaUrl: config.ollamaUrl, vllmUrl: config.vllmUrl, airllmUrl: config.airllmUrl, defaultModel: config.defaultModel })
  const pipelineBackend = await createBackend(config.agentTrustLevel, [config.agentWorkdir])
  const pipelineToolRegistry = new ToolRegistry(pipelineBackend)
  const pipelineLog = new ActionLog(db)
  const pipelinePersonaMgr = new PersonaManager(join(config.dataDir, 'persona.db'))
  const pipelineStore = new PipelineStore(db)
  const steerQueue = new SteerQueue()
  const asyncRunner = new AsyncPipelineRunner(
    agentRegistry, pipelineRouter, pipelineToolRegistry, gate, pipelineLog, pipelinePersonaMgr, steerQueue,
  )
  await fastify.register(pipelineRoutes, {
    registry: agentRegistry,
    router: pipelineRouter,
    toolRegistry: pipelineToolRegistry,
    gate,
    log: pipelineLog,
    personaMgr: pipelinePersonaMgr,
    steerQueue,
    pipelineStore,
    runner: asyncRunner,
  })

  await fastify.register(eventRoutes)
  await fastify.register(analyticsRoutes, { db })
  await fastify.register(toolRoutes, { loader: customToolLoader })
  await fastify.register(channelRoutes, { manager: channelManager })
  await fastify.register(userRoutes, { store: userStore })

  const cronStore = new CronStore(db)
  const cronScheduler = new CronScheduler(cronStore, async (agentId, task) => {
    const res = await fetch(`http://127.0.0.1:${config.port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: task, sessionId: `cron_${agentId}_${Date.now()}` }),
    })
    const data = await res.json() as any
    return data.reply ?? JSON.stringify(data)
  })
  await fastify.register(cronRoutes, { store: cronStore, scheduler: cronScheduler })

  const skillStore = new SkillStore(db)
  skillStore.seedDefaults()
  const skillGaps = new SkillGapsLog(config.dataDir)
  const contextStore = new ContextStore(db)
  const userModelStore = new UserModelStore(db)
  const searchMemory = new UnifiedMemory({ dataDir: config.dataDir })

  await fastify.register(skillRoutes, { store: skillStore, router: pipelineRouter, gaps: skillGaps })
  await fastify.register(searchRoutes, { memory: searchMemory })
  await fastify.register(contextRoutes, { store: contextStore })
  await fastify.register(userModelRoutes, { store: userModelStore })

  fastify.addHook('onReady', async () => {
    cronScheduler.start()
  })

  fastify.addHook('onClose', async () => {
    cronScheduler.stop()
    agentRegistry.close()
    pipelinePersonaMgr.close()
    pipelineRouter.close()
    db.close()
  })

  return fastify
}
