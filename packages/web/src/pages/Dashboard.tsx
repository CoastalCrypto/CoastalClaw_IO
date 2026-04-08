import { useState, useEffect } from 'react'
import { useEventStream, type AgentEvent } from '../hooks/useEventStream'
import { NavBar, type NavPage } from '../components/NavBar'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 1000) return 'just now'
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return `${Math.floor(diff / 3_600_000)}h ago`
}

function eventIcon(type: string): string {
  switch (type) {
    case 'tool_call_start':    return '⚙️'
    case 'tool_call_end':      return '✅'
    case 'session_start':      return '▶️'
    case 'session_complete':   return '🏁'
    case 'token_counted':      return '🔢'
    case 'job_run':            return '🕐'
    case 'pr_open':            return '🔀'
    default:                   return '•'
  }
}

function eventColor(event: AgentEvent): string {
  if (event.type === 'tool_call_end' && event.success === false) return 'border-red-500/30 bg-red-500/5'
  if (event.type === 'tool_call_end') return 'border-emerald-500/20 bg-emerald-500/5'
  if (event.type === 'session_complete') return 'border-cyan-500/20 bg-cyan-500/5'
  if (event.type === 'pr_open') return 'border-violet-500/20 bg-violet-500/5'
  return 'border-white/5 bg-white/2'
}

function eventLabel(event: AgentEvent): string {
  switch (event.type) {
    case 'tool_call_start':
      return `Running ${event.toolName}`
    case 'tool_call_end':
      return `${event.toolName} ${event.success ? 'completed' : 'failed'} in ${event.durationMs}ms`
    case 'session_start':
      return `Session started · ${event.agentId}`
    case 'session_complete':
      return `Session complete · ${event.toolCallCount ?? 0} tool calls`
    case 'token_counted':
      return `${(event.tokenCount ?? 0)} tokens · ${event.agentId ?? 'unknown model'}`
    case 'job_run':
      return `${event.jobName} · ${event.status}`
    case 'pr_open':
      return `PR: ${event.title}`
    default:
      return event.type
  }
}

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="p-4 pb-3">
        <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: '#A0AEC0' }}>{label}</div>
        <div className="text-2xl font-bold text-white tabular-nums" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{value}</div>
        {sub && <div className="text-[11px] mt-1.5" style={{ color: 'rgba(160,174,192,0.60)' }}>{sub}</div>}
      </div>
      <div className="stat-card-bar">
        <div className="w-2 h-0.5 bg-black/20 mx-auto rounded-full" />
      </div>
    </div>
  )
}

// ── Cron types ────────────────────────────────────────────────────────────────
interface CronJob {
  id: string
  name: string
  schedule: string
  task: string
  agentId: string
  enabled: boolean
  lastRunAt: number | null
  lastRunStatus: 'ok' | 'error' | null
  lastRunOutput: string | null
  createdAt: number
}

function adminHeaders(): Record<string, string> {
  const session = sessionStorage.getItem('cc_admin_session') ?? ''
  return session ? { 'x-admin-session': session } : {}
}

const EMPTY_FORM = { name: '', schedule: '0 9 * * 1-5', task: '', agentId: 'general' }

