import { useState } from 'react'

export type NavPage = 'chat' | 'dashboard' | 'models' | 'agents' | 'settings' | 'system'

interface NavItem { id: NavPage; label: string; icon: string }

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'models',    label: 'Models',    icon: '🧠' },
  { id: 'agents',    label: 'Agents',    icon: '🤖' },
  { id: 'settings',  label: 'Settings',  icon: '⚙️' },
  { id: 'system',    label: 'System',    icon: '📡' },
]

interface NavBarProps {
  page: NavPage
  onNav: (page: NavPage) => void
  title?: string
}

export function NavBar({ page, onNav, title }: NavBarProps) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
      style={{ background: 'rgba(5,13,26,0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between max-w-7xl mx-auto">

        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs tracking-widest text-cyan-500 shrink-0 hidden sm:block">
            {'>'} COASTAL_OS
          </span>
          <span className="font-mono text-xs tracking-widest text-cyan-500 shrink-0 sm:hidden">
            {'>'} CC
          </span>
          {title && (
            <span className="text-xs font-mono text-gray-500 truncate hidden md:block">
              / {title}
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              className={`px-3 py-1.5 rounded-md font-mono text-xs transition-all ${
                page === item.id
                  ? 'text-black bg-cyan-400 font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              /{item.label.toLowerCase()}
            </button>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col gap-1.5 p-2 rounded-md hover:bg-white/5 transition-colors"
          onClick={() => setOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-5 bg-gray-400 transition-transform origin-center ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block h-0.5 w-5 bg-gray-400 transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-gray-400 transition-transform origin-center ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-white/5 px-4 py-3 flex flex-col gap-1"
          style={{ background: 'rgba(5,13,26,0.98)' }}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { onNav(item.id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 rounded-lg font-mono text-sm transition-all flex items-center gap-3 ${
                page === item.id
                  ? 'text-cyan-400 bg-cyan-500/10 border border-cyan-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span>/{item.label.toLowerCase()}</span>
              {page === item.id && <span className="ml-auto text-cyan-500">●</span>}
            </button>
          ))}
        </div>
      )}
    </nav>
  )
}
