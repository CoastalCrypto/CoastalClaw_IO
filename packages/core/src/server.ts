import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'

export async function buildServer() {
  const fastify = Fastify({ logger: false })

  // TODO: restrict CORS origins before any network-exposed deployment
  await fastify.register(cors, { origin: true })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)

  return fastify
}
