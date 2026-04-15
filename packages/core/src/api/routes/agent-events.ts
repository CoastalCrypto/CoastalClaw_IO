import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'
import type { AgentRegistry } from '../../agents/registry.js'
import type { ChannelManager } from '../../channels/manager.js'

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
    return { type: 'graph_edge', ts: Date.now(), source: event.source, target: event.target, edgeType: event.edgeType }
  }
  return null
}

function buildSnapshot(registry: AgentRegistry, channelManager: ChannelManager) {
  const allAgents = registry.listAll()
  const channels = channelManager.list()

  // Collect unique tools and models across all active agents
  const toolSet = new Map<string, { label: string; category: string }>()
  const modelSet = new Map<string, string>() // id → display name

  for (const a of allAgents) {
    for (const t of a.tools) {
      if (!toolSet.has(t)) {
        const cat = t.startsWith('memory_') ? 'Memory'
          : t.startsWith('git_') ? 'Git'
          : t === 'run_command' ? 'Shell'
          : t === 'query_db' ? 'Database'
          : t === 'http_get' ? 'Web'
          : t.includes('_') ? 'MCP' : 'File'
        toolSet.set(t, { label: t, category: cat })
      }
    }
    if (a.modelPref) modelSet.set(a.modelPref, a.modelPref)
  }
  if (modelSet.size === 0) modelSet.set('ollama:default', 'Ollama (default)')

  // Build nodes (without positions, let frontend handle layout)
  const agentNodes = allAgents.map((a) => ({
    id: a.id,
    label: a.name,
    role: a.role,
    status: a.active ? 'idle' : 'offline',
    toolsCount: a.tools.length,
    nodeType: 'agent' as const,
  }))

  const toolNodes = Array.from(toolSet.entries()).map(([id, t]) => ({
    id: `tool:${id}`,
    label: t.label,
    role: t.category,
    status: 'idle' as const,
    toolsCount: 0,
    nodeType: 'tool' as const,
  }))

  const modelNodes = Array.from(modelSet.entries()).map(([id, name]) => ({
    id: `model:${id}`,
    label: name,
    role: 'Model',
    status: 'idle' as const,
    toolsCount: 0,
    nodeType: 'model' as const,
  }))

  const channelNodes = channels.map((c) => ({
    id: `channel:${c.id}`,
    label: c.name,
    role: c.type,
    status: (c.enabled ? 'idle' : 'offline') as 'idle' | 'offline',
    toolsCount: 0,
    nodeType: 'channel' as const,
  }))

  // Build static edges
  const edges: Array<{ id: string; source: string; target: string; label: string; active: boolean; edgeType: string }> = []

  for (const a of allAgents) {
    // Agent → tools
    for (const t of a.tools) {
      edges.push({ id: `${a.id}->tool:${t}`, source: a.id, target: `tool:${t}`, label: 'uses', active: false, edgeType: 'agent-tool' })
    }
    // Agent → model
    const modelId = a.modelPref ? `model:${a.modelPref}` : 'model:ollama:default'
    if (modelSet.has(a.modelPref ?? '') || !a.modelPref) {
      edges.push({ id: `${a.id}->${modelId}`, source: a.id, target: modelId, label: 'runs on', active: false, edgeType: 'agent-model' })
    }
    // Agent → channels (active agents broadcast to all enabled channels)
    if (a.active) {
      for (const c of channels) {
        if (c.enabled) {
          edges.push({ id: `${a.id}->channel:${c.id}`, source: a.id, target: `channel:${c.id}`, label: 'outputs to', active: false, edgeType: 'agent-channel' })
        }
      }
    }
  }

  return {
    nodes: [...agentNodes, ...toolNodes, ...modelNodes, ...channelNodes],
    edges,
  }
}

export async function agentEventsRoute(
  app: FastifyInstance,
  opts: { registry: AgentRegistry; channelManager: ChannelManager; validateSession: (token: string) => boolean }
) {
  app.get('/ws/agent-events', { websocket: true }, (connection: SocketStream, req) => {
    const socket = connection.socket
    let authenticated = false

    // Check header/query auth (backwards compat)
    const sessionHeader = req.headers['x-admin-session']
    const headerToken = typeof sessionHeader === 'string' ? sessionHeader : (Array.isArray(sessionHeader) ? sessionHeader[0] : '')
    const queryToken = (req.query as Record<string, string>)?.token ?? ''
    const immediateToken = headerToken || queryToken

    if (immediateToken && opts.validateSession(immediateToken)) {
      authenticated = true
    }

    // Accept auth via first message (preferred — avoids token in server logs)
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        console.warn('[ws/agent-events] 1008 Unauthorized — no auth received within timeout')
        socket.close(1008, 'Unauthorized')
      }
    }, 5000)

    const initConnection = () => {
      clearTimeout(authTimeout)
      // Send initial state with full graph
      if (socket.readyState === socket.OPEN) {
        const snapshot = buildSnapshot(opts.registry, opts.channelManager)
        socket.send(JSON.stringify({ type: 'snapshot', ...snapshot }))
      }
    }

    // Handle first-message auth
    socket.once('message', (raw: Buffer | string) => {
      if (authenticated) return // already authed via header/query
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
        if (msg.type === 'auth' && msg.token && opts.validateSession(msg.token)) {
          authenticated = true
          initConnection()
        } else {
          socket.close(1008, 'Unauthorized')
        }
      } catch {
        socket.close(1008, 'Unauthorized')
      }
    })

    // If already authenticated via header/query, init immediately
    if (authenticated) {
      initConnection()
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
