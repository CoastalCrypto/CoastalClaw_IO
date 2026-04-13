import { useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  BackgroundVariant,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ─── Domain types ──────────────────────────────────────────────────────────

export interface Agent {
  id: string
  name: string
  active: boolean
  role?: string
}

// The data payload stored inside each pipeline node.
interface PipelineNodeData extends Record<string, unknown> {
  agentId: string
  agentName: string
  active: boolean
  role: string
  stageIdx: number
}

// The full node type used with @xyflow/react v12
type PipelineNode = Node<PipelineNodeData, 'agentStage'>

// ─── Custom node renderer ──────────────────────────────────────────────────

function AgentStageNode({ data, selected }: NodeProps<PipelineNode>) {
  return (
    <div
      style={{
        background: 'rgba(13,31,51,0.95)',
        border: `1px solid ${selected ? 'rgba(0,229,255,0.7)' : 'rgba(0,229,255,0.2)'}`,
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 160,
        boxShadow: selected
          ? '0 0 16px rgba(0,229,255,0.2)'
          : '0 4px 16px rgba(0,0,0,0.4)',
        transition: 'all 0.15s',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#00e5ff', border: 'none', width: 8, height: 8 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            background: data.active ? '#10b981' : '#94adc4',
            boxShadow: data.active ? '0 0 6px #10b981' : 'none',
          }}
        />
        <span
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 700,
            fontSize: 13,
            color: '#e2f4ff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 120,
          }}
        >
          {data.agentName}
        </span>
      </div>

      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: '#94adc4',
        }}
      >
        Stage {data.stageIdx + 1} · {data.role || 'Agent'}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#00e5ff', border: 'none', width: 8, height: 8 }}
      />
    </div>
  )
}

const NODE_TYPES = { agentStage: AgentStageNode }

// ─── Props ─────────────────────────────────────────────────────────────────

interface PipelineCanvasProps {
  agents: Agent[]
  onRunPipeline: (stages: Array<{ agentId: string; type: 'agent' }>) => Promise<void>
  running: boolean
  prompt: string
  onPromptChange: (value: string) => void
}

// ─── Inner canvas (must be inside ReactFlowProvider) ──────────────────────

