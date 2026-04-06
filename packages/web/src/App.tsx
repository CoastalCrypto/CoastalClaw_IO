import { useState, lazy, Suspense, useEffect } from 'react'
import { Onboarding } from './pages/Onboarding'
import { Chat } from './pages/Chat'
import { Models } from './pages/Models'
import { Agents } from './pages/Agents'
import { Settings } from './pages/Settings'
import { System } from './pages/System'
import { coreClient } from './api/client'
import './index.css'

// Three.js is large — load it async so the onboarding form renders immediately
const OceanScene = lazy(() =>
  import('./components/animations/OceanScene').then((m) => ({ default: m.OceanScene }))
)

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [page, setPage] = useState<'chat' | 'models' | 'agents' | 'settings' | 'system'>('chat')
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

  if (page === 'agents') return <Agents onNav={(p) => setPage(p as any)} />

  if (page === 'settings') return <Settings onNav={(p) => setPage(p as any)} />
  if (page === 'system')   return <System onNav={(p) => setPage(p as any)} />

  if (page === 'models') return (
    <div className="min-h-screen text-white bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-fixed">
      <div className="absolute inset-0 bg-[#0d1117]/80 backdrop-blur-sm -z-10" />
      <nav className="fixed top-0 left-0 right-0 z-10 glass-panel border-b-0 rounded-none px-6 py-3 flex justify-between items-center shadow-md">
        <span className="text-sm font-mono tracking-wider" style={{ color: 'var(--color-console-cyan)' }}>{'>'} EXECUTIVE_OS [MODELS]</span>
        <div className="flex gap-6 font-mono text-sm">
          <button onClick={() => setPage('chat')} className="text-gray-400 hover:text-white hover:animate-glow-pulse transition-all">/chat</button>
          <button className="text-cyan-400 font-bold tracking-widest bg-cyan-950/30 px-3 py-1 rounded border border-cyan-800/50">/models</button>
          <button onClick={() => setPage('agents')} className="text-gray-400 hover:text-white hover:animate-glow-pulse transition-all">/agents</button>
          <button onClick={() => setPage('settings')} className="text-gray-400 hover:text-white hover:animate-glow-pulse transition-all">/settings</button>
          <button onClick={() => setPage('system')} className="text-gray-400 hover:text-white hover:animate-glow-pulse transition-all">/system</button>
        </div>
      </nav>
      <div className="pt-20 px-6 max-w-4xl mx-auto">
        <Models />
      </div>
    </div>
  )

  return <Chat sessionId={sessionId} onNav={(p) => setPage(p as any)} />
}
