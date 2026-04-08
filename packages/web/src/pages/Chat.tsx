import { useState, useRef, useEffect, useCallback, type DragEvent } from 'react'
import { ChatBubble } from '../components/ChatBubble'
import { ApprovalCard } from '../components/ApprovalCard'
import { AgentThinkingAnimation, guessDomain, type AgentDomain } from '../components/AgentThinkingAnimation'
import { coreClient, type Session } from '../api/client'

type MessageRole = 'user' | 'assistant' | 'approval' | 'team'
interface Message {
  role: MessageRole
  content: string
  domain?: AgentDomain
  // approval fields
  approvalId?: string
  agentName?: string
  toolName?: string
  cmd?: string
  resolved?: boolean
  // team fields
  subtasks?: Array<{ subtaskId: string; reply: string }>
  subtaskCount?: number
}

interface BgPreset {
  id: string
  label: string
  css: string        // full CSS background value
  overlay: string    // rgba overlay on top
  thumb: string      // inline style for the swatch preview
  isImage?: boolean
}

const BG_PRESETS: BgPreset[] = [
  {
    id: 'coastal',
    label: 'Coastal',
    css: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)',
    overlay: 'rgba(0,0,0,0)',
    thumb: 'linear-gradient(135deg, #050d1a 0%, #0a1628 50%, #050d1a 100%)',
  },
  {
    id: 'void',
    label: 'Void',
    css: '#000000',
    overlay: 'rgba(0,0,0,0)',
    thumb: '#000000',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    css: 'linear-gradient(135deg, #0a0015 0%, #120030 50%, #0a0015 100%)',
    overlay: 'rgba(0,0,0,0)',
    thumb: 'linear-gradient(135deg, #0a0015, #120030)',
  },
  {
    id: 'aurora',
    label: 'Aurora',
    css: 'linear-gradient(135deg, #001a1a 0%, #001828 40%, #0d0020 100%)',
    overlay: 'rgba(0,0,0,0)',
    thumb: 'linear-gradient(135deg, #001a1a, #0d0020)',
  },
  {
    id: 'ember',
    label: 'Ember',
    css: 'linear-gradient(135deg, #1a0600 0%, #200010 50%, #050d1a 100%)',
    overlay: 'rgba(0,0,0,0)',
    thumb: 'linear-gradient(135deg, #1a0600, #200010)',
  },
  {
    id: 'ocean-photo',
    label: 'Ocean',
    css: "url('https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80') center/cover fixed",
    overlay: 'rgba(5,13,26,0.82)',
    thumb: "url('https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&q=60') center/cover",
    isImage: true,
  },
  {
    id: 'cyber-photo',
    label: 'Cyber',
    css: "url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1920&q=80') center/cover fixed",
    overlay: 'rgba(13,17,23,0.85)',
    thumb: "url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=400&q=60') center/cover",
    isImage: true,
  },
  {
    id: 'space-photo',
    label: 'Space',
    css: "url('https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80') center/cover fixed",
    overlay: 'rgba(0,0,0,0.7)',
    thumb: "url('https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=60') center/cover",
    isImage: true,
  },
]

const LS_BG_KEY = 'cc_chat_bg'

function loadSavedBg(): { presetId: string; customUrl: string } {
  try {
    const raw = localStorage.getItem(LS_BG_KEY)
    return raw ? JSON.parse(raw) : { presetId: 'coastal', customUrl: '' }
  } catch {
    return { presetId: 'coastal', customUrl: '' }
  }
}

const SHORTCUTS = [
  { key: 'Enter', desc: 'Send message' },
  { key: 'Shift+Enter', desc: 'New line' },
  { key: '/', desc: 'Focus input' },
  { key: '?', desc: 'Show shortcuts' },
  { key: 'Esc', desc: 'Close sidebar / overlay' },
  { key: 'Ctrl+Alt+T', desc: 'Open terminal (OS)' },
  { key: 'Ctrl+Alt+R', desc: 'Restart server (OS)' },
  { key: 'Ctrl+Alt+Del', desc: 'Power menu (OS)' },
  { key: 'Super+L', desc: 'Lock screen (OS)' },
  { key: 'Print Screen', desc: 'Screenshot (OS)' },
]

