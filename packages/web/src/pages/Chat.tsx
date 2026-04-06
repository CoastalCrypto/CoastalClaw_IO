import { useState, useRef, useEffect, useCallback } from 'react'
import { ChatBubble } from '../components/ChatBubble'
import { AgentThinkingAnimation, guessDomain, type AgentDomain } from '../components/AgentThinkingAnimation'
import { RiveAgent } from '../components/animations/RiveAgent'
import { coreClient, type Session } from '../api/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
  domain?: AgentDomain
}

function exportMarkdown(messages: Message[], sessionId: string) {
  const lines = [`# Conversation ${sessionId}`, `_Exported ${new Date().toLocaleString()}_`, '']
  for (const m of messages) {
    lines.push(`**${m.role === 'user' ? 'You' : 'Agent'}:** ${m.content}`, '')
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `conversation-${sessionId.slice(-8)}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function Chat({ sessionId: initialSessionId, onNav }: { sessionId: string; onNav: (page: string) => void }) {
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }
  ])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [thinkingDomain, setThinkingDomain] = useState<AgentDomain>('general')
  const [activeDomain, setActiveDomain] = useState<AgentDomain>('general')
  const [isListening, setIsListening] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load session history for sidebar
  const loadSessions = useCallback(() => {
    coreClient.listSessions(30).then(({ sessions: s }) => setSessions(s)).catch(() => {})
  }, [])

  useEffect(() => { if (sidebarOpen) loadSessions() }, [sidebarOpen, loadSessions])

  // Speech recognition
  const recognitionRef = useRef<any>(null)
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.onresult = (e: any) => {
        const transcript = Array.from(e.results).map((res: any) => res[0].transcript).join('')
        setInput(transcript)
      }
      recognition.onend = () => {
        setIsListening(false)
        if (inputRef.current.trim().length > 0) sendRef.current()
      }
      recognitionRef.current = recognition
    }
  }, [])

  const inputRef = useRef(input)
  inputRef.current = input
  const sendRef = useRef<() => void>(() => {})

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text.replace(/[*#]/g, ''))
    const voices = window.speechSynthesis.getVoices()
    utterance.voice = voices.find(v => v.name.includes('Google UK English Male')) || voices.find(v => v.lang.startsWith('en')) || null
    utterance.rate = 1.05
    utterance.pitch = 0.9
    window.speechSynthesis.speak(utterance)
  }, [])

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
      const res = await coreClient.sendMessage({ message: text, sessionId: currentSessionId })
      const domain = (res.domain as AgentDomain | undefined) ?? 'general'
      setActiveDomain(domain)
      setMessages((m) => [...m, { role: 'assistant', content: res.reply, domain }])
      speakText(res.reply)
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Connection error. Please try again.' }])
      speakText('Connection error. I am unable to process that request.')
    } finally {
      setLoading(false)
    }
  }
  sendRef.current = send

  // WebSocket
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.hostname || 'localhost'
    const wsPort = window.location.port || '3000'
    const ws = new WebSocket(`${wsProtocol}//${wsHost}:${wsPort}/ws/session`)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'proactive_suggestion' && (!data.sessionId || data.sessionId === currentSessionId)) {
          setSuggestions(prev => [...prev.slice(-2), data.suggestion])
        }
      } catch {}
    }
    return () => ws.close()
  }, [currentSessionId])

  const toggleMic = () => {
    if (!recognitionRef.current) return alert('Speech recognition not supported in this browser.')
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      setInput('')
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

  const resumeSession = (session: Session) => {
    setCurrentSessionId(session.id)
    setMessages([{ role: 'assistant', content: `Resumed: "${session.title}"` }])
    setSuggestions([])
    setSidebarOpen(false)
  }

  const newSession = () => {
    const id = `session-${Date.now()}`
    setCurrentSessionId(id)
    setMessages([{ role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }])
    setSuggestions([])
    setSidebarOpen(false)
  }

  return (
    <div className="flex flex-col h-screen text-white bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-fixed">
      <div className="absolute inset-0 bg-[#0d1117]/85 backdrop-blur-md -z-10" />

      <header className="glass-panel border-b-0 rounded-none px-6 py-3 flex items-center gap-4 z-10 shadow-md">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="text-gray-400 hover:text-cyan-400 transition-colors font-mono text-lg leading-none"
          title="Session history"
        >☰</button>
        <RiveAgent domain={activeDomain} isThinking={loading} size={48} />
        <div>
          <div className="text-xs text-cyan-400 font-mono tracking-widest">{activeDomain.toUpperCase()}</div>
          <div className="text-xs text-cyan-800/80 font-mono">SESSION {currentSessionId.slice(-8).toUpperCase()}</div>
        </div>
        <div className="ml-auto flex gap-4 font-mono text-sm items-center">
          <button
            onClick={() => exportMarkdown(messages, currentSessionId)}
            className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
            title="Export conversation"
          >↓ export</button>
          <button className="text-cyan-400 font-bold tracking-widest bg-cyan-950/30 px-3 py-1 rounded border border-cyan-800/50">/chat</button>
          <button onClick={() => onNav('models')} className="text-gray-400 hover:text-white transition-all">/models</button>
          <button onClick={() => onNav('agents')} className="text-gray-400 hover:text-white transition-all">/agents</button>
          <button onClick={() => onNav('settings')} className="text-gray-400 hover:text-white transition-all">/settings</button>
          <button onClick={() => onNav('system')} className="text-gray-400 hover:text-white transition-all">/system</button>
        </div>
      </header>

      {/* History sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 flex">
          <div className="w-72 bg-[#050d1a]/98 border-r border-gray-800 flex flex-col h-full">
            <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
              <span className="text-sm font-semibold">Conversations</span>
              <button onClick={newSession} className="text-xs text-cyan-400 hover:text-cyan-300 font-mono">+ new</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {sessions.length === 0
                ? <p className="text-gray-600 text-xs p-4">No past conversations yet.</p>
                : sessions.map((s) => (
                    <div
                      key={s.id}
                      className={`flex items-center justify-between px-4 py-3 border-b border-gray-900 hover:bg-gray-800/50 cursor-pointer group ${s.id === currentSessionId ? 'bg-cyan-900/20' : ''}`}
                      onClick={() => resumeSession(s)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{s.title}</p>
                        <p className="text-xs text-gray-600">{new Date(s.updated_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); coreClient.deleteSession(s.id).then(loadSessions) }}
                        className="text-gray-700 hover:text-red-400 transition-colors ml-2 opacity-0 group-hover:opacity-100 text-xs"
                      >✕</button>
                    </div>
                  ))
              }
            </div>
          </div>
          <div className="flex-1" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((m, i) => (
          <div key={i} className="relative group">
            <ChatBubble role={m.role} content={m.content} />
            {m.role === 'assistant' && (
              <button
                onClick={() => copyMessage(m.content, i)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-gray-300 px-2 py-0.5 bg-gray-900/80 rounded"
              >
                {copiedIdx === i ? 'copied!' : 'copy'}
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <AgentThinkingAnimation domain={thinkingDomain} />
          </div>
        )}

        {suggestions.length > 0 && !loading && (
          <div className="flex justify-start gap-3 mt-4 flex-wrap">
            <span className="text-xs text-amber-500 font-mono self-center tracking-widest animate-pulse">[INSIGHT]</span>
            {suggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => { setInput(sug); setSuggestions(prev => prev.filter(s => s !== sug)) }}
                className="text-xs border border-amber-500/30 bg-amber-950/20 text-amber-200/80 px-3 py-1.5 rounded-full hover:bg-amber-500/20 hover:border-amber-500 hover:text-amber-100 transition-all"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="glass-panel rounded-none border-x-0 border-b-0 px-4 py-6 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10">
        <div className="flex gap-4 max-w-4xl mx-auto items-end">
          <div className="flex-1 relative">
            <input
              className="w-full bg-gray-950/80 border border-gray-700 text-cyan-50 font-mono rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all placeholder:text-gray-600"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={isListening ? '> Listening...' : '> Execute command or send message...'}
              disabled={loading}
              autoFocus
            />
            {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
          </div>

          <button
            onClick={toggleMic}
            disabled={loading}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${
              isListening
                ? 'bg-red-500/20 text-red-500 border border-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50'
            }`}
          >
            {isListening ? '⏹' : '🎤'}
          </button>

          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-bold font-mono tracking-widest rounded-xl transition-all text-sm hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)]"
          >
            EXECUTE
          </button>
        </div>
      </div>
    </div>
  )
}
