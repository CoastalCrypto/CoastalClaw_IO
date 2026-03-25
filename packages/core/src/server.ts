import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import { wsRoutes } from './api/routes/ws.js'
import { chatRoutes } from './api/routes/chat.js'
import { adminRoutes } from './api/routes/admin.js'

export async function buildServer() {
  const fastify = Fastify({ logger: false })

  // TODO: restrict CORS origins before any network-exposed deployment
  await fastify.register(cors, { origin: true })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)
  await fastify.register(wsRoutes)
  await fastify.register(chatRoutes)
  await fastify.register(adminRoutes)

  return fastify
}
