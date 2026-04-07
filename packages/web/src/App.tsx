import { useState, lazy, Suspense, useEffect } from 'react'
import { Onboarding } from './pages/Onboarding'
import { Chat } from './pages/Chat'
import { Models } from './pages/Models'
import { Agents } from './pages/Agents'
import { Settings } from './pages/Settings'
import { System } from './pages/System'
import { Dashboard } from './pages/Dashboard'
import { NavBar, type NavPage } from './components/NavBar'
import { coreClient } from './api/client'
import './index.css'

// Three.js is large — load it async so the onboarding form renders immediately
const OceanScene = lazy(() =>
  import('./components/animations/OceanScene').then((m) => ({ default: m.OceanScene }))
)

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [page, setPage] = useState<NavPage>('chat')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    coreClient.getPersona()
      .then(({ configured }) => {
        if (configured) setSessionId(`session-${Date.now()}`)
      })
      .catch(() => { /* server not running — show onboarding */ })
      .finally(() => setChecking(false))
  }, [])

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#050d1a' }}>
      <div className="text-cyan-500 font-mono text-sm animate-pulse">connecting...</div>
    </div>
  )

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

  const nav = (p: string) => setPage(p as NavPage)

  if (page === 'dashboard') return <Dashboard onNav={nav} />
  if (page === 'agents')    return <Agents onNav={nav} />
  if (page === 'settings')  return <Settings onNav={nav} />
  if (page === 'system')    return <System onNav={nav} />

  if (page === 'models') return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)' }}>
      <NavBar page="models" onNav={nav} />
      <div className="pt-20 px-4 sm:px-6 max-w-4xl mx-auto pb-12">
        <Models />
      </div>
    </div>
  )

  return <Chat sessionId={sessionId} onNav={nav} />
}
