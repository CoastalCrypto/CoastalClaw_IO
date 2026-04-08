import { useState, lazy, Suspense, useEffect } from 'react'
import { AuthContext, type AuthUser } from './context/AuthContext'
import { Onboarding } from './pages/Onboarding'
import { Login } from './pages/Login'
import { Chat } from './pages/Chat'
import { Models } from './pages/Models'
import { Agents } from './pages/Agents'
import { Settings } from './pages/Settings'
import { System } from './pages/System'
import { Dashboard } from './pages/Dashboard'
import { Analytics } from './pages/Analytics'
import { Tools } from './pages/Tools'
import { Skills } from './pages/Skills'
import { Channels } from './pages/Channels'
import { Users } from './pages/Users'
import { NavBar, type NavPage } from './components/NavBar'
import { TitleBar } from './components/TitleBar'
import { coreClient } from './api/client'
import './index.css'

// Three.js is large — load it async so the onboarding form renders immediately
const OceanScene = lazy(() =>
  import('./components/animations/OceanScene').then((m) => ({ default: m.OceanScene }))
)

function loadStoredUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem('cc_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export default function App() {
  const [checking,    setChecking]    = useState(true)
  const [needsSetup,  setNeedsSetup]  = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [sessionId,   setSessionId]   = useState<string | null>(null)
  const [page,        setPage]        = useState<NavPage>('chat')

  useEffect(() => {
    async function init() {
      try {
        const { needsSetup: ns } = await coreClient.checkSetup()
        if (ns) { setNeedsSetup(true); setChecking(false); return }

        const storedUser = loadStoredUser()
        if (!storedUser || !sessionStorage.getItem('cc_admin_session')) {
          setChecking(false); return
        }

        try {
          const { user } = await coreClient.getMe()
          setCurrentUser(user)
        } catch {
          coreClient.clearSession()
          setChecking(false); return
        }

        const { configured } = await coreClient.getPersona()
        if (configured) setSessionId(`session-${Date.now()}`)
      } catch {
        // Server not reachable — fall through to login
      } finally {
        setChecking(false)
      }
    }
    init()
  }, [])

  const handleLogin = async (sessionToken: string, user: AuthUser) => {
    coreClient.setSession(sessionToken)
    sessionStorage.setItem('cc_user', JSON.stringify(user))
    // Show spinner while checking persona — avoids Onboarding flash for returning users
    setChecking(true)
    try {
      const { configured } = await coreClient.getPersona()
      setCurrentUser(user)
      setNeedsSetup(false)
      if (configured) setSessionId(`session-${Date.now()}`)
    } catch {
      setCurrentUser(user)
      setNeedsSetup(false)
    } finally {
      setChecking(false)
    }
  }

  const handleLogout = () => {
    coreClient.clearSession()
    setCurrentUser(null)
    setSessionId(null)
    setPage('chat')
  }

  const nav = (p: NavPage) => setPage(p)

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050d1a' }}>
      <div className="text-cyan-500 font-mono text-sm animate-pulse">connecting...</div>
    </div>
  )

  if (needsSetup || !currentUser) {
    return <Login setupMode={needsSetup} onLogin={handleLogin} />
  }

  if (!sessionId) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ position: 'relative' }}>
      <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: '#050d1a' }} />}>
        <OceanScene />
      </Suspense>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Onboarding onComplete={setSessionId} />
      </div>
    </div>
  )

  return (
    <AuthContext.Provider value={{ currentUser, onLogout: handleLogout }}>
      <TitleBar />
      {page === 'dashboard' && <Dashboard onNav={nav} />}
      {page === 'analytics' && <Analytics onNav={nav} />}
      {page === 'tools'     && <Tools onNav={nav} />}
      {page === 'skills'    && <Skills onNav={nav} />}
      {page === 'channels'  && <Channels onNav={nav} />}
      {page === 'agents'    && <Agents onNav={nav} />}
      {page === 'settings'  && <Settings onNav={nav} />}
      {page === 'system'    && <System onNav={nav} />}
      {page === 'users'     && <Users onNav={nav} currentUserId={currentUser.id} />}
      {page === 'models'    && (
        <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}>
          <NavBar page="models" onNav={nav} />
          <div className="pt-20 px-4 sm:px-6 max-w-4xl mx-auto pb-12">
            <Models />
          </div>
        </div>
      )}
      {page === 'chat' && <Chat sessionId={sessionId} onNav={p => nav(p as NavPage)} />}
    </AuthContext.Provider>
  )
}
