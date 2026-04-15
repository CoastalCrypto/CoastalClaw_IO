import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import '@xyflow/react/dist/style.css'
import { NavBar, type NavPage } from '../components/NavBar'
import { AgentNode } from '../components/AgentNode'
import { useAgentGraph } from '../hooks/useAgentGraph'
import { useAgentDependencies } from '../hooks/useAgentDependencies'
import type { AgentNodeData } from '../types/agent-graph'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const NODE_TYPES = { agent: AgentNode }

const MINIMAP_STYLE = {
  background: '#0a1628',
  border: '1px solid rgba(0,229,255,0.15)',
  borderRadius: 8,
}

const CENTER_X = 400
const CENTER_Y = 300

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SimNode extends SimulationNodeDatum {
  id: string
  x: number
  y: number
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode
  target: string | SimNode
}

interface Position {
  x: number
  y: number
}

interface DependencyItem {
  id: string
  label: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getEdgeStroke = (edgeType: string | undefined, active: boolean): string => {
  if (active) return '#00e5ff'
  if (edgeType === 'agent-tool') return '#10b981'
  if (edgeType === 'agent-model') return '#8b5cf6'
  if (edgeType === 'agent-channel') return '#f59e0b'
  return '#1a3a5c'
}

/** Build a simple fingerprint string so we can detect meaningful data changes. */
const buildFingerprint = (
  ids: readonly string[],
  edgeKeys: readonly string[],
): string => `${ids.join(',')}|${edgeKeys.join(',')}`

/* ------------------------------------------------------------------ */
/*  Error banner (reusable)                                            */
/* ------------------------------------------------------------------ */

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      fontSize: 11,
      color: '#ef4444',
      background: 'rgba(239,68,68,0.08)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 6,
      padding: '6px 10px',
      marginBottom: 10,
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {message}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Inner component — uses React Flow hooks inside the Provider        */
/* ------------------------------------------------------------------ */

function AgentGraphInner({ onNav }: { onNav: (page: NavPage) => void }) {
  const { nodes: rawNodes, edges: rawEdges, connected } = useAgentGraph()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const {
    dependencies,
    dependenciesError,
    impact,
    impactError,
    cycles: _cycles,
    cyclesError,
    isLoading,
  } = useAgentDependencies(selectedId)

  // Persistent position map — survives across renders without causing re-renders
  const positionsRef = useRef<Map<string, Position>>(new Map())

  // Simulation ref — typed properly instead of `any`
  const simulationRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Fingerprint of raw data so the simulation effect only fires on real changes
  const dataFingerprint = useMemo(
    () => buildFingerprint(
      rawNodes.map(n => n.id),
      rawEdges.map(e => e.id),
    ),
    [rawNodes, rawEdges],
  )

  // ------------------------------------------------------------------
  // Sync React Flow visual state whenever raw data or selection changes.
  // Reads positions from positionsRef (not from `nodes`), avoiding stale
  // closures and preventing infinite loops.
  // ------------------------------------------------------------------
  useEffect(() => {
    const newNodes: Node<AgentNodeData>[] = rawNodes.map((n) => {
      const saved = positionsRef.current.get(n.id)
      const position: Position = saved ?? {
        x: CENTER_X + (Math.random() - 0.5) * 100,
        y: CENTER_Y + (Math.random() - 0.5) * 100,
      }
      // Persist the initial random position so it is stable on next sync
      if (!saved) {
        positionsRef.current.set(n.id, position)
      }
      return {
        id: n.id,
        type: 'agent' as const,
        position,
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
        stroke: getEdgeStroke(e.edgeType, e.active),
        strokeWidth: e.active ? 2 : 1,
        strokeDasharray: e.active ? undefined : '4 3',
      },
      animated: e.active,
    }))

    setNodes(newNodes)
    setEdges(newEdges)
  }, [rawNodes, rawEdges, selectedId, setNodes, setEdges])

  // ------------------------------------------------------------------
  // Force simulation — depends on the data fingerprint, NOT on `nodes`
  // or `edges`. The tick callback writes to positionsRef and then uses
  // a functional updater for setNodes so it never reads stale state.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (rawNodes.length === 0) return

