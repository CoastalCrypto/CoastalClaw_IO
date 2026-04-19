import type { FastifyInstance } from 'fastify'
import type { SocketStream } from '@fastify/websocket'
import type Database from 'better-sqlite3'
import { eventBus } from '../../events/bus.js'
import type { AgentEvent } from '../../events/types.js'
import type { AgentRegistry } from '../../agents/registry.js'
import type { ChannelManager } from '../../channels/manager.js'

const TOOL_EDGE_DEFAULT_WEIGHT = 0.18  // unused tools still visible but faint
const NON_TOOL_EDGE_WEIGHT = 0.5       // agent→model and agent→channel are config edges
const RECENCY_HALF_LIFE_DAYS = 14      // weight halves every 14 days of inactivity

/**
 * Build a per-(agent, tool) usage map from the action_log.
 * Returns count and last-use timestamp so the caller can compute a
 * recency-decayed weight. Returns an empty map if the table doesn't exist
 * yet (fresh install).
 */
function readToolEdgeUsage(db: Database.Database): Map<string, { count: number; lastAt: number }> {
  const usage = new Map<string, { count: number; lastAt: number }>()
  try {
    const rows = db.prepare(`
      SELECT agent_id, tool_name, COUNT(*) AS cnt, MAX(created_at) AS last_at
      FROM action_log
      GROUP BY agent_id, tool_name
    `).all() as Array<{ agent_id: string; tool_name: string; cnt: number; last_at: number }>
    for (const r of rows) {
      usage.set(`${r.agent_id}->tool:${r.tool_name}`, { count: r.cnt, lastAt: r.last_at })
    }
  } catch { /* fresh install — table not yet created */ }
  return usage
}

/**
 * Compute an edge's weight in [WEIGHT_FLOOR, 1] from its raw use count and
 * the most globally-active edge's count. Recency decays exponentially with
 * a 14-day half-life so dormant connections fade visually without vanishing.
 */
function computeEdgeWeight(count: number, lastAt: number, maxCount: number, now: number): number {
  if (count === 0 || maxCount === 0) return TOOL_EDGE_DEFAULT_WEIGHT
  // Log-normalized so a few highly-used edges don't crush the long tail
  const useScore = Math.log(1 + count) / Math.log(1 + maxCount)
  const ageDays = (now - lastAt) / (1000 * 60 * 60 * 24)
  const recency = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS)
  const combined = useScore * 0.6 + recency * 0.4
  return Math.max(TOOL_EDGE_DEFAULT_WEIGHT, Math.min(1, combined))
}

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

function buildSnapshot(registry: AgentRegistry, channelManager: ChannelManager, db: Database.Database) {
  const allAgents = registry.listAll()
  const channels = channelManager.list()
  const now = Date.now()
  const usage = readToolEdgeUsage(db)
  const maxCount = Array.from(usage.values()).reduce((m, v) => Math.max(m, v.count), 0)

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

  // Build edges with weights derived from actual interaction history.
  // agent→tool weights come from action_log aggregates; agent→model/channel
  // are configuration edges and get a fixed mid weight so they always render.
  const edges: Array<{ id: string; source: string; target: string; label: string; active: boolean; edgeType: string; weight: number; lastUsedAt: number | null }> = []

  for (const a of allAgents) {
    // Agent → tools
    for (const t of a.tools) {
      const id = `${a.id}->tool:${t}`
      const u = usage.get(id)
      const weight = u ? computeEdgeWeight(u.count, u.lastAt, maxCount, now) : TOOL_EDGE_DEFAULT_WEIGHT
      edges.push({
        id, source: a.id, target: `tool:${t}`,
        label: 'uses', active: false, edgeType: 'agent-tool',
        weight,
        lastUsedAt: u?.lastAt ?? null,
      })
    }
    // Agent → model
    const modelId = a.modelPref ? `model:${a.modelPref}` : 'model:ollama:default'
    if (modelSet.has(a.modelPref ?? '') || !a.modelPref) {
      edges.push({
        id: `${a.id}->${modelId}`, source: a.id, target: modelId,
        label: 'runs on', active: false, edgeType: 'agent-model',
        weight: NON_TOOL_EDGE_WEIGHT, lastUsedAt: null,
      })
    }
    // Agent → channels (active agents broadcast to all enabled channels)
    if (a.active) {
      for (const c of channels) {
        if (c.enabled) {
          edges.push({
            id: `${a.id}->channel:${c.id}`, source: a.id, target: `channel:${c.id}`,
            label: 'outputs to', active: false, edgeType: 'agent-channel',
            weight: NON_TOOL_EDGE_WEIGHT, lastUsedAt: null,
          })
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
  opts: { registry: AgentRegistry; channelManager: ChannelManager; db: Database.Database; validateSession: (token: string) => boolean }
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
        const snapshot = buildSnapshot(opts.registry, opts.channelManager, opts.db)
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
