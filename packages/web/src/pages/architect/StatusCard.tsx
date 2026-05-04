export function StatusCard({ status }: { status: { power: string; mode: string } | null }) {
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
