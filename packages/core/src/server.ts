import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { healthRoutes } from './api/routes/health.js'
import type { Config } from './config.js'

export async function buildServer(config: Pick<Config, 'port' | 'host'>) {
  const fastify = Fastify({ logger: false })

  await fastify.register(cors, { origin: true })
  await fastify.register(websocket)
  await fastify.register(healthRoutes)

  return fastify
}
