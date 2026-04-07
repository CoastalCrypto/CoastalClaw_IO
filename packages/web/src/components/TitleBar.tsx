// Frameless window title bar — only renders inside Electron
declare global {
  interface Window {
    coastalShell?: {
      isElectron?: boolean
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

export function TitleBar() {
  const shell = window.coastalShell
  if (!shell?.isElectron) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-end"
      style={{ height: '28px', WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Window controls — right side, not draggable */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={shell.minimize}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors text-xs"
          title="Minimise"
        >
          ─
        </button>
        <button
          onClick={shell.maximize}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors text-xs"
          title="Maximise"
        >
          □
        </button>
        <button
          onClick={shell.close}
          className="w-10 h-7 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
          title="Close"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
