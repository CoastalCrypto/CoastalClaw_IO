interface Agent {
  id: string
  name: string
  role: string
  tools: string[]
  builtIn: boolean
  active: boolean
}

interface Props {
  agent: Agent
  onEdit: (agent: Agent) => void
  onDelete: (id: string) => void
}

export function AgentCard({ agent, onEdit, onDelete }: Props) {
  return (
    <div className="glass-panel p-5 hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_20px_rgba(0,255,255,0.15)] group relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/0 group-hover:bg-cyan-500/80 transition-colors"></div>
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-mono text-sm tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
              {agent.name.toUpperCase()}
            </span>
            {agent.builtIn && (
              <span className="text-[10px] text-cyan-400/80 border border-cyan-800 bg-cyan-950/30 rounded px-1.5 py-0.5 tracking-wider font-mono">
                CORE_MODULE
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mb-3 font-mono leading-relaxed line-clamp-2">
            {'>'} {agent.role}
          </div>
          <div className="flex gap-2 text-[10px] font-mono tracking-widest text-cyan-500/60">
            <span className="border border-gray-800 px-2 py-0.5 rounded bg-black/20">
              {agent.tools.length} TOOLS
            </span>
            {agent.active ? (
              <span className="border border-green-900/50 text-green-400 px-2 py-0.5 rounded bg-green-950/20">
                ONLINE
              </span>
            ) : (
              <span className="border border-red-900/50 text-red-400 px-2 py-0.5 rounded bg-red-950/20">
                OFFLINE
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(agent)}
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-mono hover:underline"
          >
            [EDIT]
          </button>
          {!agent.builtIn && (
            <button
              onClick={() => onDelete(agent.id)}
              className="text-xs text-red-500 hover:text-red-400 transition-colors font-mono hover:underline"
            >
              [KILL]
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
