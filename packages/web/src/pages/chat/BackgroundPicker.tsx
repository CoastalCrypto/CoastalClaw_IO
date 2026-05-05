import { useState } from 'react'
import { BG_PRESETS } from './types'
import { coreClient } from '../../api/client'

interface BackgroundPickerProps {
  bgPresetId: string
  bgCustomUrl: string
  onApply: (presetId: string, customUrl?: string) => void
  onClose: () => void
}

export function BackgroundPicker({ bgPresetId, bgCustomUrl, onApply, onClose }: BackgroundPickerProps) {
  const [draft, setDraft] = useState(bgCustomUrl)

  return (
    <div className="fixed inset-0 z-30" onClick={onClose}>
      <div
        className="absolute top-16 right-4 w-72 rounded-xl border border-white/10 shadow-2xl p-4"
        style={{ background: 'rgba(5,10,15,0.97)', backdropFilter: 'blur(20px)' }}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-mono text-gray-500 tracking-widest mb-3">CHAT BACKGROUND</p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {BG_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => onApply(p.id, '')}
              title={p.label}
              className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                bgPresetId === p.id && !bgCustomUrl
                  ? 'border-cyan-400 scale-105'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{ background: p.thumb }}
            >
              <span className="absolute bottom-0 inset-x-0 text-[9px] font-mono text-center pb-0.5"
                style={{ textShadow: '0 1px 3px #000', color: '#fff' }}>
                {p.label}
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs font-mono text-gray-600 mb-1.5">Custom image URL</p>
        <div className="flex gap-2">
          <input
            className="flex-1 min-w-0 bg-black/40 border border-white/10 text-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500/60 placeholder-gray-700"
            placeholder="https://..."
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onApply('custom', draft); onClose() } }}
          />
          <button
            onClick={() => { onApply('custom', draft); onClose() }}
            className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono rounded-lg hover:bg-cyan-500/30 transition-colors"
            title="Apply Web URL"
          >set</button>

          <label className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-mono rounded-lg hover:bg-purple-500/30 transition-colors cursor-pointer" title="Upload Local File">
            ↑ app
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const uploadResult = await coreClient.uploadFile(file).catch(err => {
                alert(`Upload failed: ${err.message}`)
                return null
              })
              if (uploadResult?.isImage && uploadResult?.dataUrl) {
                onApply('custom', uploadResult.dataUrl)
                onClose()
              }
              e.target.value = ''
            }} />
          </label>
        </div>
        {bgCustomUrl && (
          <button
            onClick={() => { onApply('coastal', ''); setDraft('') }}
            className="mt-2 text-xs text-gray-600 hover:text-red-400 font-mono transition-colors"
          >✕ clear custom</button>
        )}
      </div>
    </div>
  )
}
