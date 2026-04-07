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
          <svg viewBox="0 0 100 100" width="34" height="34" className="shrink-0 text-cyan-400" fill="none" aria-hidden="true">
            <defs>
              <clipPath id="wave-logo-clip">
                <circle cx="50" cy="50" r="46"/>
              </clipPath>
            </defs>
            {/* Circle border */}
            <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="3"/>
            <g clipPath="url(#wave-logo-clip)">
              {/* Main wave body */}
              <path fill="currentColor" d="M6 84 C8 68 18 52 32 40 C42 32 50 24 56 16 C60 10 68 6 76 8 C84 10 88 20 84 30 C80 40 68 44 62 36 C56 28 54 36 54 46 C54 56 64 60 78 60 C88 60 96 58 96 68 L96 96 L4 96 Z"/>
              {/* Wave curl highlight */}
              <path fill="currentColor" opacity="0.4" d="M56 16 C62 6 82 4 84 30 C80 18 68 12 56 16Z"/>
              {/* Foam spray dots */}
              <circle cx="80" cy="4"  r="4"   fill="currentColor" opacity="0.7"/>
              <circle cx="88" cy="8"  r="3"   fill="currentColor" opacity="0.55"/>
              <circle cx="74" cy="2"  r="2.5" fill="currentColor" opacity="0.5"/>
              {/* Birds */}
              <path d="M80 44 Q83 40 86 44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              <path d="M87 36 Q90 32 93 36" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              {/* Water ripple lines */}
              <path d="M4 74 C22 70 44 73 64 71 C78 69 90 72 96 69"  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5"/>
              <path d="M4 84 C28 80 56 83 78 81 C86 80 94 82 96 80"  stroke="currentColor" strokeWidth="2"   strokeLinecap="round" fill="none" opacity="0.35"/>
            </g>
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
