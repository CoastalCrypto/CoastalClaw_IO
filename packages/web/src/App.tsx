import { useState, lazy, Suspense } from 'react'
import { Onboarding } from './pages/Onboarding'
import { Chat } from './pages/Chat'
import { Models } from './pages/Models'
import './index.css'

// Three.js is large — load it async so the onboarding form renders immediately
const OceanScene = lazy(() =>
  import('./components/animations/OceanScene').then((m) => ({ default: m.OceanScene }))
)

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [page, setPage] = useState<'chat' | 'models'>('chat')

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

  if (page === 'models') return (
    <div>
      <nav className="fixed top-0 left-0 right-0 z-10 bg-gray-950 border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <span className="text-sm text-gray-400 font-mono">COASTAL CLAW</span>
        <div className="flex gap-4">
          <button onClick={() => setPage('chat')} className="text-sm text-gray-400 hover:text-white transition-colors">Chat</button>
          <button className="text-sm text-cyan-400">Models</button>
        </div>
      </nav>
      <div className="pt-14">
        <Models />
      </div>
    </div>
  )

  return <Chat sessionId={sessionId} onNav={() => setPage('models')} />
}
