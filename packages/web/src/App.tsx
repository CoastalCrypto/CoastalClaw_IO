import { useState, lazy, Suspense, useEffect } from 'react'
import { AuthContext, type AuthUser } from './context/AuthContext'
import { Onboarding } from './pages/Onboarding'
import { Login } from './pages/Login'
import { ChangePassword } from './pages/ChangePassword'
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
import { Pipeline } from './pages/Pipeline'
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
  const [,            setNeedsSetup]  = useState(false)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [sessionId,   setSessionId]   = useState<string | null>(null)
  const [page,        setPage]        = useState<NavPage>('chat')

  useEffect(() => {
    async function init() {
      try {
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050a0f' }}>
      <div className="font-mono text-sm animate-pulse" style={{ color: '#00e5ff' }}>connecting...</div>
    </div>
  )

  if (!currentUser) {
    return <Login onLogin={handleLogin} />
  }

  // Force password change for default admin account before entering the app
  if ((currentUser as any).mustChangePassword) {
    return (
      <ChangePassword onDone={(updatedUser) => {
        const merged = { ...currentUser, ...updatedUser, mustChangePassword: false }
        setCurrentUser(merged)
        sessionStorage.setItem('cc_user', JSON.stringify(merged))
      }} />
    )
  }

  if (!sessionId) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ position: 'relative' }}>
      <Suspense fallback={<div style={{ position: 'absolute', inset: 0, background: '#050a0f' }} />}>
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
      {page === 'pipeline'  && <Pipeline onNav={nav} />}
      {page === 'settings'  && <Settings onNav={nav} />}
      {page === 'system'    && <System onNav={nav} />}
      {page === 'users'     && <Users onNav={nav} currentUserId={currentUser.id} />}
      {page === 'models'    && (
        <div className="min-h-screen" style={{ background: '#050a0f', color: '#e2f4ff' }}>
          <NavBar page="models" onNav={nav} />
          <div className="pt-20 px-4 sm:px-6 max-w-4xl mx-auto pb-12">
            <Models />
          </div>
        </div>
      )}
      {/* Always mounted so chat history and session survive page navigation */}
      <div style={{ display: page === 'chat' ? 'block' : 'none' }}>
        <Chat sessionId={sessionId} onNav={p => nav(p as NavPage)} />
      </div>
    </AuthContext.Provider>
  )
}
