export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'error' | 'offline'

export interface GraphNode {
  id: string
  label: string
  status: AgentStatus
  role: string
  toolsCount: number
  lastActivity?: number
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  active: boolean
}

export interface AgentGraphState {
  nodes: GraphNode[]
  edges: GraphEdge[]
  lastUpdated: number
}

// Agent graph WebSocket events
export type AgentGraphEvent =
  | { type: 'snapshot'; nodes: GraphNode[]; edges: GraphEdge[] }
  | { type: 'node_status'; nodeId: string; status: AgentStatus }
  | { type: 'node_added'; node: GraphNode }
  | { type: 'node_removed'; nodeId: string }
  | { type: 'edge_added'; edge: GraphEdge }
  | { type: 'edge_removed'; edgeId: string }
  | { type: 'edge_active'; edgeId: string; active: boolean }
  | { type: 'graph_edge'; ts: number; source: string; target: string; edgeType: 'agent-tool' | 'agent-model' | 'agent-channel' }
  | { type: 'ping' }

// React Flow node data type — index signature required for React Flow compatibility
export interface AgentNodeData extends Record<string, unknown> {
  label: string
  status: AgentStatus
  role: string
  toolsCount: number
  lastActivity?: number
}
