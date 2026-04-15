// @ts-nocheck
import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceX,
  forceY,
  forceRadial,
} from 'd3-force'
import '@xyflow/react/dist/style.css'
import { NavBar, type NavPage } from '../components/NavBar'
import { AgentNode } from '../components/AgentNode'
import { useAgentGraph } from '../hooks/useAgentGraph'
import { useAgentDependencies } from '../hooks/useAgentDependencies'
import type { AgentNodeData } from '../types/agent-graph'

const NODE_TYPES = { agent: AgentNode }

const MINIMAP_STYLE = {
  background: '#0a1628',
  border: '1px solid rgba(0,229,255,0.15)',
  borderRadius: 8,
}

// Helper for edge coloring
const getEdgeStroke = (edgeType: string | undefined, active: boolean) => {
  if (active) return '#00e5ff'
  if (edgeType === 'agent-tool') return '#10b981'
  if (edgeType === 'agent-model') return '#8b5cf6'
  if (edgeType === 'agent-channel') return '#f59e0b'
  return '#1a3a5c'
}

export function AgentGraph({ onNav }: { onNav: (page: NavPage) => void }) {
  const { nodes: rawNodes, edges: rawEdges, connected } = useAgentGraph()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { dependencies, impact, isLoading } = useAgentDependencies(selectedId)

  // Simulation state
  const simulationRef = useRef<any>(null)

  // Sync React Flow state with raw data from hook
  useEffect(() => {
    if (rawNodes.length === 0) return

    const newNodes: Node<AgentNodeData>[] = rawNodes.map((n) => {
      const existingNode = nodes.find((en) => en.id === n.id)
      return {
        id: n.id,
        type: 'agent',
        position: existingNode?.position ?? { x: 400 + (Math.random() - 0.5) * 100, y: 300 + (Math.random() - 0.5) * 100 },
        data: {
          label: n.label,
          status: n.status,
          role: n.role,
          toolsCount: n.toolsCount,
          nodeType: n.nodeType,
          lastActivity: n.lastActivity,
        },
        selected: n.id === selectedId,
      }
    })

    const newEdges: Edge[] = rawEdges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      style: {
        stroke: getEdgeStroke(e.edgeType ?? '', e.active),
        strokeWidth: e.active ? 2 : 1,
        strokeDasharray: e.active ? undefined : '4 3',
      },
      animated: e.active,
    }))

    setNodes(newNodes)
    setEdges(newEdges)
  }, [rawNodes, rawEdges, selectedId])

  // Organic Brain-like Force Directed Layout (No Grid, Round flow)
  useEffect(() => {
    if (nodes.length === 0) return

    // Get viewport dimensions for responsive layout
    const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400
    const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 300

    // Create force simulation
    const simulationNodes: any[] = nodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
    }))

    const simulationLinks = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }))

    const sim = forceSimulation(simulationNodes)
      .force('link', forceLink(simulationLinks).id((d: any) => d.id).distance(100).strength(0.7))
      .force('charge', forceManyBody().strength(-600)) // Stronger repulsion for spreading
      .force('center', forceCenter(centerX, centerY))
      .force('radial', forceRadial(200, centerX, centerY).strength(0.1)) // Pull into a circular/organic shape
      .force('x', forceX(centerX).strength(0.02))
      .force('y', forceY(centerY).strength(0.02))
      .on('tick', () => {
        setNodes((nds) =>
          nds.map((n) => {
            const simNode = simulationNodes.find((sn) => sn.id === n.id)
            if (simNode) {
              return {
                ...n,
                position: { x: simNode.x ?? 0, y: simNode.y ?? 0 },
              }
            }
            return n
          })
        )
      })

    simulationRef.current = sim

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop()
      }
    }
  }, [nodes, edges])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId(id => id === node.id ? null : node.id)
  }, [])

  const selectedNode = selectedId ? rawNodes.find(n => n.id === selectedId) : null

  return (
    <div className="min-h-screen" style={{ background: '#050a0f' }}>
      <NavBar page="agent-graph" onNav={onNav} />

      <div style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0 }}>
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
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            style={{ background: '#050a0f' }}
            proOptions={{ hideAttribution: true }}
          >
            {/* No grid variant, background remains solid dark */}
            <Background
              variant={BackgroundVariant.Dots}
              color="transparent" 
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

        {selectedNode && (
          <div style={{
            position: 'absolute', top: 16, right: 16, width: 320, maxHeight: 'calc(100vh - 100px)',
            background: 'rgba(13,31,51,0.95)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,229,255,0.20)', borderRadius: 12,
            padding: '16px', zIndex: 10,
            fontFamily: 'Space Grotesk, sans-serif',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#00e5ff', letterSpacing: '0.08em' }}>
                {(selectedNode.nodeType ?? 'agent').toUpperCase()} ANALYSIS
              </span>
              <button onClick={() => setSelectedId(null)} style={{ color: '#4a6a8a', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2f4ff', marginBottom: 4 }}>
              {selectedNode.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 11, color: '#94adc4', marginBottom: 10, lineHeight: 1.5 }}>
              {selectedNode.role}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {selectedNode.nodeType === 'agent' && (
                <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#94adc4', border: '1px solid rgba(26,58,92,0.8)', background: 'rgba(10,22,40,0.6)', borderRadius: 4, padding: '2px 6px' }}>
                  {selectedNode.toolsCount} TOOLS
                </span>
              )}
              <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: selectedNode.status === 'offline' ? '#ef4444' : '#10b981', border: `1px solid ${selectedNode.status === 'offline' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`, background: selectedNode.status === 'offline' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', borderRadius: 4, padding: '2px 6px' }}>
                {selectedNode.status.toUpperCase()}
              </span>
            </div>

            {isLoading && (
              <div style={{ fontSize: 11, color: '#94adc4', fontStyle: 'italic' }}>Loading analysis…</div>
            )}

            {dependencies && (
              <>
                {/* Direct dependencies */}
                {dependencies.directDependencies && dependencies.directDependencies.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#00e5ff', marginBottom: 6, letterSpacing: '0.05em' }}>
                      DEPENDS ON ({dependencies.directDependencies.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dependencies.directDependencies.map((dep: any) => (
                        <div key={dep.id} style={{ fontSize: 9, color: '#94adc4', padding: '4px 8px', background: 'rgba(0,229,255,0.05)', borderRadius: 4 }}>
                          {dep.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dependents */}
                {dependencies.dependents && dependencies.dependents.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', marginBottom: 6, letterSpacing: '0.05em' }}>
                      DEPENDED ON BY ({dependencies.dependents.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dependencies.dependents.map((dep: any) => (
                        <div key={dep.id} style={{ fontSize: 9, color: '#94adc4', padding: '4px 8px', background: 'rgba(16,185,129,0.05)', borderRadius: 4 }}>
                          {dep.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Depth to leaf */}
                {dependencies.depthToLeaf !== undefined && (
                  <div style={{ marginBottom: 14, padding: '8px', background: 'rgba(139,92,246,0.1)', borderRadius: 4, border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 700 }}>DEPTH TO LEAF</div>
                    <div style={{ fontSize: 14, color: '#8b5cf6', fontWeight: 700 }}>{dependencies.depthToLeaf}</div>
                  </div>
                )}
              </>
            )}

            {impact && (
              <>
                {/* Impact radius */}
                {impact.totalAffected !== undefined && (
                  <div style={{ marginBottom: 14, padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: 4, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>IMPACT RADIUS</div>
                    <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 700 }}>{impact.totalAffected} agent{impact.totalAffected !== 1 ? 's' : ''}</div>
                  </div>
                )}

                {/* Direct dependents */}
                {impact.directDependents && impact.directDependents.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6, letterSpacing: '0.05em' }}>
                      DIRECT IMPACT ({impact.directDependents.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {impact.directDependents.map((dep: any) => (
                        <div key={dep.id} style={{ fontSize: 9, color: '#94adc4', padding: '4px 8px', background: 'rgba(245,158,11,0.05)', borderRadius: 4 }}>
                          {dep.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