function CanvasInner({
  agents,
  onRunPipeline,
  running,
  prompt,
  onPromptChange,
}: PipelineCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<PipelineNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: 'rgba(0,229,255,0.5)', strokeWidth: 2 },
          },
          eds,
        ),
      )
    },
    [setEdges],
  )

  const addAgent = useCallback(
    (agent: Agent) => {
      const id = `stage-${Date.now()}`

      setNodes(ns => {
        const stageIdx = ns.length
        const newNode: PipelineNode = {
          id,
          type: 'agentStage',
          position: { x: 80 + stageIdx * 220, y: 120 },
          data: {
            agentId: agent.id,
            agentName: agent.name,
            active: agent.active,
            role: agent.role ?? 'Agent',
            stageIdx,
          },
        }

        if (ns.length > 0) {
          const prevId = ns[ns.length - 1].id
          setEdges(es =>
            addEdge(
              {
                id: `e-${prevId}-${id}`,
                source: prevId,
                target: id,
                animated: true,
                style: { stroke: 'rgba(0,229,255,0.4)', strokeWidth: 2 },
              },
              es,
            ),
          )
        }

        return [...ns, newNode]
      })
    },
    [setNodes, setEdges],
  )

  const clearCanvas = useCallback(() => {
    setNodes([])
    setEdges([])
  }, [setNodes, setEdges])

  const handleRun = useCallback(() => {
    if (nodes.length === 0) return
    // Order left-to-right by x position so visual arrangement drives execution order
    const ordered = [...nodes]
      .sort((a, b) => a.position.x - b.position.x)
      .map(n => ({ agentId: n.data.agentId, type: 'agent' as const }))
    void onRunPipeline(ordered)
  }, [nodes, onRunPipeline])

  const activeAgents = agents.filter(a => a.active)

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      {/* Main area: sidebar + canvas */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Agent sidebar */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            background: 'rgba(5,10,15,0.8)',
            borderRight: '1px solid rgba(0,229,255,0.1)',
            padding: 12,
            overflowY: 'auto',
          }}
        >
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: '#00e5ff',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 10,
            }}
          >
            Agents
          </div>

          {activeAgents.map(agent => (
            <div
              key={agent.id}
              role="button"
              tabIndex={0}
              aria-label={`Add ${agent.name} to pipeline`}
              onClick={() => addAgent(agent)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  addAgent(agent)
                }
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 7,
                marginBottom: 6,
                background: 'rgba(13,31,51,0.6)',
                border: '1px solid rgba(0,229,255,0.12)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor =
                  'rgba(0,229,255,0.4)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLDivElement).style.borderColor =
                  'rgba(0,229,255,0.12)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10b981',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: '#e2f4ff',
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.name}
                </span>
              </div>
              {agent.role && (
                <div
                  style={{
                    fontSize: 9,
                    color: '#94adc4',
                    fontFamily: 'JetBrains Mono, monospace',
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.role}
                </div>
              )}
            </div>
          ))}

          {activeAgents.length === 0 && (
            <p
              style={{
                fontSize: 11,
                color: '#94adc4',
                textAlign: 'center',
                marginTop: 20,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              No active agents
            </p>
          )}
        </div>

        {/* ReactFlow canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Toolbar */}
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            {nodes.length > 0 && (
              <button
                onClick={clearCanvas}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,82,82,0.08)',
                  border: '1px solid rgba(255,82,82,0.25)',
                  color: '#ff6b6b',
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
            <button
              onClick={handleRun}
              disabled={running || nodes.length === 0}
              style={{
                padding: '6px 16px',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: running || nodes.length === 0 ? 'not-allowed' : 'pointer',
                background:
                  running || nodes.length === 0
                    ? 'rgba(0,229,255,0.06)'
                    : '#00e5ff',
                border:
                  running || nodes.length === 0
                    ? '1px solid rgba(0,229,255,0.15)'
                    : 'none',
                color:
                  running || nodes.length === 0 ? '#94adc4' : '#050a0f',
              }}
            >
              {running ? 'Running...' : '▶ Run'}
            </button>
          </div>

          {/* Empty-state hint */}
          {nodes.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              <div
                style={{ fontSize: 36, opacity: 0.15, marginBottom: 12 }}
                aria-hidden="true"
              >
                ⛓
              </div>
              <p
                style={{
                  color: '#94adc4',
                  fontSize: 13,
                  fontFamily: 'Space Grotesk, sans-serif',
                  margin: 0,
                }}
              >
                Click an agent to add it to the canvas
              </p>
              <p
                style={{
                  color: '#475569',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 4,
                }}
              >
                Agents connect left to right in order
              </p>
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={NODE_TYPES}
            fitView
            style={{ background: '#050a0f' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color="rgba(0,229,255,0.04)"
              variant={BackgroundVariant.Dots}
              gap={24}
            />
            <Controls
              style={{
                background: 'rgba(13,31,51,0.8)',
                border: '1px solid rgba(0,229,255,0.15)',
                borderRadius: 8,
              }}
            />
            <MiniMap
              style={{
                background: 'rgba(5,10,15,0.9)',
                border: '1px solid rgba(0,229,255,0.1)',
              }}
              nodeColor="rgba(0,229,255,0.4)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Prompt input pinned at the bottom of the canvas view */}
      <div
        style={{
          flexShrink: 0,
          background: 'rgba(5,10,15,0.9)',
          borderTop: '1px solid rgba(0,229,255,0.1)',
          padding: '12px 16px',
          display: 'flex',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ flex: 1 }}>
          <label
            htmlFor="canvas-prompt"
            style={{
              display: 'block',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              color: '#00e5ff',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
          >
            Initial Prompt
          </label>
          <textarea
            id="canvas-prompt"
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            rows={2}
            placeholder="The prompt that kicks off the pipeline..."
            style={{
              width: '100%',
              background: 'rgba(13,31,51,0.8)',
              border: '1px solid rgba(0,229,255,0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#e2f4ff',
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <button
          onClick={handleRun}
          disabled={running || nodes.length === 0 || !prompt.trim()}
          style={{
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            letterSpacing: '0.05em',
            flexShrink: 0,
            cursor:
              running || nodes.length === 0 || !prompt.trim()
                ? 'not-allowed'
                : 'pointer',
            background:
              running || nodes.length === 0 || !prompt.trim()
                ? 'rgba(0,229,255,0.06)'
                : '#00e5ff',
            border:
              running || nodes.length === 0 || !prompt.trim()
                ? '1px solid rgba(0,229,255,0.15)'
                : 'none',
            color:
              running || nodes.length === 0 || !prompt.trim()
                ? '#94adc4'
                : '#050a0f',
          }}
        >
          {running ? 'Running...' : '▶ Run Pipeline'}
        </button>
      </div>
    </div>
  )
}

// ─── Public export (wraps in ReactFlowProvider) ───────────────────────────

export function PipelineCanvas(props: PipelineCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  )
}