function exportMarkdown(messages: Message[], sessionId: string) {
  const lines = [`# Conversation ${sessionId}`, `_Exported ${new Date().toLocaleString()}_`, '']
  for (const m of messages) {
    if (m.role === 'user' || m.role === 'assistant') {
      lines.push(`**${m.role === 'user' ? 'You' : 'Agent'}:** ${m.content}`, '')
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `conversation-${sessionId.slice(-8)}.md`
  a.click()
  URL.revokeObjectURL(a.href)
}

function TeamResult({ msg }: { msg: Message }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[80%] bg-gray-800 border border-cyan-900/60 rounded-2xl px-4 py-3 text-sm">
        <div className="flex items-center gap-2 mb-2 text-xs text-cyan-500 font-mono">
          <span className="animate-none">⚡ TEAM</span>
          <span className="text-gray-600">·</span>
          <span>{msg.subtaskCount} subtasks</span>
          {(msg.subtaskCount ?? 0) > 0 && (
            <button onClick={() => setOpen(o => !o)} className="ml-auto text-gray-600 hover:text-gray-400">
              {open ? '▲ hide' : '▼ show subtasks'}
            </button>
          )}
        </div>
        <ChatBubble role="assistant" content={msg.content} />
        {open && msg.subtasks && (
          <div className="mt-3 space-y-2 border-t border-gray-700 pt-3">
            {msg.subtasks.map((s) => (
              <div key={s.subtaskId} className="text-xs bg-gray-900 rounded p-2">
                <div className="text-gray-500 font-mono mb-1">{s.subtaskId}</div>
                <div className="text-gray-300">{s.reply}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// WebSocket with auto-reconnect
function useReconnectingWs(url: string, onMessage: (data: any) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const delayRef = useRef(1000)

  const connect = useCallback(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => { delayRef.current = 1000 }
    ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)) } catch {}
    }
    ws.onclose = () => {
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 2, 30_000)
        connect()
      }, delayRef.current)
    }
    ws.onerror = () => ws.close()
  }, [url, onMessage])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])
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
  const [teamMode, setTeamMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileNotice, setFileNotice] = useState('')
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [architectToast, setArchitectToast] = useState<{
    proposalId: string; summary: string; vetoDeadline: number
  } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef2 = useRef<HTMLInputElement>(null)

  // Background picker
  const savedBg = loadSavedBg()
  const [bgPresetId, setBgPresetId]   = useState(savedBg.presetId)
  const [bgCustomUrl, setBgCustomUrl] = useState(savedBg.customUrl)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)
  const [bgCustomDraft, setBgCustomDraft] = useState(savedBg.customUrl)

  const activeBg = bgCustomUrl
    ? { css: `url('${bgCustomUrl}') center/cover fixed`, overlay: 'rgba(5,13,26,0.80)' }
    : (BG_PRESETS.find(p => p.id === bgPresetId) ?? BG_PRESETS[0])

  const applyBg = (presetId: string, customUrl = '') => {
    setBgPresetId(presetId)
    setBgCustomUrl(customUrl)
    localStorage.setItem(LS_BG_KEY, JSON.stringify({ presetId, customUrl }))
  }

  // Load session history
  const loadSessions = useCallback(() => {
    coreClient.listSessions(30).then(({ sessions: s }) => setSessions(s)).catch(() => {})
  }, [])
  useEffect(() => { if (sidebarOpen) loadSessions() }, [sidebarOpen, loadSessions])

  // Speech recognition
  const recognitionRef = useRef<any>(null)
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false
    r.interimResults = true
    r.onresult = (e: any) =>
      setInput(Array.from(e.results).map((res: any) => res[0].transcript).join(''))
    r.onend = () => {
      setIsListening(false)
      if (inputRealtime.current.trim()) sendRef.current()
    }
    recognitionRef.current = r
  }, [])

  const inputRealtime = useRef(input)
  inputRealtime.current = input
  const sendRef = useRef<() => void>(() => {})

  const voiceMutedRef = useRef(voiceMuted)
  voiceMutedRef.current = voiceMuted

  const speakText = useCallback((text: string) => {
    if (voiceMutedRef.current || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[*#`]/g, ''))
    const voices = window.speechSynthesis.getVoices()
    u.voice = voices.find(v => v.name.includes('Google UK English Male')) || voices.find(v => v.lang.startsWith('en')) || null
    u.rate = 1.05; u.pitch = 0.9
    window.speechSynthesis.speak(u)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        setShortcutsOpen(o => !o)
      }
      if (e.key === 'Escape') { setSidebarOpen(false); setShortcutsOpen(false) }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault(); inputRef2.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // WebSocket with auto-reconnect
  const handleWsMessage = useCallback((data: any) => {
    if (data.type === 'proactive_suggestion' && (!data.sessionId || data.sessionId === currentSessionId)) {
      setSuggestions(prev => [...prev.slice(-2), data.suggestion])
    }
    if (data.type === 'approval_request') {
      setMessages(prev => [...prev, {
        role: 'approval', content: '',
        approvalId: data.approvalId, agentName: data.agentName,
        toolName: data.toolName, cmd: data.cmd, resolved: false,
      }])
    }
    if (data.type === 'architect_proposal') {
      setArchitectToast({ proposalId: data.proposalId, summary: data.summary, vetoDeadline: data.vetoDeadline })
    }
    if (data.type === 'architect_applied') {
      if (Notification.permission === 'granted') {
        new Notification('Architect applied a patch', { body: data.summary, icon: '/favicon.ico' })
      }
      setArchitectToast(null)
    }
  }, [currentSessionId])

  const wsUrl = (() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname || 'localhost'
    const port = window.location.port || '3000'
    return `${proto}//${host}:${port}/ws/session`
  })()
  useReconnectingWs(wsUrl, handleWsMessage)

  const resolveApproval = (approvalId: string) => {
    setMessages(prev => prev.map(m =>
      m.approvalId === approvalId ? { ...m, resolved: true } : m
    ))
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setThinkingDomain(guessDomain(text))
    setLoading(true)

    try {
      if (teamMode) {
        const res = await coreClient.runTeam(text, currentSessionId)
        setMessages(m => [...m, { role: 'team', content: res.reply, subtasks: res.subtasks, subtaskCount: res.subtaskCount }])
        speakText(res.reply)
        // Browser notification for completed swarm run
        if (Notification.permission === 'granted') {
          new Notification('Team run complete', { body: res.reply.slice(0, 100), icon: '/favicon.ico' })
        }
        return
      }

      // Streaming SSE path
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: currentSessionId }),
      })

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

      // Add empty assistant bubble that we'll fill token by token
      setMessages(m => [...m, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullReply = ''
      let eventType = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); continue }
          if (!line.startsWith('data: ')) { eventType = ''; continue }
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'token') {
              fullReply += data.token
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullReply }
                return copy
              })
            } else if (eventType === 'domain') {
              setActiveDomain((data.domain as AgentDomain | undefined) ?? 'general')
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], domain: data.domain }
                return copy
              })
            } else if (eventType === 'reply') {
              // Non-streamed fallback (tool-use path returned full reply)
              fullReply = data.reply
              setMessages(m => {
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullReply, domain: data.domain }
                return copy
              })
              setActiveDomain((data.domain as AgentDomain | undefined) ?? 'general')
            } else if (eventType === 'approval') {
              setMessages(m => [...m, { role: 'approval', content: '', approvalId: data.approvalId, agentName: data.agentName, toolName: data.toolName, cmd: data.cmd, resolved: false }])
            }
          } catch { /* skip malformed SSE lines */ }
          eventType = ''
        }
      }

      speakText(fullReply)
    } catch {
      setMessages(m => {
        const copy = [...m]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant' && !last.content) {
          copy[copy.length - 1] = { role: 'assistant', content: 'Connection error. Please try again.' }
        } else {
          copy.push({ role: 'assistant', content: 'Connection error. Please try again.' })
        }
        return copy
      })
    } finally {
      setLoading(false)
    }
  }
  sendRef.current = send

  const toggleMic = () => {
    if (!recognitionRef.current) return alert('Speech recognition not supported in this browser.')
    if (isListening) { recognitionRef.current.stop(); setIsListening(false) }
    else { setInput(''); recognitionRef.current.start(); setIsListening(true) }
  }

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500)
    })
  }

  const resumeSession = (session: Session) => {
    setCurrentSessionId(session.id)
    setMessages([{ role: 'assistant', content: `Resumed: "${session.title}"` }])
    setSuggestions([]); setSidebarOpen(false)
  }

  const newSession = () => {
    setCurrentSessionId(`session-${Date.now()}`)
    setMessages([{ role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }])
    setSuggestions([]); setSidebarOpen(false)
  }

  // File drag & drop
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    setFileNotice(`Reading ${file.name}...`)
    try {
      const { text, filename } = await coreClient.uploadFile(file)
      setInput(prev => `${prev ? prev + '\n\n' : ''}[File: ${filename}]\n${text}`.slice(0, 8000))
      setFileNotice('')
      inputRef2.current?.focus()
    } catch (err: any) {
      setFileNotice(`Error: ${err.message}`)
      setTimeout(() => setFileNotice(''), 4000)
    }
  }

  const navBtn = 'text-gray-400 hover:text-white transition-all font-mono text-sm'
  const activeNav = 'text-cyan-400 font-bold tracking-widest bg-cyan-950/30 px-3 py-1 rounded border border-cyan-800/50 font-mono text-sm'

  return (
    <div
      className="flex flex-col h-screen text-white relative"
      style={{ background: activeBg.css }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Background overlay */}
      <div className="absolute inset-0 -z-10 backdrop-blur-sm" style={{ background: activeBg.overlay }} />

      {/* Background picker panel */}
      {bgPickerOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setBgPickerOpen(false)}>
          <div
            className="absolute top-16 right-4 w-72 rounded-xl border border-white/10 shadow-2xl p-4"
            style={{ background: 'rgba(5,13,26,0.97)', backdropFilter: 'blur(20px)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs font-mono text-gray-500 tracking-widest mb-3">CHAT BACKGROUND</p>

            {/* Preset grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {BG_PRESETS.map(p => (
                <button
                  key={p.id}
                  onClick={() => applyBg(p.id, '')}
                  title={p.label}
                  className={`relative h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    bgPresetId === p.id && !bgCustomUrl
                      ? 'border-cyan-400 scale-105'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                  style={{ background: p.thumb }}
                >
                  <span className="absolute bottom-0 inset-x-0 text-[9px] font-mono text-center pb-0.5"
                    style={{ textShadow: '0 1px 3px #000', color: '#fff' }}>
                    {p.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Custom URL */}
            <p className="text-xs font-mono text-gray-600 mb-1.5">Custom image URL</p>
            <div className="flex gap-2">
              <input
                className="flex-1 bg-black/40 border border-white/10 text-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500/60 placeholder-gray-700"
                placeholder="https://..."
                value={bgCustomDraft}
                onChange={e => setBgCustomDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { applyBg('custom', bgCustomDraft); setBgPickerOpen(false) }}}
              />
              <button
                onClick={() => { applyBg('custom', bgCustomDraft); setBgPickerOpen(false) }}
                className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono rounded-lg hover:bg-cyan-500/30 transition-colors"
              >set</button>
            </div>
            {bgCustomUrl && (
              <button
                onClick={() => { applyBg('coastal', ''); setBgCustomDraft('') }}
                className="mt-2 text-xs text-gray-600 hover:text-red-400 font-mono transition-colors"
              >✕ clear custom</button>
            )}
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-cyan-900/30 border-2 border-dashed border-cyan-500 pointer-events-none">
          <div className="text-cyan-300 text-2xl font-mono">Drop file to attach</div>
        </div>
      )}

      {/* Shortcuts overlay */}
      {shortcutsOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70" onClick={() => setShortcutsOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-mono text-cyan-400 text-sm tracking-widest">KEYBOARD SHORTCUTS</h2>
              <button onClick={() => setShortcutsOpen(false)} className="text-gray-600 hover:text-gray-400">✕</button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(({ key, desc }) => (
                <div key={key} className="flex justify-between text-sm">
                  <kbd className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 font-mono text-xs text-cyan-300">{key}</kbd>
                  <span className="text-gray-400">{desc}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-4 text-center">Press ? or Esc to close</p>
          </div>
        </div>
      )}

      <header className="glass-panel border-b-0 rounded-none px-6 py-3 flex items-center gap-4 z-10 shadow-md">
        <button onClick={() => setSidebarOpen(o => !o)} className="text-gray-400 hover:text-cyan-400 transition-colors text-lg" title="Sessions">☰</button>
        {/* Wave logo */}
        <svg viewBox="0 0 100 100" width="32" height="32" className="shrink-0 text-cyan-400" fill="none" aria-hidden="true">
          <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="3.5"/>
          <path stroke="currentColor" strokeWidth="9" strokeLinecap="round" fill="none"
            d="M8 48 C18 34 30 34 38 44 C46 54 58 54 66 44 C74 34 86 34 94 44"/>
          <circle cx="24" cy="36" r="3.5" fill="currentColor" opacity="0.8"/>
          <circle cx="80" cy="36" r="3.5" fill="currentColor" opacity="0.8"/>
          <path stroke="currentColor" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.65"
            d="M8 62 C18 50 32 50 42 60 C52 70 66 68 76 58 C84 50 92 50 96 56"/>
          <path stroke="currentColor" strokeWidth="5" strokeLinecap="round" fill="none" opacity="0.35"
            d="M8 76 C22 68 38 70 50 78 C62 86 78 84 90 76"/>
        </svg>
        <div>
          <div className="text-xs text-cyan-400 font-mono tracking-widest">
            {teamMode ? '⚡ TEAM MODE' : activeDomain.toUpperCase()}
          </div>
          <div className="text-xs text-cyan-800/80 font-mono">SESSION {currentSessionId.slice(-8).toUpperCase()}</div>
        </div>
        <div className="ml-auto flex gap-4 items-center">
          <button onClick={() => exportMarkdown(messages, currentSessionId)} className="text-gray-500 hover:text-gray-300 text-xs font-mono transition-colors" title="Export conversation">↓ export</button>
          <button onClick={() => { setVoiceMuted(m => !m); window.speechSynthesis?.cancel() }} className={`text-xs font-mono transition-colors ${voiceMuted ? 'text-red-500 hover:text-red-400' : 'text-gray-500 hover:text-gray-300'}`} title={voiceMuted ? 'Voice muted' : 'Mute voice'}>
            {voiceMuted ? '🔇' : '🔊'}
          </button>
          <button onClick={() => setShortcutsOpen(true)} className="text-gray-600 hover:text-gray-400 text-xs font-mono transition-colors" title="Keyboard shortcuts">?</button>
          <button onClick={() => setBgPickerOpen(o => !o)} className={`text-xs font-mono transition-colors ${bgPickerOpen ? 'text-cyan-400' : 'text-gray-600 hover:text-gray-400'}`} title="Change background">🎨</button>
          <button className={activeNav}>/chat</button>
          <button onClick={() => onNav('dashboard')} className={navBtn}>/dashboard</button>
          <button onClick={() => onNav('models')}    className={navBtn}>/models</button>
          <button onClick={() => onNav('agents')}    className={navBtn}>/agents</button>
          <button onClick={() => onNav('settings')}  className={navBtn}>/settings</button>
          <button onClick={() => onNav('system')}    className={navBtn}>/system</button>
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
                ? <p className="text-gray-600 text-xs p-4">No past conversations.</p>
                : sessions.map((s) => (
                    <div key={s.id} className={`flex items-center justify-between px-4 py-3 border-b border-gray-900 hover:bg-gray-800/50 cursor-pointer group ${s.id === currentSessionId ? 'bg-cyan-900/20' : ''}`} onClick={() => resumeSession(s)}>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{s.title}</p>
                        <p className="text-xs text-gray-600">{new Date(s.updated_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); coreClient.deleteSession(s.id).then(loadSessions) }} className="text-gray-700 hover:text-red-400 transition-colors ml-2 opacity-0 group-hover:opacity-100 text-xs">✕</button>
                    </div>
                  ))
              }
            </div>
          </div>
          <div className="flex-1" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Architect proposal toast */}
      {architectToast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-30 w-[480px] bg-purple-950/95 border border-purple-700 rounded-xl p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-purple-400 font-mono tracking-widest mb-1">⚙ ARCHITECT PROPOSAL</div>
              <p className="text-sm text-white leading-snug">{architectToast.summary}</p>
              <p className="text-xs text-purple-600 mt-1 font-mono">
                veto window: {Math.max(0, Math.round((architectToast.vetoDeadline - Date.now()) / 1000))}s remaining
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => {
                  fetch('/api/admin/architect/veto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: architectToast.proposalId }) })
                  setArchitectToast(null)
                }}
                className="px-3 py-1.5 text-xs font-mono bg-red-900/60 border border-red-700 text-red-300 hover:bg-red-800 rounded transition-colors"
              >VETO</button>
              <button onClick={() => setArchitectToast(null)} className="px-3 py-1.5 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">dismiss</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {fileNotice && (
          <div className="mb-3 text-xs text-cyan-400 font-mono px-2 animate-pulse">{fileNotice}</div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'approval') {
            return m.resolved ? null : (
              <ApprovalCard
                key={i}
                approvalId={m.approvalId!}
                agentName={m.agentName!}
                toolName={m.toolName!}
                cmd={m.cmd!}
                agentId="general"
                onResolved={() => resolveApproval(m.approvalId!)}
              />
            )
          }
          if (m.role === 'team') return <TeamResult key={i} msg={m} />
          return (
            <div key={i} className="relative group">
              <ChatBubble role={m.role as 'user' | 'assistant'} content={m.content} />
              {m.role === 'assistant' && (
                <button onClick={() => copyMessage(m.content, i)} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-gray-300 px-2 py-0.5 bg-gray-900/80 rounded">
                  {copiedIdx === i ? 'copied!' : 'copy'}
                </button>
              )}
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start mb-3">
            <AgentThinkingAnimation domain={thinkingDomain} />
          </div>
        )}

        {suggestions.length > 0 && !loading && (
          <div className="flex justify-start gap-3 mt-4 flex-wrap">
            <span className="text-xs text-amber-500 font-mono self-center tracking-widest animate-pulse">[INSIGHT]</span>
            {suggestions.map((sug, i) => (
              <button key={i} onClick={() => { setInput(sug); setSuggestions(prev => prev.filter(s => s !== sug)) }} className="text-xs border border-amber-500/30 bg-amber-950/20 text-amber-200/80 px-3 py-1.5 rounded-full hover:bg-amber-500/20 hover:border-amber-500 hover:text-amber-100 transition-all">
                {sug}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="glass-panel rounded-none border-x-0 border-b-0 px-4 py-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10">
        {/* Team mode toggle */}
        <div className="flex justify-end max-w-4xl mx-auto mb-2">
          <button
            onClick={() => setTeamMode(t => !t)}
            className={`text-xs font-mono px-3 py-1 rounded-full border transition-all ${
              teamMode
                ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
            }`}
          >
            {teamMode ? '⚡ TEAM MODE ON' : '⚡ team mode'}
          </button>
        </div>
        <div className="flex gap-4 max-w-4xl mx-auto items-end">
          <div className="flex-1 relative">
            <input
              ref={inputRef2}
              className="w-full bg-gray-950/80 border border-gray-700 text-cyan-50 font-mono rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all placeholder:text-gray-600"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={isListening ? '> Listening...' : teamMode ? '> Describe a complex task for the swarm...' : '> Execute command or send message...'}
              disabled={loading}
              autoFocus
            />
            {loading && <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />}
          </div>

          <button onClick={toggleMic} disabled={loading} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${isListening ? 'bg-red-500/20 text-red-500 border border-red-500 animate-pulse' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50'}`}>
            {isListening ? '⏹' : '🎤'}
          </button>

          <button onClick={send} disabled={!input.trim() || loading} className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-bold font-mono tracking-widest rounded-xl transition-all text-sm hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)]">
            {teamMode ? 'DEPLOY' : 'EXECUTE'}
          </button>
        </div>
        <p className="text-center text-xs text-gray-700 mt-2 font-mono">drag a file to attach · press ? for shortcuts</p>
      </div>
    </div>
  )
}
