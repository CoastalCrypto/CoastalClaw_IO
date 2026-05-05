import { SHORTCUTS } from './types'

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-mono text-cyan-400 text-sm tracking-widest">KEYBOARD SHORTCUTS</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-400">✕</button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex justify-between text-sm">
              <kbd className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 font-mono text-xs text-cyan-300">{key}</kbd>
              <span className="text-gray-400">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4 text-center">Press ? or Esc to close</p>
      </div>
    </div>
  )
}
