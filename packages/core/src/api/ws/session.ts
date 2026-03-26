import type { FastifyRequest } from 'fastify'
import type { SocketStream } from '@fastify/websocket'

// @fastify/websocket v8 passes a SocketStream; the raw WebSocket is at connection.socket
export function handleSessionWs(connection: SocketStream, _req: FastifyRequest) {
  const socket = connection.socket
  socket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'register' && typeof msg.sessionId === 'string') {
        ;(socket as any)._sessionId = msg.sessionId
        return
      }
      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
      }
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid json' }))
    }
  })
}