    // Build simulation-compatible data from raw data + saved positions
    const simNodes: SimNode[] = rawNodes.map((n) => {
      const saved = positionsRef.current.get(n.id)
      return {
        id: n.id,
        x: saved?.x ?? CENTER_X + (Math.random() - 0.5) * 100,
        y: saved?.y ?? CENTER_Y + (Math.random() - 0.5) * 100,
      }
    })

    const simLinks: SimLink[] = rawEdges.map((e) => ({
      source: e.source,
      target: e.target,
    }))

    // Tear down any previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Create fresh simulation
    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(100)
          .strength(0.7),
      )
      .force('charge', forceManyBody().strength(-600))
      .force('center', forceCenter(CENTER_X, CENTER_Y))
      .force('radial', forceRadial(200, CENTER_X, CENTER_Y).strength(0.1))
      .force('x', forceX(CENTER_X).strength(0.02))
      .force('y', forceY(CENTER_Y).strength(0.02))
      // We drive the animation loop ourselves with rAF
      .stop()

    simulationRef.current = sim

    // Animation loop — manually tick and update React Flow nodes
    const tickLoop = () => {
      sim.tick()

      // Write simulation positions into the ref (source of truth)
      const simNodesList = sim.nodes()
      for (const sn of simNodesList) {
        positionsRef.current.set(sn.id, { x: sn.x, y: sn.y })
      }

      // Update React Flow nodes via functional updater (no stale closure)
      setNodes((prev) =>
        prev.map((n) => {
          const pos = positionsRef.current.get(n.id)
          if (pos) {
            return { ...n, position: { x: pos.x, y: pos.y } }
          }
          return n
        }),
      )

      // Keep ticking while simulation has energy
      if (sim.alpha() > sim.alphaMin()) {
        animationFrameRef.current = requestAnimationFrame(tickLoop)
      } else {
        animationFrameRef.current = null
      }
    }

    // Kick off the simulation manually
    sim.alpha(1).restart().stop()
    // ^ restart() resets alpha; stop() prevents d3's internal timer.
    // We drive ticking ourselves:
    animationFrameRef.current = requestAnimationFrame(tickLoop)

    return () => {
      sim.stop()
      simulationRef.current = null
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
    // dataFingerprint captures rawNodes/rawEdges identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFingerprint, setNodes])

  // ------------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------------
  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setSelectedId((id) => (id === node.id ? null : node.id))
  }, [])

  const selectedNode = selectedId
    ? rawNodes.find((n) => n.id === selectedId) ?? null
    : null

  // Collect errors for display
  const analysisErrors: string[] = []
  if (dependenciesError) analysisErrors.push(`Dependencies: ${dependenciesError.message}`)
  if (impactError) analysisErrors.push(`Impact: ${impactError.message}`)
  if (cyclesError) analysisErrors.push(`Cycles: ${cyclesError.message}`)

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
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
            reconnecting...
          </div>
        )}

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
          <Background variant={BackgroundVariant.Dots} color="transparent" />
          <Controls style={{
            background: '#0d1f33',
            border: '1px solid rgba(0,229,255,0.15)',
            borderRadius: 8,
          }} />
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

        {selectedNode && (
          <SidebarPanel
            selectedNode={selectedNode}
            dependencies={dependencies}
            impact={impact}
            isLoading={isLoading}
            errors={analysisErrors}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sidebar Panel                                                      */
/* ------------------------------------------------------------------ */

interface SidebarPanelProps {
  selectedNode: {
    id: string
    label: string
    status: string
    role: string
    toolsCount: number
    nodeType?: string
  }
  dependencies: {
    directDependencies?: DependencyItem[]
    dependents?: DependencyItem[]
    depthToLeaf?: number
  } | null
  impact: {
    totalAffected?: number
    directDependents?: DependencyItem[]
  } | null
  isLoading: boolean
  errors: string[]
  onClose: () => void
}

function SidebarPanel({
  selectedNode,
  dependencies,
  impact,
  isLoading,
  errors,
  onClose,
}: SidebarPanelProps) {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, width: 320, maxHeight: 'calc(100vh - 100px)',
      background: 'rgba(13,31,51,0.95)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,229,255,0.20)', borderRadius: 12,
      padding: '16px', zIndex: 10,
      fontFamily: 'Space Grotesk, sans-serif',
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#00e5ff', letterSpacing: '0.08em' }}>
          {(selectedNode.nodeType ?? 'agent').toUpperCase()} ANALYSIS
        </span>
        <button
          onClick={onClose}
          style={{ color: '#4a6a8a', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
        >
          ✕
        </button>
      </div>

      {/* Node info */}
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e2f4ff', marginBottom: 4 }}>
        {selectedNode.label.toUpperCase()}
      </div>
      <div style={{ fontSize: 11, color: '#94adc4', marginBottom: 10, lineHeight: 1.5 }}>
        {selectedNode.role}
      </div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {selectedNode.nodeType === 'agent' && (
          <span style={{
            fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: '#94adc4',
            border: '1px solid rgba(26,58,92,0.8)', background: 'rgba(10,22,40,0.6)',
            borderRadius: 4, padding: '2px 6px',
          }}>
            {selectedNode.toolsCount} TOOLS
          </span>
        )}
        <span style={{
          fontSize: 9, fontFamily: 'JetBrains Mono, monospace',
          color: selectedNode.status === 'offline' ? '#ef4444' : '#10b981',
          border: `1px solid ${selectedNode.status === 'offline' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          background: selectedNode.status === 'offline' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
          borderRadius: 4, padding: '2px 6px',
        }}>
          {selectedNode.status.toUpperCase()}
        </span>
      </div>

      {/* Error display (Bug G6 fix) */}
      {errors.length > 0 && errors.map((err) => (
        <ErrorBanner key={err} message={err} />
      ))}

      {/* Loading state */}
      {isLoading && (
        <div style={{ fontSize: 11, color: '#94adc4', fontStyle: 'italic' }}>Loading analysis...</div>
      )}

      {/* Dependencies section */}
      {dependencies && (
        <>
          {dependencies.directDependencies && dependencies.directDependencies.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#00e5ff', marginBottom: 6, letterSpacing: '0.05em' }}>
                DEPENDS ON ({dependencies.directDependencies.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dependencies.directDependencies.map((dep) => (
                  <div key={dep.id} style={{
                    fontSize: 9, color: '#94adc4', padding: '4px 8px',
                    background: 'rgba(0,229,255,0.05)', borderRadius: 4,
                  }}>
                    {dep.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.dependents && dependencies.dependents.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', marginBottom: 6, letterSpacing: '0.05em' }}>
                DEPENDED ON BY ({dependencies.dependents.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {dependencies.dependents.map((dep) => (
                  <div key={dep.id} style={{
                    fontSize: 9, color: '#94adc4', padding: '4px 8px',
                    background: 'rgba(16,185,129,0.05)', borderRadius: 4,
                  }}>
                    {dep.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dependencies.depthToLeaf !== undefined && (
            <div style={{
              marginBottom: 14, padding: '8px',
              background: 'rgba(139,92,246,0.1)', borderRadius: 4,
              border: '1px solid rgba(139,92,246,0.2)',
            }}>
              <div style={{ fontSize: 9, color: '#8b5cf6', fontWeight: 700 }}>DEPTH TO LEAF</div>
              <div style={{ fontSize: 14, color: '#8b5cf6', fontWeight: 700 }}>{dependencies.depthToLeaf}</div>
            </div>
          )}
        </>
      )}

      {/* Impact section */}
      {impact && (
        <>
          {impact.totalAffected !== undefined && (
            <div style={{
              marginBottom: 14, padding: '8px',
              background: 'rgba(239,68,68,0.1)', borderRadius: 4,
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>IMPACT RADIUS</div>
              <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 700 }}>
                {impact.totalAffected} agent{impact.totalAffected !== 1 ? 's' : ''}
              </div>
            </div>
          )}

          {impact.directDependents && impact.directDependents.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6, letterSpacing: '0.05em' }}>
                DIRECT IMPACT ({impact.directDependents.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {impact.directDependents.map((dep) => (
                  <div key={dep.id} style={{
                    fontSize: 9, color: '#94adc4', padding: '4px 8px',
                    background: 'rgba(245,158,11,0.05)', borderRadius: 4,
                  }}>
                    {dep.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Outer component — provides ReactFlowProvider context (Bug G12 fix) */
/* ------------------------------------------------------------------ */

export function AgentGraph({ onNav }: { onNav: (page: NavPage) => void }) {
  return (
    <ReactFlowProvider>
      <AgentGraphInner onNav={onNav} />
    </ReactFlowProvider>
  )
}
