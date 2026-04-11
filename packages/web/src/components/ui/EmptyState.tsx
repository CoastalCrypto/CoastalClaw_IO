interface Props {
  icon: string
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-4 opacity-40">{icon}</div>
      <p className="text-sm font-semibold text-white mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{title}</p>
      <p className="text-xs mb-5 max-w-xs leading-relaxed" style={{ color: '#94adc4' }}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-mono px-4 py-2 rounded-lg transition-colors"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.30)', color: '#00e5ff', cursor: 'pointer' }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
