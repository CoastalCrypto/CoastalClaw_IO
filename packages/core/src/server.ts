import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import { wsRoutes } from './api/routes/ws.js'
import { chatRoutes } from './api/routes/chat.js'
import { adminRoutes, getOrCreateAdminToken, validateSessionToken } from './api/routes/admin.js'
import { agentRoutes } from './api/routes/agents.js'
import { teamRoutes } from './api/routes/team.js'
import { AgentRegistry } from './agents/registry.js'
import { PermissionGate } from './agents/permission-gate.js'
import { loadConfig } from './config.js'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { timingSafeEqual } from 'node:crypto'

export async function buildServer() {
  const fastify = Fastify({ logger: false })
  const config = loadConfig()

  // Root-level admin auth — applies to ALL /api/admin/* routes across all plugins
  const adminToken = getOrCreateAdminToken(config.dataDir)
  fastify.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/admin')) return
    if (req.url === '/api/admin/login') return

    const rawHeader = req.headers['x-admin-token'] ?? ''
    const raw = typeof rawHeader === 'string' ? rawHeader : rawHeader[0] ?? ''
    if (raw) {
      const a = Buffer.from(raw, 'utf8')
      const b = Buffer.from(adminToken, 'utf8')
      if (a.length === b.length && timingSafeEqual(a, b)) return
    }

    const sessionHeader = req.headers['x-admin-session'] ?? ''
    const session = typeof sessionHeader === 'string' ? sessionHeader : sessionHeader[0] ?? ''
    if (session && validateSessionToken(adminToken, session)) return

    return reply.status(401).send({ error: 'Unauthorized' })
  })

  const allowedOrigins = process.env.CC_CORS_ORIGINS?.split(',').map(o => o.trim())
    ?? ['http://localhost:5173', 'http://127.0.0.1:5173']
  await fastify.register(cors, { origin: allowedOrigins })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)
  await fastify.register(wsRoutes)
  await fastify.register(chatRoutes)
  await fastify.register(adminRoutes)

  const db = new Database(join(config.dataDir, 'coastal-claw.db'))
  const agentRegistry = new AgentRegistry(join(config.dataDir, 'agents.db'))
  const gate = new PermissionGate(db)

  await fastify.register(agentRoutes, { registry: agentRegistry, gate })
  await fastify.register(teamRoutes)

  fastify.addHook('onClose', async () => {
    agentRegistry.close()
    db.close()
  })

  return fastify
}
