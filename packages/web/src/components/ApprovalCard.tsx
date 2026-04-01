import { coreClient } from '../api/client'

interface Props {
  approvalId: string
  agentName: string
  toolName: string
  cmd: string
  agentId: string
  onResolved: () => void
}

export function ApprovalCard({ approvalId, agentName, toolName, cmd, agentId, onResolved }: Props) {
  const decide = async (decision: 'approve' | 'deny' | 'always_allow') => {
    await coreClient.resolveApproval(approvalId, decision, agentId, toolName)
    onResolved()
  }

  return (
    <div className="my-4 glass-panel border border-amber-500/40 bg-amber-950/20 p-5 text-sm shadow-[0_4px_20px_rgba(255,176,0,0.1)] relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
      <div className="text-amber-400 font-mono text-xs mb-3 flex items-center gap-2 tracking-widest uppercase">
        <span className="animate-pulse">⚠️</span> SYSTEM_INTERRUPT: {agentName} · {toolName}
      </div>
      <pre className="text-amber-100 bg-black/40 border border-amber-900/50 rounded shadow-inner p-3 text-xs overflow-x-auto mb-4 font-mono leading-relaxed">{cmd}</pre>
      <div className="flex gap-3 font-mono">
        <button
          onClick={() => decide('approve')}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-md text-xs font-bold tracking-widest transition-all hover:scale-105 active:scale-95"
        >
          [APPROVE]
        </button>
        <button
          onClick={() => decide('deny')}
          className="px-4 py-2 bg-red-950/50 border border-red-900/50 hover:bg-red-900 text-red-400 rounded-md text-xs tracking-widest transition-all hover:scale-105 active:scale-95"
        >
          [DENY]
        </button>
        <button
          onClick={() => decide('always_allow')}
          className="px-4 py-2 border border-amber-800/50 hover:border-amber-500/50 text-amber-500 hover:text-amber-400 rounded-md text-xs tracking-widest opacity-70 hover:opacity-100 transition-all"
        >
          [TRUST_MODULE]
        </button>
      </div>
    </div>
  )
}
