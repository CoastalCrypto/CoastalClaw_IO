import { useState, useEffect } from 'react'
import { coreClient } from '../../api/client'

export function InsightsTab() {
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
