import type { ModelGroup } from '../api/client'

interface ModelCardProps {
  group: ModelGroup
  onRemove: (variantId: string) => void
  removingId?: string
}

export function ModelCard({ group, onRemove, removingId }: ModelCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="mb-3">
        <div className="font-semibold text-white">{group.baseName}</div>
        <div className="text-xs text-gray-500 mt-0.5">{group.hfSource}</div>
      </div>
      <div className="space-y-2">
        {group.variants.map((v) => {
          const isRemoving = removingId === v.id
          return (
            <div key={v.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded">
                  {v.quantLevel}
                </span>
                <span className="text-xs text-gray-500">{v.sizeGb.toFixed(1)} GB</span>
              </div>
              <button
                onClick={() => onRemove(v.id)}
                disabled={isRemoving}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
              >
                {isRemoving ? 'Removing\u2026' : 'Remove'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
