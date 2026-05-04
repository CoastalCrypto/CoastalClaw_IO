export type Tab = 'queue' | 'activity' | 'insights' | 'receipts' | 'settings'

export function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'queue',    label: 'Missions' },
    { id: 'activity', label: 'Activity' },
    { id: 'insights', label: 'Insights' },
    { id: 'receipts', label: 'Receipts' },
    { id: 'settings', label: 'Settings' },
  ]
  return (
    <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={`px-4 py-2 text-sm font-mono transition-colors ${
            tab === t.id
              ? 'text-cyan-400 border-b-2 border-cyan-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
