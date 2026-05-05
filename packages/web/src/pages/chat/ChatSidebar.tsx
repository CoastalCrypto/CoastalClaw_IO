import type { Session } from '../../api/client'
import { coreClient } from '../../api/client'

interface ChatSidebarProps {
  sessions: Session[]
  currentSessionId: string
  onResume: (session: Session) => void
  onNew: () => void
  onClose: () => void
  onReload: () => void
}

export function ChatSidebar({ sessions, currentSessionId, onResume, onNew, onClose, onReload }: ChatSidebarProps) {
  return (
    <div className="fixed inset-0 z-20 flex">
      <div className="w-72 bg-[#050a0f]/98 border-r border-gray-800 flex flex-col h-full">
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
          <span className="text-sm font-semibold">Conversations</span>
          <button onClick={onNew} className="text-xs text-cyan-400 hover:text-cyan-300 font-mono">+ new</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0
            ? <p className="text-gray-600 text-xs p-4">No past conversations.</p>
            : sessions.map((s) => (
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 border-b border-gray-900 hover:bg-gray-800/50 cursor-pointer group ${s.id === currentSessionId ? 'bg-cyan-900/20' : ''}`} onClick={() => onResume(s)}>
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{s.title}</p>
                    <p className="text-xs text-gray-600">{new Date(s.updated_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); coreClient.deleteSession(s.id).then(onReload) }} className="text-gray-700 hover:text-red-400 transition-colors ml-2 opacity-0 group-hover:opacity-100 text-xs">✕</button>
                </div>
              ))
          }
        </div>
      </div>
      <div className="flex-1" onClick={onClose} />
    </div>
  )
}
