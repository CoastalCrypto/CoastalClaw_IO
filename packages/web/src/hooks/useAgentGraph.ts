import { useState, useEffect, useRef, useCallback } from 'react'
import type { AgentGraphState, AgentGraphEvent, GraphNode, GraphEdge } from '../types/agent-graph'

const INITIAL_STATE: AgentGraphState = { nodes: [], edges: [], lastUpdated: 0 }

// Pure reducer — exported for unit testing
export function applyEvent(state: AgentGraphState, event: AgentGraphEvent): AgentGraphState {
  switch (event.type) {
    case 'snapshot':
      return { nodes: event.nodes, edges: event.edges, lastUpdated: Date.now() }
    case 'node_status':
      return {
        ...state,
        nodes: state.nodes.map(n => n.id === event.nodeId ? { ...n, status: event.status } : n),
        lastUpdated: Date.now(),
      }
    case 'node_added':
      return { ...state, nodes: [...state.nodes, event.node], lastUpdated: Date.now() }
    case 'node_removed':
      return { ...state, nodes: state.nodes.filter(n => n.id !== event.nodeId), lastUpdated: Date.now() }
    case 'edge_added':
      return { ...state, edges: [...state.edges, event.edge], lastUpdated: Date.now() }
    case 'edge_removed':
      return { ...state, edges: state.edges.filter(e => e.id !== event.edgeId), lastUpdated: Date.now() }
    case 'edge_active':
      return {
        ...state,
        edges: state.edges.map(e => e.id === event.edgeId ? { ...e, active: event.active } : e),
        lastUpdated: Date.now(),
      }
    case 'ping':
      return state
    default:
      return state
  }
}

export function useAgentGraph() {
  const [state, setState] = useState<AgentGraphState>(INITIAL_STATE)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/agent-events`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (e) => {
      try {
        const event: AgentGraphEvent = JSON.parse(e.data as string)
        setState(prev => applyEvent(prev, event))
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [connect])

  return { ...state, connected }
}
