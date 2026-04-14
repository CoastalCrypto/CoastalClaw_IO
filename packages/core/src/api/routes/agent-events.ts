import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'
import type { AgentRegistry } from '../../agents/registry.js'

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
  if (event.type === 'graph_edge') {
    return { type: 'graph_edge', source: event.source, target: event.target, edgeType: event.edgeType }
  }
  return null
}

export async function agentEventsRoute(
  app: FastifyInstance,
  opts: { registry: AgentRegistry; validateSession: (token: string) => boolean }
) {
  app.get('/ws/agent-events', { websocket: true }, (connection: SocketStream, req) => {
    // Browsers cannot set custom headers on WebSocket upgrades, so the session
    // token is accepted either via the x-admin-session header (server-side clients)
    // or via the ?token= query parameter (browser clients).
    const sessionHeader = req.headers['x-admin-session']
    const headerToken = typeof sessionHeader === 'string' ? sessionHeader : (Array.isArray(sessionHeader) ? sessionHeader[0] : '')
    const queryToken = (req.query as Record<string, string>)?.token ?? ''
    const token = headerToken || queryToken
    if (!token || !opts.validateSession(token)) {
      console.warn(`[ws/agent-events] 1008 Unauthorized — token ${token ? `present (prefix=${token.slice(0,3)}, len=${token.length})` : 'missing'}`)
      connection.socket.close(1008, 'Unauthorized')
      return
    }
    const socket = connection.socket

    // Send initial state
    const allAgents = opts.registry.listAll()
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify({
        type: 'snapshot',
        nodes: allAgents.map(a => ({
          id: a.id,
          label: a.name,
          role: a.role,
          status: a.active ? 'idle' : 'offline',
          toolsCount: a.tools.length,
        })),
        edges: [],
      }))
    }

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
