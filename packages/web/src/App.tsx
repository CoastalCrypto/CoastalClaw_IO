import { useState } from 'react'
import { Onboarding } from './pages/Onboarding'
import { Chat } from './pages/Chat'
import './index.css'

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)

  if (!sessionId) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <Onboarding onComplete={setSessionId} />
    </div>
  )

  return <Chat sessionId={sessionId} />
}
