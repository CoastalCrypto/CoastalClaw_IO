import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import { wsRoutes } from './api/routes/ws.js'
import { chatRoutes } from './api/routes/chat.js'
import { adminRoutes } from './api/routes/admin.js'
import { agentRoutes } from './api/routes/agents.js'
import { AgentRegistry } from './agents/registry.js'
import { PermissionGate } from './agents/permission-gate.js'
import { loadConfig } from './config.js'
import Database from 'better-sqlite3'
import { join } from 'node:path'

export async function buildServer() {
  const fastify = Fastify({ logger: false })
  const config = loadConfig()

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

  fastify.addHook('onClose', async () => {
    agentRegistry.close()
    db.close()
  })

  return fastify
}
