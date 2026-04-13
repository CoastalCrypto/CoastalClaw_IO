interface Props {
  icon: string
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action, secondaryAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div style={{
        fontSize: 48, marginBottom: 20, opacity: 0.5,
        filter: 'drop-shadow(0 0 16px rgba(0,229,255,0.3))',
        animation: 'pulse 3s ease-in-out infinite',
      }}>{icon}</div>
      <p style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 18, color: '#e2f4ff', marginBottom: 8, letterSpacing: '-0.5px' }}>{title}</p>
      <p style={{ color: '#94adc4', fontSize: 13, maxWidth: 320, lineHeight: 1.6, marginBottom: 24 }}>{description}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {action && (
          <button
            onClick={action.onClick}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
              background: '#00e5ff', color: '#050a0f', border: 'none', cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        )}
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)',
              color: '#00e5ff', cursor: 'pointer',
            }}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}
