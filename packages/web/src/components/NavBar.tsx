import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export type NavPage = 'chat' | 'dashboard' | 'analytics' | 'tools' | 'channels' | 'models' | 'agents' | 'users' | 'settings' | 'system'

interface NavItem { id: NavPage; label: string; icon: string; adminOnly?: boolean }

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'tools',     label: 'Tools',     icon: '🔧', adminOnly: true },
  { id: 'channels',  label: 'Channels',  icon: '📣', adminOnly: true },
  { id: 'models',    label: 'Models',    icon: '🧠', adminOnly: true },
  { id: 'agents',    label: 'Agents',    icon: '🤖', adminOnly: true },
  { id: 'users',     label: 'Users',     icon: '👤', adminOnly: true },
  { id: 'settings',  label: 'Settings',  icon: '⚙️', adminOnly: true },
  { id: 'system',    label: 'System',    icon: '📡', adminOnly: true },
]

interface NavBarProps {
  page: NavPage
  onNav: (page: NavPage) => void
  title?: string
  currentUser?: { username: string; role: string } | null
  onLogout?: () => void
}

export function NavBar({ page, onNav, title, currentUser: userProp, onLogout: logoutProp }: NavBarProps) {
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const currentUser = userProp ?? auth.currentUser
  const onLogout    = logoutProp ?? auth.onLogout
  const isAdmin = currentUser?.role === 'admin'
  const visibleItems = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5"
      style={{ background: 'rgba(5,13,26,0.92)', backdropFilter: 'blur(16px)' }}>
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between max-w-7xl mx-auto">

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Wave logo */}
          <svg width="32" height="22" viewBox="0 0 32 22" fill="none" className="shrink-0 text-cyan-400" aria-hidden="true">
            <path d="M1 8 C4.5 2, 9 2, 12 8 C15 14, 19.5 14, 23 8 C26.5 2, 31 2, 34 8"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <path d="M1 14 C4.5 8, 9 8, 12 14 C15 20, 19.5 20, 23 14 C26.5 8, 31 8, 34 14"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.45"/>
          </svg>
          <span className="font-mono text-xs tracking-widest text-cyan-500 shrink-0 hidden sm:block">
            COASTAL_OS
          </span>
          <span className="font-mono text-xs tracking-widest text-cyan-500 shrink-0 sm:hidden">
            CC
          </span>
          {title && (
            <span className="text-xs font-mono text-gray-500 truncate hidden md:block">
              / {title}
            </span>
          )}
        </div>

        {/* Desktop nav */}
        <div className="hidden sm:flex items-center gap-1">
          {visibleItems.map(item => (
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

        {/* Right: user badge + logout (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-3">
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="font-mono text-xs text-gray-500">
                {currentUser.username}
                <span className={`ml-1.5 text-[10px] ${currentUser.role === 'admin' ? 'text-cyan-600' : 'text-gray-600'}`}>
                  [{currentUser.role}]
                </span>
              </span>
              {onLogout && (
                <button onClick={onLogout}
                  className="font-mono text-xs text-gray-600 hover:text-red-400 transition-colors">
                  logout
                </button>
              )}
            </div>
          )}

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
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="sm:hidden border-t border-white/5 px-4 py-3 flex flex-col gap-1"
          style={{ background: 'rgba(5,13,26,0.98)' }}>
          {visibleItems.map(item => (
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

          {/* User info + logout in mobile menu */}
          {currentUser && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between px-4">
              <span className="font-mono text-xs text-gray-500">
                {currentUser.username} <span className="text-gray-600">[{currentUser.role}]</span>
              </span>
              {onLogout && (
                <button onClick={() => { onLogout(); setOpen(false) }}
                  className="font-mono text-xs text-red-700 hover:text-red-400 transition-colors">
                  logout
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
