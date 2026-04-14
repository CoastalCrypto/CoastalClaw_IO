import { useMemo, useState, useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NavBar, type NavPage } from '../components/NavBar'
import { AgentNode } from '../components/AgentNode'
import { useAgentGraph } from '../hooks/useAgentGraph'
import type { AgentNodeData } from '../types/agent-graph'

const NODE_TYPES = { agent: AgentNode }

const MINIMAP_STYLE = {
  background: '#0a1628',
  border: '1px solid rgba(0,229,255,0.15)',
  borderRadius: 8,
}

export function AgentGraph({ onNav }: { onNav: (page: NavPage) => void }) {
  const { nodes: rawNodes, edges: rawEdges, connected } = useAgentGraph()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Edge color by type (active always wins with cyan glow)
  const edgeStroke = useCallback((e: (typeof rawEdges)[number]) => {
    if (e.active) return '#00e5ff'
    if (e.edgeType === 'agent-tool') return '#10b981'
    if (e.edgeType === 'agent-model') return '#8b5cf6'
    if (e.edgeType === 'agent-channel') return '#f59e0b'
    return '#1a3a5c'
  }, [])

  // Convert to React Flow node/edge format
  const rfNodes: Node<AgentNodeData>[] = useMemo(() =>
    rawNodes.map((n, i) => ({
      id: n.id,
      type: 'agent',
      // Use server-provided position when available, fall back to grid layout
      position: n.position ?? { x: (i % 4) * 180 + 60, y: Math.floor(i / 4) * 160 + 60 },
      data: {
        label: n.label,
        status: n.status,
        role: n.role,
        toolsCount: n.toolsCount,
        nodeType: n.nodeType,
        lastActivity: n.lastActivity,
      },
      selected: n.id === selectedId,
    })), [rawNodes, selectedId])

  const rfEdges: Edge[] = useMemo(() =>
    rawEdges.map(e => {
      const stroke = edgeStroke(e)
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        style: {
          stroke,
          strokeWidth: e.active ? 2 : 1,
          strokeDasharray: e.active ? undefined : '4 3',
        },
        animated: e.active,
      }
    }), [rawEdges, edgeStroke])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId(id => id === node.id ? null : node.id)
  }, [])

  const selectedNode = selectedId ? rawNodes.find(n => n.id === selectedId) : null

  return (
    <div className="min-h-screen" style={{ background: '#050a0f' }}>
      <NavBar page="agent-graph" onNav={onNav} />

      <div style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0 }}>
        {/* Connection status banner */}
        {!connected && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'rgba(245,158,11,0.12)',
            border: '1px solid rgba(245,158,11,0.30)',
            borderRadius: 8, padding: '6px 14px',
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#f59e0b',
          }}>
            reconnecting…
          </div>
        )}

        <ReactFlowProvider>
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={NODE_TYPES}
            onNodeClick={onNodeClick}
            fitView
            style={{ background: '#050a0f' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1}
              color="rgba(0,229,255,0.08)"
            />
            <Controls style={{ background: '#0d1f33', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 8 }} />
            <MiniMap
              style={MINIMAP_STYLE}
              nodeColor={(n) => {
                const s = (n.data as AgentNodeData)?.status
                if (s === 'thinking') return '#00e5ff'
                if (s === 'executing') return '#10b981'
                if (s === 'error') return '#ef4444'
                if (s === 'offline') return '#1a3a5c'
                return '#94adc4'
              }}
            />
          </ReactFlow>
        </ReactFlowProvider>

        {/* Side panel */}
        {selectedNode && (
          <div style={{
            position: 'absolute', top: 16, right: 16, width: 260,
            background: 'rgba(13,31,51,0.95)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,229,255,0.20)', borderRadius: 12,
            padding: '16px', zIndex: 10,
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#00e5ff', letterSpacing: '0.08em' }}>
                {(selectedNode.nodeType ?? 'agent').toUpperCase()} DETAILS
              </span>
              <button onClick={() => setSelectedId(null)} style={{ color: '#4a6a8a', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2f4ff', marginBottom: 4 }}>
              {selectedNode.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#94adc4', marginBottom: 10, lineHeight: 1.5 }}>
              {selectedNode.role}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedNode.nodeType === 'agent' && (
                <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#94adc4', border: '1px solid rgba(26,58,92,0.8)', background: 'rgba(10,22,40,0.6)', borderRadius: 4, padding: '2px 6px' }}>
                  {selectedNode.toolsCount} TOOLS
                </span>
              )}
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: selectedNode.status === 'offline' ? '#ef4444' : '#10b981', border: `1px solid ${selectedNode.status === 'offline' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, background: selectedNode.status === 'offline' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 4, padding: '2px 6px' }}>
                {selectedNode.status.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