function CronSection() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [triggering, setTriggering] = useState<string | null>(null)
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/crons', { headers: adminHeaders() })
    if (res.ok) setJobs(await res.json())
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (job: CronJob) => {
    setForm({ name: job.name, schedule: job.schedule, task: job.task, agentId: job.agentId })
    setEditingId(job.id)
    setShowForm(true)
  }

  const cancel = () => { setShowForm(false); setEditingId(null) }

  const save = async () => {
    if (!form.name || !form.schedule || !form.task) return
    if (editingId) {
      await fetch(`/api/admin/crons/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(form),
      })
    } else {
      await fetch('/api/admin/crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify(form),
      })
    }
    cancel()
    load()
  }

  const toggle = async (job: CronJob) => {
    await fetch(`/api/admin/crons/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify({ enabled: !job.enabled }),
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this cron job?')) return
    await fetch(`/api/admin/crons/${id}`, { method: 'DELETE', headers: adminHeaders() })
    load()
  }

  const trigger = async (id: string) => {
    setTriggering(id)
    await fetch(`/api/admin/crons/${id}/trigger`, { method: 'POST', headers: adminHeaders() })
    setTriggering(null)
    load()
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,24,41,0.80)', border: '1px solid rgba(0,212,255,0.10)' }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
        <span className="section-heading">SCHEDULED JOBS</span>
        <button
          onClick={openNew}
          className="text-xs font-mono transition-colors rounded px-2 py-0.5"
          style={{ color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)' }}
          onMouseEnter={e => (e.target as HTMLElement).style.background = 'rgba(0,212,255,0.08)'}
          onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
        >
          + NEW JOB
        </button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="px-4 py-4 border-b border-white/5 bg-cyan-950/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-mono text-gray-500 block mb-1">NAME</label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50"
                placeholder="Daily digest"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-gray-500 block mb-1">SCHEDULE (cron)</label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50"
                placeholder="0 9 * * 1-5"
                value={form.schedule}
                onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-gray-500 block mb-1">AGENT ID</label>
              <input
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50"
                placeholder="general"
                value={form.agentId}
                onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-mono text-gray-500 block mb-1">TASK (message sent to agent)</label>
            <textarea
              rows={2}
              className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 resize-none"
              placeholder="Generate a daily summary of completed tasks and send it to the team channel"
              value={form.task}
              onChange={e => setForm(f => ({ ...f, task: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="text-xs font-mono px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/50 text-cyan-400 rounded hover:bg-cyan-500/20 transition-colors"
            >
              {editingId ? 'SAVE CHANGES' : 'CREATE JOB'}
            </button>
            <button
              onClick={cancel}
              className="text-xs font-mono px-3 py-1.5 text-gray-500 hover:text-gray-300 transition-colors"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Job list */}
      {jobs.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-3xl mb-3 opacity-30">🕐</div>
          <p className="text-gray-500 text-sm">No scheduled jobs yet</p>
          <p className="text-gray-600 text-xs mt-1">Create a job to automate recurring agent tasks.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/3">
          {jobs.map(job => (
            <div key={job.id} className="px-4 py-3 hover:bg-white/2 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-white font-mono">{job.name}</span>
                    <span className="text-[10px] font-mono text-cyan-500/60 border border-cyan-900/40 px-1.5 py-0.5 rounded bg-cyan-950/20">
                      {job.schedule}
                    </span>
                    {job.enabled ? (
                      <span className="text-[10px] font-mono text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded bg-emerald-950/20">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-gray-500 border border-gray-800 px-1.5 py-0.5 rounded">
                        PAUSED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mb-1">{job.task}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-gray-600">
                    <span>agent: {job.agentId}</span>
                    {job.lastRunAt && (
                      <>
                        <span>·</span>
                        <span
                          className={`cursor-pointer hover:underline ${job.lastRunStatus === 'error' ? 'text-red-500' : 'text-gray-600'}`}
                          onClick={() => setExpandedOutput(expandedOutput === job.id ? null : job.id)}
                        >
                          last run {relativeTime(job.lastRunAt)} [{job.lastRunStatus}]
                        </span>
                      </>
                    )}
                  </div>
                  {expandedOutput === job.id && job.lastRunOutput && (
                    <pre className="mt-2 text-[10px] font-mono text-gray-400 bg-black/40 rounded p-2 max-h-24 overflow-y-auto whitespace-pre-wrap">
                      {job.lastRunOutput}
                    </pre>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => trigger(job.id)}
                    disabled={triggering === job.id}
                    className="text-[10px] font-mono text-gray-500 hover:text-cyan-400 transition-colors disabled:opacity-40"
                    title="Run now"
                  >
                    {triggering === job.id ? '...' : '▶'}
                  </button>
                  <button
                    onClick={() => toggle(job)}
                    className="text-[10px] font-mono text-gray-500 hover:text-yellow-400 transition-colors"
                    title={job.enabled ? 'Pause' : 'Resume'}
                  >
                    {job.enabled ? '⏸' : '⏵'}
                  </button>
                  <button
                    onClick={() => openEdit(job)}
                    className="text-[10px] font-mono text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    [edit]
                  </button>
                  <button
                    onClick={() => remove(job.id)}
                    className="text-[10px] font-mono text-gray-500 hover:text-red-400 transition-colors"
                  >
                    [del]
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard({ onNav }: { onNav: (page: NavPage) => void }) {
  const { events, connected, clear } = useEventStream(200)

  const toolCalls   = events.filter(e => e.type === 'tool_call_end')
  const successful  = toolCalls.filter(e => e.success !== false)
  const avgMs       = toolCalls.length
    ? Math.round(toolCalls.reduce((s, e) => s + (e.durationMs ?? 0), 0) / toolCalls.length)
    : 0
  const sessions    = events.filter(e => e.type === 'session_complete').length
  const reversed    = [...events].reverse()

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #0A0F1C 0%, #0D1829 60%, #0A0F1C 100%)' }}>
      <NavBar page="dashboard" onNav={onNav} />

      <div className="pt-20 pb-12 px-4 sm:px-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ color: '#00D4FF', fontSize: '20px', lineHeight: 1 }}>✳</span>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.02em' }}>
                Activity Dashboard
              </h1>
            </div>
            <p className="text-sm font-mono ml-8" style={{ color: '#A0AEC0' }}>
              Live agent event stream
              <span className={`inline-block w-2 h-2 rounded-full ml-2 ${connected ? 'animate-pulse' : ''}`}
                style={{ background: connected ? '#00e676' : '#555' }} />
              <span className="ml-1">{connected ? 'connected' : 'reconnecting...'}</span>
            </p>
          </div>
          <button
            onClick={clear}
            className="text-xs font-mono transition-colors rounded-lg px-3 py-1.5"
            style={{ color: '#A0AEC0', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.color = '#fff'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { (e.target as HTMLElement).style.color = '#A0AEC0'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)' }}
          >
            clear
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox label="TOOL CALLS" value={toolCalls.length} sub="this session" />
          <StatBox label="SUCCESS RATE" value={toolCalls.length ? `${Math.round(successful.length / toolCalls.length * 100)}%` : '—'} />
          <StatBox label="AVG DURATION" value={avgMs ? `${avgMs}ms` : '—'} />
          <StatBox label="SESSIONS" value={sessions} sub="completed" />
        </div>

        {/* Cron jobs */}
        <div className="mb-8">
          <CronSection />
        </div>

        {/* Event feed */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,24,41,0.80)', border: '1px solid rgba(0,212,255,0.10)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,212,255,0.08)' }}>
            <span className="section-heading">EVENT FEED</span>
            <span className="text-xs font-mono" style={{ color: '#A0AEC0' }}>{events.length} events</span>
          </div>

          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="text-4xl mb-4 opacity-30">⚡</div>
              <p className="text-gray-500 text-sm">Waiting for agent activity...</p>
              <p className="text-gray-600 text-xs mt-2">Start a conversation to see events appear here in real time.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/3 max-h-[60vh] overflow-y-auto">
              {reversed.map((event, i) => (
                <div
                  key={`${event.ts}-${i}`}
                  className={`flex items-start gap-3 px-4 py-3 border-l-2 transition-colors hover:bg-white/2 ${eventColor(event)}`}
                >
                  <span className="text-base mt-0.5 shrink-0">{eventIcon(event.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{eventLabel(event)}</p>
                    {event.sessionId && (
                      <p className="text-xs text-gray-600 font-mono mt-0.5 truncate">
                        {event.sessionId}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-600 font-mono shrink-0 mt-0.5">
                    {relativeTime(event.ts)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
