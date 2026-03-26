import { useState, useRef, useEffect } from 'react'
import { ChatBubble } from '../components/ChatBubble'
import { AgentThinkingAnimation, guessDomain, type AgentDomain } from '../components/AgentThinkingAnimation'
import { RiveAgent } from '../components/animations/RiveAgent'
import { coreClient } from '../api/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
  domain?: AgentDomain
}

export function Chat({ sessionId, onNav }: { sessionId: string; onNav: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingDomain, setThinkingDomain] = useState<AgentDomain>('general')
  const [activeDomain, setActiveDomain] = useState<AgentDomain>('general')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setThinkingDomain(guessDomain(text))
    setLoading(true)
    try {
      const res = await coreClient.sendMessage({ message: text, sessionId })
      const domain = (res.domain as AgentDomain | undefined) ?? 'general'
      setActiveDomain(domain)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, domain }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <RiveAgent domain={activeDomain} isThinking={loading} size={48} />
        <div>
          <div className="text-xs text-cyan-400 font-mono tracking-widest">{activeDomain.toUpperCase()}</div>
          <div className="text-xs text-gray-500 font-mono">SESSION {sessionId.slice(-8).toUpperCase()}</div>
        </div>
        <button onClick={onNav} className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto">
          Models
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <AgentThinkingAnimation domain={thinkingDomain} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message your agent..."
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
