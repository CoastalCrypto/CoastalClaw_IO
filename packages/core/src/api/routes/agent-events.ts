import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'

// Translate internal agent events to graph events
function toGraphEvent(event: AgentEvent): Record<string, unknown> | null {
  if (event.type === 'session_start') {
    return { type: 'node_status', nodeId: event.agentId, status: 'thinking' }
  }
  if (event.type === 'session_complete') {
    return { type: 'node_status', nodeId: event.agentId, status: 'idle' }
  }
  if (event.type === 'tool_call_start') {
    return { type: 'node_status', nodeId: event.agentId, status: 'executing' }
  }
  if (event.type === 'tool_call_end') {
    return { type: 'node_status', nodeId: event.agentId, status: 'idle' }
  }
  return null
}

export async function agentEventsRoute(app: FastifyInstance) {
  app.get('/ws/agent-events', { websocket: true }, (connection: SocketStream) => {
    const socket = connection.socket

    // Ping-pong keepalive
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30_000)

    // Subscribe to agent events
    const listener = (event: AgentEvent) => {
      const graphEvent = toGraphEvent(event)
      if (graphEvent && socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(graphEvent))
      }
    }

    eventBus.onAgent(listener)

    socket.on('close', () => {
      clearInterval(pingInterval)
      eventBus.offAgent(listener)
    })

    socket.on('error', () => {
      socket.close()
    })
  })
}
