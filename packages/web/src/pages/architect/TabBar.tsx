import { useEffect } from 'react'

export type Tab = 'queue' | 'activity' | 'insights' | 'receipts' | 'settings'

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: 'queue',    label: 'Missions', key: '1' },
  { id: 'activity', label: 'Activity', key: '2' },
  { id: 'insights', label: 'Insights', key: '3' },
  { id: 'receipts', label: 'Receipts', key: '4' },
  { id: 'settings', label: 'Settings', key: '5' },
]

export function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const match = TABS.find(t => t.key === e.key)
      if (match) setTab(match.id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setTab])

  return (
    <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      {TABS.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-4 py-2 text-sm font-mono transition-colors ${
            tab === t.id
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
          title={`${t.label} (${t.key})`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
