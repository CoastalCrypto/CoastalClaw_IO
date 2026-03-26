import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import { wsRoutes } from './api/routes/ws.js'
import { chatRoutes } from './api/routes/chat.js'
import { adminRoutes } from './api/routes/admin.js'

export async function buildServer() {
  const fastify = Fastify({ logger: false })

  const allowedOrigins = process.env.CC_CORS_ORIGINS?.split(',').map(o => o.trim())
    ?? ['http://localhost:5173', 'http://127.0.0.1:5173']
  await fastify.register(cors, { origin: allowedOrigins })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)
  await fastify.register(wsRoutes)
  await fastify.register(chatRoutes)
  await fastify.register(adminRoutes)

  return fastify
}
