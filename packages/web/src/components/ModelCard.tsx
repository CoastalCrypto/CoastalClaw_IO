import type { ModelGroup } from '../api/client'

interface ModelCardProps {
  group: ModelGroup
  onRemove: (variantId: string) => void
  removingId?: string
}

export function ModelCard({ group, onRemove, removingId }: ModelCardProps) {
  return (
    <div className="feature-card" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: '#00D4FF', fontSize: '14px', lineHeight: 1 }}>✳</span>
          <span className="font-bold text-white text-sm">{group.baseName}</span>
        </div>
        <div className="text-xs font-mono ml-5" style={{ color: '#A0AEC0' }}>{group.hfSource}</div>
      </div>
      <div className="space-y-2 ml-5">
        {group.variants.length === 0 ? (
          <div className="text-xs" style={{ color: '#A0AEC0' }}>No variants installed</div>
        ) : (
          group.variants.map((v) => {
            const isRemoving = removingId === v.id
            return (
              <div key={v.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ color: '#00D4FF', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.20)' }}>
                    {v.quantLevel}
                  </span>
                  <span className="text-xs font-mono" style={{ color: '#A0AEC0' }}>{v.sizeGb.toFixed(1)} GB</span>
                </div>
                <button
                  onClick={() => onRemove(v.id)}
                  disabled={isRemoving}
                  aria-label={isRemoving ? `Removing ${v.quantLevel}` : `Remove ${v.quantLevel}`}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors font-mono"
                >
                  {isRemoving ? 'Removing\u2026' : 'Remove'}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
