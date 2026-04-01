import { useState } from 'react'

interface Action {
  toolName: string
  decision: string
  durationMs: number
}

interface Props {
  actions: Action[]
}

export function ActionLogPanel({ actions }: Props) {
  const [open, setOpen] = useState(false)
  if (actions.length === 0) return null

  const summary = [...new Map(actions.map(a => [a.toolName, a])).values()]
    .map(a => a.toolName)
    .join(' · ')

  return (
    <div className="mt-3 text-xs bg-gray-950/50 border border-gray-800 rounded p-2 font-mono">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left flex items-center gap-2 hover:text-cyan-400 text-gray-400 transition-colors group"
      >
        <span className="text-cyan-600 group-hover:text-cyan-400 transition-colors">{open ? '[-]' : '[+]'}</span> 
        <span className="tracking-widest opacity-80">SYS_LOGS:</span> 
        <span className="truncate opacity-60 text-cyan-100">{summary}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-1.5 pl-4 border-l-2 border-cyan-900/40">
          {actions.map((a, i) => (
            <div key={i} className="flex gap-3 hover:bg-gray-800/30 px-2 py-1 rounded transition-colors">
              <span className={a.decision === 'allow' || a.decision === 'approved' ? 'text-green-500' : 'text-red-500'}>
                {a.decision === 'allow' || a.decision === 'approved' ? '[OK]' : '[ERR]'}
              </span>
              <span className="text-cyan-200 w-32 shrink-0">{a.toolName}</span>
              <span className="text-gray-500">{a.durationMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
