import { useState, useEffect } from 'react'
import { NavBar } from '../components/NavBar'
import type { NavPage } from '../components/NavBar'
function adminHeaders(): Record<string, string> {
  const session = sessionStorage.getItem('cc_admin_session') ?? ''
  return session ? { 'x-admin-session': session } : {}
}

interface Agent {
  id: string
  name: string
  active: boolean
}

interface Stage {
  id: string   // local UI key
  agentId: string
}

interface StageResult {
  agentId: string
  agentName: string
  input: string
  output: string
  durationMs: number
}

interface PipelineResult {
  pipelineId: string
  stages: StageResult[]
  finalOutput: string
  totalDurationMs: number
}

const PANEL = {
  background: 'rgba(26,39,68,0.80)',
  border: '1px solid rgba(0,212,255,0.15)',
  borderRadius: '12px',
  padding: '20px',
} as const

const BTN_CYAN = {
  background: 'rgba(0,212,255,0.12)',
  border: '1px solid rgba(0,212,255,0.30)',
  color: '#00D4FF',
  borderRadius: '8px',
  padding: '6px 14px',
  fontSize: '12px',
  fontFamily: 'Space Grotesk, sans-serif',
  cursor: 'pointer',
} as const

function uid() { return Math.random().toString(36).slice(2) }

export function Pipeline({ onNav }: { onNav: (p: NavPage) => void }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [stages, setStages] = useState<Stage[]>([
    { id: uid(), agentId: '' },
    { id: uid(), agentId: '' },
  ])
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetch('/api/admin/agents', { headers: adminHeaders() })
      .then(r => r.json())
      .then((data: Agent[]) => setAgents(data.filter(a => a.active)))
      .catch(() => {})
  }, [])

  const addStage = () => setStages(s => [...s, { id: uid(), agentId: '' }])

  const removeStage = (id: string) => setStages(s => s.filter(x => x.id !== id))

  const updateStage = (id: string, agentId: string) =>
    setStages(s => s.map(x => x.id === id ? { ...x, agentId } : x))

  const moveStage = (idx: number, dir: -1 | 1) => {
    setStages(s => {
      const arr = [...s]
      const target = idx + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      return arr
    })
  }

  const run = async () => {
    setError(null)
    setResult(null)
    const filled = stages.filter(s => s.agentId)
    if (filled.length < 1) { setError('Add at least one agent stage'); return }
    if (!input.trim()) { setError('Enter an initial prompt'); return }
    setRunning(true)
    try {
      const res = await fetch('/api/pipeline/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ stages: filled.map(s => ({ agentId: s.agentId })), input: input.trim() }),
      })
      const data = await res.json() as PipelineResult & { error?: string }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)', fontFamily: 'Space Grotesk, sans-serif' }}>
      <NavBar page="pipeline" onNav={onNav} />
      <div className="pt-20 px-4 sm:px-6 max-w-3xl mx-auto pb-16">

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Pipeline Builder</h1>
          <p className="text-sm mt-1" style={{ color: '#A0AEC0' }}>
            Chain agents in sequence — each agent's output becomes the next agent's input.
          </p>
        </div>

        {/* Stage list */}
        <div style={PANEL} className="mb-4">
          <p className="text-xs font-mono mb-4" style={{ color: '#00D4FF', letterSpacing: '0.08em' }}>STAGES</p>

          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-3 mb-3">
              <div className="text-xs font-mono w-5 text-center shrink-0" style={{ color: '#A0AEC0' }}>
                {idx + 1}
              </div>

              <select
                value={stage.agentId}
                onChange={e => updateStage(stage.id, e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: 'rgba(5,13,26,0.8)', border: '1px solid rgba(0,212,255,0.20)', color: stage.agentId ? '#e2e8f0' : '#A0AEC0' }}
              >
                <option value="">— select agent —</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <div className="flex gap-1 shrink-0">
                <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs px-1">↑</button>
                <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs px-1">↓</button>
                <button onClick={() => removeStage(stage.id)} className="text-red-700 hover:text-red-400 text-xs px-1">✕</button>
              </div>
            </div>
          ))}

          <button onClick={addStage} style={BTN_CYAN} className="mt-2">+ Add Stage</button>
        </div>

        {/* Input prompt */}
        <div style={PANEL} className="mb-4">
          <p className="text-xs font-mono mb-3" style={{ color: '#00D4FF', letterSpacing: '0.08em' }}>INITIAL PROMPT</p>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={4}
            placeholder="The prompt that kicks off the pipeline..."
            className="w-full rounded-lg px-4 py-3 text-sm font-mono resize-none focus:outline-none"
            style={{ background: 'rgba(5,13,26,0.8)', border: '1px solid rgba(0,212,255,0.20)', color: '#e2e8f0', fontSize: '14px' }}
          />
        </div>

        {error && (
          <div className="mb-4 text-sm font-mono px-4 py-2 rounded-lg" style={{ background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.25)', color: '#ff6b6b' }}>
            ⚠ {error}
          </div>
        )}

        <button
          onClick={run}
          disabled={running}
          className="w-full py-3 font-bold font-mono tracking-widest rounded-xl transition-all text-sm"
          style={running
            ? { background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', color: '#A0AEC0' }
            : { background: '#00D4FF', color: '#050d1a' }}
        >
          {running ? 'Running pipeline…' : '▶ Run Pipeline'}
        </button>

        {/* Results */}
        {result && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono" style={{ color: '#00D4FF', letterSpacing: '0.08em' }}>
                RESULTS — {result.totalDurationMs}ms total
              </p>
            </div>

            {result.stages.map((stage, idx) => (
              <div key={idx} style={{ ...PANEL, marginBottom: '12px' }}>
                <button
                  onClick={() => setExpanded(e => ({ ...e, [idx]: !e[idx] }))}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono" style={{ color: '#A0AEC0' }}>Stage {idx + 1}</span>
                    <span className="text-sm font-bold" style={{ color: '#00D4FF' }}>{stage.agentName}</span>
                    <span className="text-xs font-mono" style={{ color: '#A0AEC0' }}>{stage.durationMs}ms</span>
                  </div>
                  <span className="text-xs text-gray-600">{expanded[idx] ? '▲' : '▼'}</span>
                </button>

                {expanded[idx] && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-mono mb-1" style={{ color: '#A0AEC0' }}>INPUT</p>
                      <pre className="text-xs rounded p-3 whitespace-pre-wrap font-mono" style={{ background: 'rgba(0,0,0,0.30)', color: '#94a3b8', maxHeight: '120px', overflow: 'auto' }}>{stage.input}</pre>
                    </div>
                    <div>
                      <p className="text-[10px] font-mono mb-1" style={{ color: '#A0AEC0' }}>OUTPUT</p>
                      <pre className="text-xs rounded p-3 whitespace-pre-wrap font-mono" style={{ background: 'rgba(0,0,0,0.30)', color: '#e2e8f0', maxHeight: '200px', overflow: 'auto' }}>{stage.output}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div style={{ ...PANEL, borderColor: 'rgba(0,212,255,0.35)' }}>
              <p className="text-xs font-mono mb-3" style={{ color: '#00D4FF', letterSpacing: '0.08em' }}>FINAL OUTPUT</p>
              <pre className="text-sm whitespace-pre-wrap font-mono" style={{ color: '#e2e8f0', lineHeight: '1.6' }}>{result.finalOutput}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
