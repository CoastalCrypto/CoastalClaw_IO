import { useState, useEffect } from 'react'
import { coreClient } from '../../api/client'

export function SettingsTab({ onStatusChange }: { onStatusChange: (s: any) => void }) {
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
