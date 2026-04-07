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
    <div className="rounded-xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
      <div className="text-xs font-mono text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  )
}

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
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}>
      <NavBar page="dashboard" onNav={onNav} />

      <div className="pt-20 pb-12 px-4 sm:px-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Activity Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">
              Live agent event stream
              <span className={`inline-block w-2 h-2 rounded-full ml-2 ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
              {connected ? ' connected' : ' reconnecting...'}
            </p>
          </div>
          <button
            onClick={clear}
            className="text-xs font-mono text-gray-600 hover:text-gray-400 transition-colors border border-white/5 rounded-lg px-3 py-1.5 hover:border-white/10"
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

        {/* Event feed */}
        <div className="rounded-xl border border-white/8 overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-mono text-gray-400">EVENT FEED</span>
            <span className="text-xs font-mono text-gray-600">{events.length} events</span>
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
