import { useState, useEffect } from 'react'
import { NavBar, type NavPage } from '../components/NavBar'
import { coreClient } from '../api/client'

// ── Status Card ────────────────────────────────────────────────────────────────

function StatusCard({ status }: { status: { power: string; mode: string } | null }) {
  if (!status) return <div className="animate-pulse font-mono text-xs text-cyan-400/60">loading...</div>

  const messages: Record<string, string> = {
    on: `Architect is on and waiting. Mode: ${status.mode}.`,
    off: 'Architect is off. Turn it on to start.',
  }

  return (
    <div className="mb-6 p-4 rounded-lg" style={{ background: '#0d1f33', border: '1px solid rgba(0, 229, 255, 0.1)' }}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status.power === 'on' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
        <span className="text-sm" style={{ color: '#e2f4ff' }}>
          {messages[status.power] ?? 'Unknown state'}
        </span>
      </div>
    </div>
  )
}

// ── Tab Bar ────────────────────────────────────────────────────────────────────

type Tab = 'queue' | 'activity' | 'insights' | 'receipts' | 'settings'

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'queue',    label: 'Missions' },
    { id: 'activity', label: 'Activity' },
    { id: 'insights', label: 'Insights' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'settings', label: 'Settings' },
  ]
  return (
    <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-4 py-2 text-sm font-mono transition-colors ${
            tab === t.id
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Queue Tab (Chunk 3) ────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:        'text-yellow-400 bg-yellow-400/10',
  active:         'text-cyan-400 bg-cyan-400/10',
  awaiting_human: 'text-orange-400 bg-orange-400/10',
  merged:         'text-emerald-400 bg-emerald-400/10',
  cancelled:      'text-gray-500 bg-gray-500/10',
  error:          'text-red-400 bg-red-400/10',
  paused:         'text-gray-400 bg-gray-400/10',
}

function QueueTab() {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inp = 'w-full bg-black/30 border border-white/8 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/40 placeholder:text-gray-600'

  const load = () => {
    coreClient.architectWorkItems('all')
      .then(setItems)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true); setError('')
    try {
      await coreClient.architectCreateWorkItem({ title: title.trim(), body: body.trim() || undefined })
      setTitle(''); setBody(''); setCreating(false); load()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      const statusMap: Record<string, string> = { pause: 'paused', resume: 'pending', cancel: 'cancelled' }
      await coreClient.architectPatchWorkItem(id, { status: statusMap[action] })
      load()
    } catch (e: any) { setError(e.message) }
  }

  if (loading) return <div className="animate-pulse font-mono text-xs text-cyan-400/60">loading missions...</div>

  return (
    <div>
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-mono" style={{ color: '#4a6a8a' }}>
          {items.length} mission{items.length !== 1 ? 's' : ''}
        </span>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary text-xs px-3 py-1.5">
            + Add Mission
          </button>
        )}
      </div>

      {creating && (
        <div className="mb-4 p-4 rounded-lg animate-slide-up" style={{ background: '#0d1f33', border: '1px solid rgba(0, 229, 255, 0.15)' }}>
          <input
            className={inp}
            placeholder="What should the architect do?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <textarea
            className={`${inp} mt-2 min-h-[60px]`}
            placeholder="Details (optional)"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={saving || !title.trim()}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setCreating(false); setTitle(''); setBody('') }}
              className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !creating ? (
        <div className="text-center py-12">
          <p className="text-sm mb-2" style={{ color: '#94adc4' }}>No missions yet</p>
          <p className="text-xs mb-4" style={{ color: '#4a6a8a' }}>Add a task for the architect to work on</p>
          <button onClick={() => setCreating(true)} className="btn-primary text-xs px-4 py-2">Add a Mission</button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-lg flex items-center justify-between"
              style={{ background: '#0d1f33', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${STATUS_COLORS[item.status] ?? 'text-gray-400'}`}>
                    {item.status}
                  </span>
                  <span className="text-sm truncate" style={{ color: '#e2f4ff' }}>{item.title}</span>
                </div>
                <span className="text-[10px] font-mono mt-0.5 block" style={{ color: '#4a6a8a' }}>
                  {item.source} · {item.id.slice(-8)}
                </span>
              </div>
              <div className="flex gap-2 ml-3 shrink-0">
                {(item.status === 'pending' || item.status === 'active') && (
                  <button
                    onClick={() => handleAction(item.id, 'pause')}
                    className="text-[10px] font-mono text-gray-500 hover:text-yellow-400"
                  >
                    PAUSE
                  </button>
                )}
                {(item.status === 'paused' || item.status === 'error') && (
                  <button
                    onClick={() => handleAction(item.id, 'resume')}
                    className="text-[10px] font-mono text-gray-500 hover:text-cyan-400"
                  >
                    RESUME
                  </button>
                )}
                {item.status !== 'merged' && item.status !== 'cancelled' && (
                  <button
                    onClick={() => handleAction(item.id, 'cancel')}
                    className="text-[10px] font-mono text-gray-500 hover:text-red-400"
                  >
                    CANCEL
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ApprovalButtons (Chunk 5) ──────────────────────────────────────────────────

function ApprovalButtons({ cycleId, gate, onDone }: { cycleId: string; gate: string; onDone: () => void }) {
  const [revising, setRevising] = useState(false)
  const [comment, setComment] = useState('')
  const [acting, setActing] = useState(false)

  const act = async (decision: string, commentText?: string) => {
    setActing(true)
    try {
      await coreClient.architectApproval(cycleId, { gate, decision, comment: commentText })
      onDone()
    } catch {} finally { setActing(false) }
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] font-mono mb-2 text-orange-400">Waiting for your decision</p>
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={() => act('approved')} disabled={acting}
          className="text-xs font-mono px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40">
          Approve
        </button>
        <button onClick={() => setRevising(!revising)} disabled={acting}
          className="text-xs font-mono px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40">
          Revise
        </button>
        <button onClick={() => act('rejected')} disabled={acting}
          className="text-xs font-mono px-3 py-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40">
          Reject
        </button>
      </div>
      {revising && (
        <div className="mt-2 flex gap-2 animate-slide-up">
          <input className="flex-1 bg-black/30 border border-white/8 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-yellow-500/40 placeholder:text-gray-600"
            placeholder="What should it change?" value={comment} onChange={e => setComment(e.target.value)} autoFocus />
          <button onClick={() => { act('revised', comment); setRevising(false) }} disabled={acting || !comment.trim()}
            className="text-xs font-mono px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 disabled:opacity-40">
            Send
          </button>
        </div>
      )}
    </div>
  )
}

// ── Activity Tab (Chunk 4) ─────────────────────────────────────────────────────

function ActivityTab() {
  const [cycles, setCycles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    coreClient.architectActivity(100)
      .then(setCycles)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse font-mono text-xs text-cyan-400/60">loading activity...</div>

  const filtered = filter === 'all' ? cycles : cycles.filter(c => {
    if (filter === 'working') return c.stage === 'planning' || c.stage === 'building'
    if (filter === 'waiting') return c.stage === 'plan_review' || c.stage === 'pr_review'
    if (filter === 'merged') return c.outcome === 'merged'
    if (filter === 'errored') return c.outcome === 'error'
    return c.outcome === filter
  })

  const filters = ['all', 'working', 'waiting', 'merged', 'cancelled', 'errored']

  const outcomeColors: Record<string, string> = {
    merged: 'text-emerald-400', built: 'text-cyan-400', revised: 'text-yellow-400',
    failed: 'text-red-400', vetoed: 'text-orange-400', error: 'text-red-500',
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] font-mono px-2 py-1 rounded ${filter === f ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs font-mono text-center py-8" style={{ color: '#4a6a8a' }}>No cycles match this filter</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <div key={c.id}>
              <button onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full p-3 rounded-lg text-left flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                style={{ background: '#0d1f33', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[10px] font-mono ${outcomeColors[c.outcome ?? ''] ?? 'text-gray-400'}`}>
                    {c.outcome ?? c.stage}
                  </span>
                  <span className="text-sm truncate" style={{ color: '#e2f4ff' }}>
                    iter {c.iteration} · {c.modelUsed ?? 'unknown'}
                  </span>
                </div>
                <span className="text-[10px] font-mono shrink-0" style={{ color: '#4a6a8a' }}>
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </button>
              {expanded === c.id && (
                <div className="p-4 rounded-b-lg animate-slide-up" style={{ background: '#112240', borderTop: 'none' }}>
                  {c.planText && <div className="mb-3"><span className="text-[10px] font-mono text-cyan-400/60">PLAN</span><p className="text-xs mt-1 whitespace-pre-wrap" style={{ color: '#94adc4' }}>{c.planText}</p></div>}
                  {c.testSummary && <div className="mb-3"><span className="text-[10px] font-mono text-cyan-400/60">TESTS</span><p className="text-xs mt-1" style={{ color: '#94adc4' }}>{c.testSummary}</p></div>}
                  {c.prUrl && <div className="mb-3"><span className="text-[10px] font-mono text-cyan-400/60">PR</span><a href={c.prUrl} target="_blank" rel="noopener" className="text-xs text-cyan-400 hover:underline ml-2">{c.prUrl}</a></div>}
                  {c.failureKind && <div className="mb-3"><span className="text-[10px] font-mono text-red-400/60">FAILURE</span><span className="text-xs ml-2" style={{ color: '#94adc4' }}>{c.failureKind}: {c.errorMessage}</span></div>}
                  {(c.stage === 'plan_review' || c.stage === 'pr_review') && (
                    <ApprovalButtons cycleId={c.id} gate={c.stage === 'plan_review' ? 'plan' : 'merge'} onDone={() => {
                      coreClient.architectActivity(100).then(setCycles).catch(() => {})
                    }} />
                  )}
                  <span className="text-[10px] font-mono block mt-2" style={{ color: '#4a6a8a' }}>cycle {c.id.slice(-8)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Insights Tab (Chunk 6) ─────────────────────────────────────────────────────

function InsightsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    coreClient.architectInsights(30)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse font-mono text-xs text-cyan-400/60">loading insights...</div>
  if (!data) return <p className="text-xs" style={{ color: '#4a6a8a' }}>Failed to load insights</p>

  const failureLabels: Record<string, string> = {
    parse: 'AI output invalid', apply: 'Diff failed', locked: 'Protected file',
    budget: 'Too big', lint: 'Style issue', type: 'TS error', build: 'Build failed',
    test: 'Tests failed', env_llm: 'Model error', env_gh: 'GitHub error', env_push: 'Push error',
  }

  const tiles = [
    { label: 'Success Rate', value: `${(data.successRate * 100).toFixed(0)}%`, color: data.successRate > 0.5 ? '#10b981' : '#f59e0b' },
    { label: 'Avg Iterations', value: data.avgIterations.toFixed(1), color: '#00e5ff' },
    { label: 'Time Saved', value: `${Math.round(data.totalDurationMs / 3600000)}h`, color: '#00e5ff' },
    { label: 'Open Queue', value: String(data.openQueueDepth), color: data.openQueueDepth > 5 ? '#f59e0b' : '#94adc4' },
    { label: 'Errors', value: String(data.errorCount), color: data.errorCount > 0 ? '#ef4444' : '#10b981' },
    { label: 'Top Failure', value: failureLabels[data.topFailureKind] ?? data.topFailureKind ?? 'None', color: '#94adc4' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tiles.map(t => (
        <div key={t.label} className="p-4 rounded-lg" style={{ background: '#0d1f33', border: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] font-mono mb-1" style={{ color: '#4a6a8a' }}>{t.label}</p>
          <p className="text-xl font-semibold" style={{ color: t.color }}>{t.value}</p>
        </div>
      ))}
    </div>
  )
}

// ── Receipts Tab (Chunk 7) ─────────────────────────────────────────────────────

function ReceiptsTab() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    coreClient.architectReceipts()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="animate-pulse font-mono text-xs text-cyan-400/60">loading receipts...</div>
  if (!data || data.prs.length === 0) return (
    <div className="text-center py-12">
      <p className="text-sm mb-1" style={{ color: '#94adc4' }}>No receipts yet</p>
      <p className="text-xs" style={{ color: '#4a6a8a' }}>The architect hasn't merged any PRs yet</p>
    </div>
  )

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg" style={{ background: '#0d1f33', border: '1px solid rgba(0, 229, 255, 0.1)' }}>
        <span className="text-xs font-mono" style={{ color: '#00e5ff' }}>{data.totals.prsMerged} PRs merged</span>
      </div>
      <div className="space-y-2">
        {data.prs.map((pr: any) => (
          <div key={pr.cycleId} className="p-3 rounded-lg" style={{ background: '#0d1f33', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#e2f4ff' }}>{pr.planText?.slice(0, 80) ?? 'Untitled'}</span>
              {pr.prUrl && <a href={pr.prUrl} target="_blank" rel="noopener" className="text-[10px] font-mono text-cyan-400 hover:underline shrink-0 ml-2">View PR</a>}
            </div>
            <div className="flex gap-4 mt-1">
              <span className="text-[10px] font-mono" style={{ color: '#4a6a8a' }}>iter {pr.iteration}</span>
              <span className="text-[10px] font-mono" style={{ color: '#4a6a8a' }}>{pr.modelUsed}</span>
              <span className="text-[10px] font-mono" style={{ color: '#4a6a8a' }}>{new Date(pr.mergedAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Settings Tab (Chunk 7) ─────────────────────────────────────────────────────

function SettingsTab({ onStatusChange }: { onStatusChange: (s: any) => void }) {
  const [status, setStatus] = useState<{ power: string; mode: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    coreClient.architectStatus().then(s => { setStatus(s); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const setPower = async (state: 'on' | 'off') => {
    setActing(true)
    try {
      await coreClient.architectSetPower(state)
      const s = await coreClient.architectStatus()
      setStatus(s); onStatusChange(s)
    } catch {} finally { setActing(false) }
  }

  const setMode = async (mode: string) => {
    setActing(true)
    try {
      await coreClient.architectSetMode(mode)
      const s = await coreClient.architectStatus()
      setStatus(s); onStatusChange(s)
    } catch {} finally { setActing(false) }
  }

  const runNow = async () => {
    setActing(true)
    try { await coreClient.architectRunNow() } catch {} finally { setActing(false) }
  }

  if (loading) return <div className="animate-pulse font-mono text-xs text-cyan-400/60">loading settings...</div>

  const modes = [
    { id: 'hands-on', label: 'Hands-on', desc: 'See every change before it happens' },
    { id: 'hands-off', label: 'Hands-off', desc: 'Only see pull requests' },
    { id: 'autopilot', label: 'Autopilot', desc: "Don't ask me unless something breaks" },
  ]

  return (
    <div className="space-y-6">
      {/* Power */}
      <div>
        <h3 className="text-xs font-mono mb-2" style={{ color: '#94adc4' }}>Power</h3>
        <div className="flex gap-2">
          <button onClick={() => setPower('on')} disabled={acting || status?.power === 'on'}
            className={`text-xs font-mono px-4 py-2 rounded ${status?.power === 'on' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-400 hover:text-emerald-400'} disabled:opacity-40`}>
            ON
          </button>
          <button onClick={() => setPower('off')} disabled={acting || status?.power === 'off'}
            className={`text-xs font-mono px-4 py-2 rounded ${status?.power === 'off' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400 hover:text-red-400'} disabled:opacity-40`}>
            OFF
          </button>
        </div>
      </div>

      {/* Mode */}
      <div>
        <h3 className="text-xs font-mono mb-2" style={{ color: '#94adc4' }}>Mode</h3>
        <div className="grid grid-cols-3 gap-2">
          {modes.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} disabled={acting}
              className={`p-3 rounded-lg text-left transition-colors ${status?.mode === m.id ? 'ring-1 ring-cyan-500/40' : 'hover:bg-white/[0.02]'}`}
              style={{ background: '#0d1f33', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs font-semibold" style={{ color: status?.mode === m.id ? '#00e5ff' : '#e2f4ff' }}>{m.label}</p>
              <p className="text-[10px] mt-1" style={{ color: '#4a6a8a' }}>{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Run Now */}
      <div>
        <h3 className="text-xs font-mono mb-2" style={{ color: '#94adc4' }}>Manual Controls</h3>
        <button onClick={runNow} disabled={acting}
          className="text-xs font-mono px-4 py-2 rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-40">
          Run Now
        </button>
      </div>
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────────

export function Architect({ onNav }: { onNav: (page: NavPage) => void }) {
  const [tab, setTab] = useState<Tab>('queue')
  const [status, setStatus] = useState<{ power: string; mode: string } | null>(null)

  useEffect(() => {
    coreClient.architectStatus().then(setStatus).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen text-white" style={{ background: '#050a0f' }}>
      <NavBar page={'architect' as NavPage} onNav={onNav} />
      <div className="pt-20 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: '#e2f4ff' }}>Architect</h1>
            <p className="text-xs mt-1" style={{ color: '#94adc4' }}>Self-healing improvement system</p>
          </div>
        </div>
        <StatusCard status={status} />
        <TabBar tab={tab} setTab={setTab} />
        {tab === 'queue'    && <QueueTab />}
        {tab === 'activity' && <ActivityTab />}
        {tab === 'insights' && <InsightsTab />}
        {tab === 'receipts' && <ReceiptsTab />}
        {tab === 'settings' && <SettingsTab onStatusChange={setStatus} />}
      </div>
    </div>
  )
}
