import { useState, useEffect } from 'react'
import { NavBar } from '../components/NavBar'
import type { NavPage } from '../components/NavBar'
import { PipelineRun } from './PipelineRun.js'

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
  id: string
  agentId: string
  loopBack?: { toStageIdx: number; condition: string; maxIterations: number }
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

const INPUT_STYLE = {
  background: 'rgba(5,13,26,0.8)',
  border: '1px solid rgba(0,212,255,0.20)',
  borderRadius: '8px',
  padding: '6px 12px',
  color: '#e2e8f0',
  fontSize: '13px',
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
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
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'builder' | 'run'>('builder')
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [pipelineName, setPipelineName] = useState('')
  const [savedPipelines, setSavedPipelines] = useState<any[]>([])
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    fetch('/api/admin/agents', { headers: adminHeaders() })
      .then(r => r.json())
      .then((data: Agent[]) => setAgents(data.filter(a => a.active)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/admin/pipelines', { headers: adminHeaders() })
      .then(r => r.json()).then(setSavedPipelines).catch(() => {})
  }, [])

  const addStage = () => setStages(s => [...s, { id: uid(), agentId: '' }])
  const removeStage = (id: string) => setStages(s => s.filter(x => x.id !== id))

  const updateStage = (id: string, patch: Partial<Omit<Stage, 'id'>>) =>
    setStages(s => s.map(x => x.id === id ? { ...x, ...patch } : x))

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
    const filled = stages.filter(s => s.agentId)
    if (filled.length < 1) { setError('Add at least one agent stage'); return }
    if (!input.trim()) { setError('Enter an initial prompt'); return }
    setError(null)
    setRunning(true)
    try {
      const res = await fetch('/api/pipeline/run/async', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({
          stages: filled.map(s => ({ agentId: s.agentId, loopBack: s.loopBack })),
          input: input.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (data.runId) {
        setActiveRunId(data.runId)
        setView('run')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const save = async () => {
    if (!pipelineName.trim()) { setError('Enter a pipeline name to save'); return }
    setError(null)
    try {
      const res = await fetch('/api/admin/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({
          name: pipelineName,
          stages: stages.map(s => ({ agentId: s.agentId, type: 'agent', loopBack: s.loopBack })),
        }),
      })
      const saved = await res.json()
      setSavedPipelines(prev => [saved, ...prev])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const loadPipeline = (p: any) => {
    setPipelineName(p.name)
    setStages((p.stages as any[]).map(s => ({ id: uid(), agentId: s.agentId, loopBack: s.loopBack })))
    setShowLibrary(false)
  }

  // Show live run view when a run is active
  if (view === 'run' && activeRunId) {
    return (
      <PipelineRun
        runId={activeRunId}
        pipelineName={pipelineName || 'Pipeline Run'}
        stageCount={stages.filter(s => s.agentId).length}
        onBack={() => { setView('builder'); setActiveRunId(null) }}
        onNav={onNav}
      />
    )
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

        {/* Name + Save + Library row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            value={pipelineName}
            onChange={e => setPipelineName(e.target.value)}
            placeholder="Pipeline name (optional)"
            style={{ flex: 1, ...INPUT_STYLE }}
          />
          <button onClick={save} style={BTN_CYAN}>Save</button>
          <button
            onClick={() => setShowLibrary(v => !v)}
            style={{ ...BTN_CYAN, opacity: showLibrary ? 1 : 0.7 }}
          >📂 Library</button>
        </div>

        {/* Library panel */}
        {showLibrary && (
          <div style={{ ...PANEL, marginBottom: 16 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Saved Pipelines
            </div>
            {savedPipelines.length === 0 && (
              <p style={{ fontSize: '12px', color: '#475569' }}>No saved pipelines yet.</p>
            )}
            {savedPipelines.map(p => (
              <div
                key={p.id}
                onClick={() => loadPipeline(p)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 6, background: 'rgba(5,13,26,0.50)', marginBottom: 4, cursor: 'pointer' }}
              >
                <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{p.name}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#475569' }}>
                  {Array.isArray(p.stages) ? p.stages.length : 0} stages
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stage list */}
        <div style={PANEL} className="mb-4">
          <p className="text-xs font-mono mb-4" style={{ color: '#00D4FF', letterSpacing: '0.08em' }}>STAGES</p>

          {stages.map((stage, idx) => (
            <div key={stage.id} className="mb-4">
              <div className="flex items-center gap-3">
                <div className="text-xs font-mono w-5 text-center shrink-0" style={{ color: '#A0AEC0' }}>
                  {idx + 1}
                </div>

                <select
                  value={stage.agentId}
                  onChange={e => updateStage(stage.id, { agentId: e.target.value })}
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-mono"
                  style={{ background: 'rgba(5,13,26,0.8)', border: '1px solid rgba(0,212,255,0.20)', color: stage.agentId ? '#e2e8f0' : '#A0AEC0' }}
                >
                  <option value="">— select agent —</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                {/* Loop-back toggle */}
                <button
                  onClick={() => updateStage(stage.id, { loopBack: stage.loopBack ? undefined : { toStageIdx: Math.max(0, idx - 1), condition: 'DONE', maxIterations: 3 } })}
                  style={{ ...BTN_CYAN, padding: '4px 8px', fontSize: '10px', opacity: stage.loopBack ? 1 : 0.4 }}
                  title="Add loop-back to earlier stage"
                >↩</button>

                <div className="flex gap-1 shrink-0">
                  <button onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs px-1">↑</button>
                  <button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} className="text-gray-600 hover:text-gray-300 disabled:opacity-20 text-xs px-1">↓</button>
                  <button onClick={() => removeStage(stage.id)} className="text-red-700 hover:text-red-400 text-xs px-1">✕</button>
                </div>
              </div>

              {/* Loop-back config row */}
              {stage.loopBack && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, marginLeft: 32, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#ffb300' }}>loop if not contains:</span>
                  <input
                    value={stage.loopBack.condition}
                    onChange={e => updateStage(stage.id, { loopBack: { ...stage.loopBack!, condition: e.target.value } })}
                    style={{ width: 80, ...INPUT_STYLE, padding: '2px 6px', fontSize: '10px' }}
                  />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#A0AEC0' }}>→ stage</span>
                  <input
                    type="number" min={1} max={idx + 1}
                    value={stage.loopBack.toStageIdx + 1}
                    onChange={e => updateStage(stage.id, { loopBack: { ...stage.loopBack!, toStageIdx: Number(e.target.value) - 1 } })}
                    style={{ width: 40, ...INPUT_STYLE, padding: '2px 6px', fontSize: '10px' }}
                  />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', color: '#A0AEC0' }}>max</span>
                  <input
                    type="number" min={1} max={10}
                    value={stage.loopBack.maxIterations}
                    onChange={e => updateStage(stage.id, { loopBack: { ...stage.loopBack!, maxIterations: Number(e.target.value) } })}
                    style={{ width: 40, ...INPUT_STYLE, padding: '2px 6px', fontSize: '10px' }}
                  />
                </div>
              )}
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
          {running ? 'Starting pipeline…' : '▶ Run Pipeline'}
        </button>
      </div>
    </div>
  )
}
