import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import { handleSessionWs } from '../ws/session.js'

export async function wsRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/session', { websocket: true }, (connection: SocketStream, req: FastifyRequest) => {
    handleSessionWs(connection, req)
  })
}
