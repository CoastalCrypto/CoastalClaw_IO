import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'

export type NavPage = 'chat' | 'dashboard' | 'analytics' | 'tools' | 'skills' | 'channels' | 'models' | 'agents' | 'users' | 'settings' | 'system'

interface NavItem { id: NavPage; label: string; icon: string; adminOnly?: boolean }

const NAV_ITEMS: NavItem[] = [
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'tools',     label: 'Tools',     icon: '🔧', adminOnly: true },
  { id: 'skills',    label: 'Skills',    icon: '⚡', adminOnly: true },
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

function useUpdateBanner() {
  const [banner, setBanner] = useState<string | null>(null)
  const loadedVersion = useRef<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/version')
        if (!res.ok) return
        const { version } = await res.json() as { version: string }
        if (!loadedVersion.current) {
          loadedVersion.current = version
        } else if (version !== loadedVersion.current) {
          setBanner(`Server updated to v${version} — refresh to get the latest`)
        }
      } catch {}
    }

    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  // Also listen for Electron update notification
  useEffect(() => {
    const shell = (window as any).coastalShell
    shell?.onUpdateAvailable?.((info: { version: string }) => {
      setBanner(`Desktop update v${info.version} ready — restart to install`)
    })
  }, [])

  return { banner, dismiss: () => setBanner(null) }
}

export function NavBar({ page, onNav, title, currentUser: userProp, onLogout: logoutProp }: NavBarProps) {
  const [open, setOpen] = useState(false)
  const auth = useAuth()
  const currentUser = userProp ?? auth.currentUser
  const onLogout    = logoutProp ?? auth.onLogout
  const isAdmin = currentUser?.role === 'admin'
  const visibleItems = NAV_ITEMS.filter(i => !i.adminOnly || isAdmin)
  const { banner, dismiss } = useUpdateBanner()

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'rgba(10,15,28,0.94)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,212,255,0.10)' }}>
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between max-w-7xl mx-auto">

          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            {/* ✳ brand mark */}
            <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.30)' }}>
              <span style={{ color: '#00D4FF', fontSize: '16px', fontWeight: 700, lineHeight: 1 }}>✳</span>
            </div>
            <span className="font-bold tracking-tight text-white text-sm shrink-0 hidden sm:block"
              style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.01em' }}>
              CoastalClaw
            </span>
            <span className="font-bold tracking-tight text-white text-sm shrink-0 sm:hidden"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              CC
            </span>
            {title && (
              <span className="text-xs font-mono truncate hidden md:block" style={{ color: '#A0AEC0' }}>
                / {title}
              </span>
            )}
          </div>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-0.5">
            {visibleItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all tracking-wide ${
                  page === item.id
                    ? 'text-black font-bold'
                    : 'hover:text-white hover:bg-white/5'
                }`}
                style={page === item.id
                  ? { background: '#00D4FF', fontFamily: 'Space Grotesk, sans-serif' }
                  : { color: '#A0AEC0', fontFamily: 'Space Grotesk, sans-serif' }
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Right: user badge + logout (desktop) + hamburger (mobile) */}
          <div className="flex items-center gap-3">
            {currentUser && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs" style={{ color: '#A0AEC0', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {currentUser.username}
                  <span className={`ml-1.5 text-[10px] font-mono ${currentUser.role === 'admin' ? '' : 'text-gray-600'}`}
                    style={currentUser.role === 'admin' ? { color: '#00D4FF' } : {}}>
                    [{currentUser.role}]
                  </span>
                </span>
                {onLogout && (
                  <button onClick={onLogout}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors font-mono">
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
              <span className={`block h-0.5 w-5 transition-transform origin-center ${open ? 'rotate-45 translate-y-2' : ''}`} style={{ background: '#A0AEC0' }} />
              <span className={`block h-0.5 w-5 transition-opacity ${open ? 'opacity-0' : ''}`} style={{ background: '#A0AEC0' }} />
              <span className={`block h-0.5 w-5 transition-transform origin-center ${open ? '-rotate-45 -translate-y-2' : ''}`} style={{ background: '#A0AEC0' }} />
            </button>
          </div>
        </div>

        {/* Update banner */}
        {banner && (
          <div className="border-t border-amber-500/20 bg-amber-500/8 px-4 py-2 flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-amber-300">{banner}</span>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => window.location.reload()}
                className="text-xs font-mono text-amber-400 border border-amber-500/40 rounded px-2 py-0.5 hover:bg-amber-500/20 transition-colors"
              >
                refresh now
              </button>
              <button onClick={dismiss} className="text-xs text-amber-600 hover:text-amber-400 transition-colors">
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Mobile dropdown */}
        {open && (
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-1"
            style={{ background: 'rgba(10,15,28,0.99)', borderColor: 'rgba(0,212,255,0.10)' }}>
            {visibleItems.map(item => (
              <button
                key={item.id}
                onClick={() => { onNav(item.id); setOpen(false) }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${
                  page === item.id ? '' : 'hover:bg-white/5'
                }`}
                style={page === item.id
                  ? { color: '#00D4FF', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.20)', fontFamily: 'Space Grotesk, sans-serif' }
                  : { color: '#A0AEC0', fontFamily: 'Space Grotesk, sans-serif' }
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {page === item.id && <span className="ml-auto" style={{ color: '#00D4FF' }}>●</span>}
              </button>
            ))}

            {currentUser && (
              <div className="mt-3 pt-3 flex items-center justify-between px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-xs" style={{ color: '#A0AEC0' }}>
                  {currentUser.username} <span className="text-gray-600">[{currentUser.role}]</span>
                </span>
                {onLogout && (
                  <button onClick={() => { onLogout(); setOpen(false) }}
                    className="text-xs text-red-700 hover:text-red-400 transition-colors font-mono">
                    logout
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </nav>
    </>
  )
}
