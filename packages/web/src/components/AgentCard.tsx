interface Agent {
  id: string
  name: string
  role: string
  tools: string[]
  builtIn: boolean
  active: boolean
  voice?: string
}

interface Props {
  agent: Agent
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onCredentials?: (id: string) => void
  onBindings?: (id: string) => void
}

const BADGE_STYLE = {
  color: '#94adc4',
  border: '1px solid rgba(26,58,92,0.8)',
  background: 'rgba(10,22,40,0.6)',
} as const

export function AgentCard({ agent, onEdit, onDelete, onToggle, onCredentials, onBindings }: Props) {
  return (
    <div className="feature-card group relative overflow-hidden cursor-default"
      style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
      {/* Active indicator strip */}
      <div className="absolute top-0 left-0 w-0.5 h-full transition-all duration-300"
        style={{ background: agent.active ? '#00e5ff' : '#1a3a5c' }} />

      <div className="pl-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header row: ✳ icon + name */}
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-lg shrink-0" style={{ color: '#00D4FF', lineHeight: 1 }}>✳</span>
            <span className="font-bold text-white text-sm tracking-wide truncate"
              style={{ letterSpacing: '0.04em' }}>
              {agent.name.toUpperCase()}
            </span>
            {agent.builtIn && (
              <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded"
                style={{ color: '#00D4FF', border: '1px solid rgba(0,212,255,0.30)', background: 'rgba(0,212,255,0.06)', letterSpacing: '0.08em' }}>
                CORE
              </span>
            )}
          </div>

          {/* Role */}
          <p className="text-xs mb-3 leading-relaxed line-clamp-2" style={{ color: '#A0AEC0' }}>
            {agent.role}
          </p>

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={BADGE_STYLE}>
              {agent.tools.length} TOOLS
            </span>

            {agent.voice && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded max-w-[110px] truncate"
                style={BADGE_STYLE}
                title={agent.voice}>
                {agent.voice.startsWith('vv:') ? 'AI VOICE' : '♪ ' + agent.voice.split(' ')[0]}
              </span>
            )}

            {/* Online/offline toggle */}
            <button
              onClick={() => onToggle(agent.id, !agent.active)}
              title={agent.active ? 'Click to take offline' : 'Click to bring online'}
              className="text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer"
              style={agent.active ? {
                color: '#00e676',
                border: '1px solid rgba(0,230,118,0.30)',
                background: 'rgba(0,230,118,0.08)',
              } : {
                color: '#ff5252',
                border: '1px solid rgba(255,82,82,0.30)',
                background: 'rgba(255,82,82,0.08)',
              }}
            >
              {agent.active ? '● ONLINE' : '○ OFFLINE'}
            </button>
          </div>
        </div>

        {/* Edit / Delete — visible on hover */}
        <div className="flex flex-col gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(agent)}
            className="text-[11px] font-mono transition-colors hover:underline"
            style={{ color: '#00D4FF' }}
          >
            [EDIT]
          </button>
          {onCredentials && (
            <button
              onClick={() => onCredentials(agent.id)}
              className="text-[11px] font-mono transition-colors hover:underline"
              style={{ color: '#A0AEC0' }}
            >
              [CREDS]
            </button>
          )}
          {onBindings && (
            <button
              onClick={() => onBindings(agent.id)}
              className="text-[11px] font-mono transition-colors hover:underline"
              style={{ color: '#A0AEC0' }}
            >
              [BIND]
            </button>
          )}
          {!agent.builtIn && (
            <button
              onClick={() => onDelete(agent.id)}
              className="text-[11px] font-mono transition-colors hover:underline text-red-500 hover:text-red-400"
            >
              [KILL]
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
