import React, { useState, useRef, useEffect, useCallback, type DragEvent } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChatBubble } from '../components/ChatBubble'
import { ApprovalCard } from '../components/ApprovalCard'
import { guessDomain, type AgentDomain } from '../components/AgentThinkingAnimation'
import { coreClient, type Session } from '../api/client'
import { AgentCharacters } from '../components/AgentCharacters'
import { ChatPane } from '../components/ChatPane'
import { speakText } from '../utils/speech'

type MessageRole = 'user' | 'assistant' | 'approval' | 'team'
interface Message {
  role: MessageRole
  content: string
  imageUrl?: string
  domain?: AgentDomain
  // approval fields
  approvalId?: string
  agentId?: string
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
    css: 'linear-gradient(135deg, #050a0f 0%, #0a1628 50%, #050a0f 100%)',
    overlay: 'rgba(0,0,0,0)',
    thumb: 'linear-gradient(135deg, #050a0f 0%, #0a1628 50%, #050a0f 100%)',
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
    css: 'linear-gradient(135deg, #1a0600 0%, #200010 50%, #050a0f 100%)',
    overlay: 'rgba(0,0,0,0)',
    thumb: 'linear-gradient(135deg, #1a0600, #200010)',
  },
  {
    id: 'ocean-photo',
    label: 'Ocean',
    css: "url('https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80') center/cover fixed",
    overlay: 'rgba(5,10,15,0.82)',
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

// ── Multi-pane layout helpers ─────────────────────────────────────
const PANE_GRID: Record<number, [number, number]> = {
  1: [1, 1], 2: [2, 1], 3: [3, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3],
}

function LayoutIcon({ count, size }: { count: number; size: number }): React.ReactElement {
  const [cols, rows] = PANE_GRID[count] ?? [1, 1]
  const gap = 1.5
  const w = (size - gap * (cols - 1)) / cols
  const h = (size - gap * (rows - 1)) / rows
  const rects: { x: number; y: number }[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      rects.push({ x: c * (w + gap), y: r * (h + gap) })
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rects.map((rect, i) => (
        <rect key={i} x={rect.x} y={rect.y} width={w} height={h} rx="1"
          fill="rgba(0,229,255,0.55)" />
      ))}
    </svg>
  )
}


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

const TeamResult = React.memo(function TeamResult({ msg }: { msg: Message }) {
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
})

// WebSocket with auto-reconnect
function useReconnectingWs(url: string, onMessage: (data: any) => void) {
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const delayRef = useRef(1000)
  const onMessageRef = useRef(onMessage)

  // Update the callback ref when it changes, without triggering reconnection
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const connect = useCallback(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => { delayRef.current = 1000 }
    ws.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data)) } catch { /* skip malformed message */ }
    }
    ws.onclose = () => {
      timerRef.current = setTimeout(() => {
        delayRef.current = Math.min(delayRef.current * 2, 30_000)
        connect()
      }, delayRef.current)
    }
    ws.onerror = () => ws.close()
  }, [url])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}

// ── MessageList ───────────────────────────────────────────────────
// Isolated behind React.memo so typing in the input field does not
// re-render the entire message history on every keystroke.
interface MessageListProps {
  messages: Message[]
  loading: boolean
  suggestions: string[]
  copiedIdx: number | null
  fileNotice: string
  onCopy: (content: string, idx: number) => void
  onSuggestion: (sug: string) => void
  onResolveApproval: (approvalId: string) => void
}

const MessageList = React.memo(function MessageList({
  messages, loading, suggestions, copiedIdx, fileNotice,
  onCopy, onSuggestion, onResolveApproval,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
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
              agentId={m.agentId ?? 'general'}
              onResolved={() => onResolveApproval(m.approvalId!)}
            />
          )
        }
        if (m.role === 'team') return <TeamResult key={i} msg={m} />
        return (
          <div key={i} className="relative group">
            {m.imageUrl && (
              <div className="flex justify-end mb-1 pr-3">
                <img src={m.imageUrl} alt="attached" className="max-h-48 max-w-xs rounded-lg border border-white/10 object-contain" />
              </div>
            )}
            <ChatBubble role={m.role as 'user' | 'assistant'} content={m.content} />
            {m.role === 'assistant' && (
              <button
                onClick={() => onCopy(m.content, i)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-600 hover:text-gray-300 px-2 py-0.5 bg-gray-900/80 rounded"
              >
                {copiedIdx === i ? 'copied!' : 'copy'}
              </button>
            )}
          </div>
        )
      })}

      {loading && (
        <div className="flex justify-start mb-3 px-3">
          <span className="text-xs font-mono text-cyan-500/60 animate-pulse tracking-widest">thinking...</span>
        </div>
      )}

      {suggestions.length > 0 && !loading && (
        <div className="flex justify-start gap-3 mt-4 flex-wrap">
          <span className="text-xs text-amber-500 font-mono self-center tracking-widest animate-pulse">[INSIGHT]</span>
          {suggestions.map((sug, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(sug)}
              className="text-xs border border-amber-500/30 bg-amber-950/20 text-amber-200/80 px-3 py-1.5 rounded-full hover:bg-amber-500/20 hover:border-amber-500 hover:text-amber-100 transition-all"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
})

export function Chat({ sessionId: initialSessionId, onNav }: { sessionId: string; onNav: (page: string) => void }) {
  const [currentSessionId, setCurrentSessionId] = useState(initialSessionId)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }
  ])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [, setThinkingDomain] = useState<AgentDomain>('general')
  const [activeDomain, setActiveDomain] = useState<AgentDomain>('general')
  const [isListening, setIsListening] = useState(false)
  const [teamMode, setTeamMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileNotice, setFileNotice] = useState('')
  const [pendingImage, setPendingImage] = useState<string | null>(null) // base64 data URL
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentList, setAgentList] = useState<Array<{ id: string; name: string; active: boolean }>>([])
  const [agentListError, setAgentListError] = useState(false)
  const [personaAgentId, setPersonaAgentId] = useState<string | null>(null)
  const [agentDrawerOpen, setAgentDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const [paneCount, setPaneCount] = useState(1)
  const [focusedPane, setFocusedPane] = useState(0)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const [architectToast, setArchitectToast] = useState<{
    proposalId: string; summary: string; vetoDeadline: number
  } | null>(null)
  const inputRef2 = useRef<HTMLInputElement>(null)
  const agentVoicesRef = useRef<Map<string, string>>(new Map()) // agentId → voice name
  const [skills, setSkills] = useState<{ name: string; description: string; prompt: string }[]>([])
  const [skillSuggestions, setSkillSuggestions] = useState<typeof skills>([])
  const [skillVars, setSkillVars] = useState<Record<string, string> | null>(null)
  const [pendingSkill, setPendingSkill] = useState<{ prompt: string } | null>(null)

  // Background picker — lazy initialisers so localStorage is read only once on mount
  const [bgPresetId, setBgPresetId]     = useState<string>(() => loadSavedBg().presetId)
  const [bgCustomUrl, setBgCustomUrl]   = useState<string>(() => loadSavedBg().customUrl)
  const [bgPickerOpen, setBgPickerOpen] = useState(false)
  const [bgCustomDraft, setBgCustomDraft] = useState<string>(() => loadSavedBg().customUrl)

  // Validate URL to prevent CSS injection — only allow http(s) and sanitize quotes
  const isValidUrl = (url: string): boolean => {
    if (!url) return false
    // Block characters that can break out of CSS url('...')
    if (/['")\\]/.test(url)) return false
    try {
      const parsed = new URL(url, window.location.href)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      // Allow relative paths that start with /
      return url.startsWith('/')
    }
  }

  const activeBg = bgCustomUrl && isValidUrl(bgCustomUrl)
    ? { css: `url('${bgCustomUrl}') center/cover fixed`, overlay: 'rgba(5,10,15,0.80)' }
    : (BG_PRESETS.find(p => p.id === bgPresetId) ?? BG_PRESETS[0])

  const applyBg = (presetId: string, customUrl = '') => {
    // Only apply custom URL if it passes validation
    if (customUrl && !isValidUrl(customUrl)) {
      console.warn('[Chat] Invalid background URL rejected:', customUrl)
      return
    }
    setBgPresetId(presetId)
    setBgCustomUrl(customUrl)
    localStorage.setItem(LS_BG_KEY, JSON.stringify({ presetId, customUrl }))
  }

  // Load skills for /command autocomplete
  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.ok ? r.json() : [])
      .then(setSkills)
      .catch((err) => {
        console.warn('[Chat] Failed to load skills:', err)
      })
  }, [])

  // Load agent voices on mount and when agent list changes
  useEffect(() => {
    const session = sessionStorage.getItem('cc_admin_session') ?? ''
    const headers: Record<string, string> = session ? { 'x-admin-session': session } : {}
    fetch('/api/admin/agents', { headers })
      .then(r => r.ok ? r.json() : [])
      .then((agents: { id: string; voice?: string }[]) => {
        const map = new Map<string, string>()
        for (const a of agents) if (a.voice) map.set(a.id, a.voice)
        agentVoicesRef.current = map
      })
      .catch((err) => {
        console.warn('[Chat] Failed to load agent voices:', err)
      })
  }, [agentList.length])

  // Load session history
  const loadSessions = useCallback(() => {
    coreClient.listSessions(30)
      .then(({ sessions: s }) => setSessions(s))
      .catch((err) => {
        console.warn('[Chat] Failed to load session history:', err)
      })
  }, [])
  useEffect(() => { if (sidebarOpen) loadSessions() }, [sidebarOpen, loadSessions])

  useEffect(() => {
    const loadAgents = () =>
      coreClient.listAgents()
        .then(agents => {
          setAgentList(agents.map(a => ({ id: a.id, name: a.name, active: a.active })))
          setAgentListError(false)
        })
        .catch((err) => {
          console.warn('[Chat] Failed to load agents list:', err)
          setAgentListError(true)
        })
    loadAgents()
    // Retry once after 2s in case session was still loading
    const retryTimer = setTimeout(() => {
      if (agentList.length === 0) loadAgents()
    }, 2000)
    return () => clearTimeout(retryTimer)
  }, [])

  // Fetch persona to pin the personal agent at top of the agent rail
  useEffect(() => {
    const session = sessionStorage.getItem('cc_admin_session') ?? ''
    const headers: Record<string, string> = session ? { 'x-admin-session': session } : {}
    fetch('/api/persona', { headers })
      .then(r => r.ok ? r.json() : null)
      .then((data: { personaAgentId?: string } | null) => {
        if (data?.personaAgentId) {
          setPersonaAgentId(data.personaAgentId)
          // Auto-select the personal agent on first load
          setSelectedAgentId(id => id ?? data.personaAgentId ?? null)
        }
      })
      .catch((err) => {
        console.warn('[Chat] Failed to load persona:', err)
      })
  }, [])

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
  const activeDomainRef = useRef(activeDomain)
  activeDomainRef.current = activeDomain

  const speakText = useCallback((text: string) => {
    if (voiceMutedRef.current) return
    // Strip markdown formatting and trim whitespace
    const clean = text.replace(/[*#`_~>]/g, '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    const agentVoiceName = agentVoicesRef.current.get(activeDomainRef.current)

    // VibeVoice (AI on-device TTS) — falls back to Web Speech API if unavailable
    if (agentVoiceName?.startsWith('vv:')) {
      const vibeId = agentVoiceName.slice(3)
      const session = sessionStorage.getItem('cc_admin_session') ?? ''
      fetch('/api/admin/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { 'x-admin-session': session } : {}) },
        body: JSON.stringify({ text: clean, voice: vibeId }),
      }).then(r => {
        if (!r.ok) throw new Error('vv_unavailable')
        return r.blob()
      }).then(blob => {
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => URL.revokeObjectURL(url)
        audio.play()
      }).catch(() => {
        // VibeVoice service unavailable — fall back to Web Speech API
        speakText(clean, null)
      })
      return
    }

    speakText(clean, agentVoiceName ?? null)
  }, [])

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
        approvalId: data.approvalId, agentId: data.agentId ?? 'general',
        agentName: data.agentName, toolName: data.toolName,
        cmd: data.cmd, resolved: false,
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
    // Use window.location.host (includes port when non-standard) to avoid
    // hardcoding port 3000 which breaks production TLS on port 443
    return `${proto}//${window.location.host}/ws/session`
  })()
  useReconnectingWs(wsUrl, handleWsMessage)

  const resolveApproval = useCallback((approvalId: string) => {
    setMessages(prev => prev.map(m =>
      m.approvalId === approvalId ? { ...m, resolved: true } : m
    ))
  }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const imageForSend = pendingImage
    setPendingImage(null)
    setMessages(m => [...m, { role: 'user', content: text, imageUrl: imageForSend ?? undefined }])
    setThinkingDomain(guessDomain(text))
    setLoading(true)
    inputRef2.current?.focus()

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
        body: JSON.stringify({
          message: text,
          sessionId: currentSessionId,
          ...(imageForSend ? { images: [imageForSend.replace(/^data:[^;]+;base64,/, '')] } : {}),
          ...(selectedAgentId ? { agentId: selectedAgentId } : {}),
        }),
      })

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

      // Add empty assistant bubble that we'll fill token by token
      setMessages(m => [...m, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullReply = ''
      let eventType = ''
      let gotFirstEvent = false

      // Timeout guard: if no SSE event arrives within 90s, abort and show error
      const timeoutId = setTimeout(() => {
        reader.cancel()
      }, 90_000)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); if (!gotFirstEvent) { gotFirstEvent = true; clearTimeout(timeoutId) } continue }
          if (!line.startsWith('data: ')) { eventType = ''; continue }
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'token') {
              fullReply += data.token
              setMessages(m => {
                if (m.length === 0) return m
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullReply }
                return copy
              })
            } else if (eventType === 'domain') {
              setActiveDomain((data.domain as AgentDomain | undefined) ?? 'general')
              setMessages(m => {
                if (m.length === 0) return m
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], domain: data.domain }
                return copy
              })
            } else if (eventType === 'reply') {
              // Non-streamed fallback (tool-use path returned full reply)
              fullReply = data.reply
              setMessages(m => {
                if (m.length === 0) return m
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: fullReply, domain: data.domain }
                return copy
              })
              setActiveDomain((data.domain as AgentDomain | undefined) ?? 'general')
            } else if (eventType === 'approval') {
              setMessages(m => [...m, { role: 'approval', content: '', approvalId: data.approvalId, agentName: data.agentName, toolName: data.toolName, cmd: data.cmd, resolved: false }])
            } else if (eventType === 'error') {
              const errMsg = data.message ?? 'The agent encountered an error.'
              setMessages(m => {
                if (m.length === 0) return m
                const copy = [...m]
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: `⚠ ${errMsg}` }
                return copy
              })
            }
          } catch { /* skip malformed SSE lines */ }
          eventType = ''
        }
      }

      clearTimeout(timeoutId)

      // Stream ended with no content — Ollama timed out or returned nothing
      if (!fullReply) {
        setMessages(m => {
          if (m.length === 0) return m
          const copy = [...m]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            const msg = gotFirstEvent
              ? '(No response received. The model may have returned an empty reply.)'
              : '(No response from server — Ollama may be loading the model or not running. Try again in a moment.)'
            copy[copy.length - 1] = { ...last, content: msg }
          }
          return copy
        })
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
      inputRef2.current?.focus()
    }
  }
  sendRef.current = send

  const toggleMic = () => {
    if (!recognitionRef.current) return alert('Speech recognition not supported in this browser.')
    if (isListening) { recognitionRef.current.stop(); setIsListening(false) }
    else { setInput(''); recognitionRef.current.start(); setIsListening(true) }
  }

  const copyMessage = useCallback((content: string, idx: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500)
    })
  }, [])

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

  const handleSuggestion = useCallback((sug: string) => {
    setInput(sug)
    setSuggestions(prev => prev.filter(s => s !== sug))
  }, [])

  // File drag & drop
  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    setFileNotice(`Reading ${file.name}...`)
    try {
      const result = await coreClient.uploadFile(file)
      if (result.isImage && result.dataUrl) {
        setPendingImage(result.dataUrl)
        setFileNotice(`Image attached: ${result.filename}`)
        setTimeout(() => setFileNotice(''), 2000)
      } else {
        setInput(prev => `${prev ? prev + '\n\n' : ''}[File: ${result.filename}]\n${result.text ?? ''}`.slice(0, 8000))
        setFileNotice('')
      }
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
      <div className="absolute inset-0 pointer-events-none" style={{ background: activeBg.overlay }} />

      {/* Background picker panel */}
      {bgPickerOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setBgPickerOpen(false)}>
          <div
            className="absolute top-16 right-4 w-72 rounded-xl border border-white/10 shadow-2xl p-4"
            style={{ background: 'rgba(5,10,15,0.97)', backdropFilter: 'blur(20px)' }}
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
                className="flex-1 min-w-0 bg-black/40 border border-white/10 text-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500/60 placeholder-gray-700"
                placeholder="https://..."
                value={bgCustomDraft}
                onChange={e => setBgCustomDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { applyBg('custom', bgCustomDraft); setBgPickerOpen(false) }}}
              />
              <button
                onClick={() => { applyBg('custom', bgCustomDraft); setBgPickerOpen(false) }}
                className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-mono rounded-lg hover:bg-cyan-500/30 transition-colors"
                title="Apply Web URL"
              >set</button>
              
              <label className="px-3 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-mono rounded-lg hover:bg-purple-500/30 transition-colors cursor-pointer" title="Upload Local File">
                ↑ app
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const uploadResult = await coreClient.uploadFile(file).catch(err => {
                    alert(`Upload failed: ${err.message}`)
                    return null
                  })
                  if (uploadResult?.isImage && uploadResult?.dataUrl) {
                    applyBg('custom', uploadResult.dataUrl)
                    setBgCustomDraft('')
                    setBgPickerOpen(false)
                  }
                  e.target.value = '' // reset
                }} />
              </label>
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

      <header className="glass-panel border-b-0 rounded-none px-6 py-3 flex items-center gap-4 z-10 shadow-md"
        style={{ borderBottom: '1px solid rgba(0,229,255,0.10)' }}>
        <button onClick={() => setSidebarOpen(o => !o)} className="transition-colors text-lg" style={{ color: '#94adc4' }} title="Sessions">☰</button>
        {/* Brand mark */}
        <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
          style={{ background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.30)' }}>
          <span style={{ color: '#00e5ff', fontSize: '16px', fontWeight: 700, lineHeight: 1 }}>✳</span>
        </div>
        <div>
          <div className="text-xs font-bold tracking-wider" style={{ color: '#00e5ff', fontFamily: 'Space Grotesk, sans-serif' }}>
            {teamMode ? '⚡ TEAM MODE' : activeDomain.toUpperCase()}
          </div>
          <div className="text-xs font-mono" style={{ color: 'rgba(0,229,255,0.40)' }}>SESSION {currentSessionId.slice(-8).toUpperCase()}</div>
        </div>
        <div className="ml-auto flex gap-4 items-center">
          {/* Layout picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setLayoutOpen(o => !o)}
              title="Split panes"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: paneCount > 1 ? 'rgba(0,229,255,0.20)' : 'rgba(0,229,255,0.08)',
                border: paneCount > 1 ? '1px solid rgba(0,229,255,0.55)' : '1px solid rgba(0,229,255,0.25)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (paneCount === 1) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.14)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,255,0.40)'
                }
              }}
              onMouseLeave={e => {
                if (paneCount === 1) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,229,255,0.08)'
                  ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,229,255,0.25)'
                }
              }}
            >
              <LayoutIcon count={paneCount} size={16} />
              {paneCount > 1 && (
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00e5ff', lineHeight: 1 }}>
                  {paneCount}×
                </span>
              )}
            </button>
            {layoutOpen && (
              <div
                style={{
                  position: 'absolute', top: '28px', right: 0, zIndex: 60,
                  background: 'rgba(5,10,15,0.97)', border: '1px solid rgba(0,229,255,0.20)',
                  borderRadius: '10px', padding: '10px', display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px',
                }}
                onMouseLeave={() => setLayoutOpen(false)}
              >
                {([1,2,3,4,6,8,9] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => { setPaneCount(n); setFocusedPane(0); setLayoutOpen(false) }}
                    title={`${n} pane${n > 1 ? 's' : ''}`}
                    style={{
                      width: '36px', height: '36px', borderRadius: '6px',
                      background: paneCount === n ? 'rgba(0,229,255,0.18)' : 'rgba(255,255,255,0.04)',
                      border: paneCount === n ? '1px solid rgba(0,229,255,0.45)' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (paneCount !== n) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={e => { if (paneCount !== n) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                  >
                    <LayoutIcon count={n} size={20} />
                  </button>
                ))}
              </div>
            )}
          </div>
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
          <div className="w-72 bg-[#050a0f]/98 border-r border-gray-800 flex flex-col h-full">
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
                onClick={async () => {
                  try {
                    const res = await fetch('/api/admin/architect/veto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId: architectToast.proposalId }) })
                    if (!res.ok) console.warn('[Chat] Veto request failed:', res.status)
                  } catch (e) {
                    console.warn('[Chat] Veto request failed:', e)
                  }
                  setArchitectToast(null)
                }}
                className="px-3 py-1.5 text-xs font-mono bg-red-900/60 border border-red-700 text-red-300 hover:bg-red-800 rounded transition-colors"
              >VETO</button>
              <button onClick={() => setArchitectToast(null)} className="px-3 py-1.5 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi-pane grid (2+ panes) ─────────────────────────── */}
      {paneCount > 1 && (() => {
        const [cols] = PANE_GRID[paneCount] ?? [2, 1]
        return (
          <div
            style={{
              flex: 1, minHeight: 0, display: 'grid',
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              gap: '4px', padding: '4px',
            }}
          >
            {Array.from({ length: paneCount }, (_, i) => (
              <ChatPane
                key={i}
                paneIndex={i}
                agents={agentList}
                focused={focusedPane === i}
                onFocus={() => setFocusedPane(i)}
                compact={paneCount >= 4}
              />
            ))}
          </div>
        )
      })()}

      {/* Body: left character rail + main chat column */}
      {/* display:none (not conditional render) preserves the single-pane state — avoids
          remounting the SSE stream and scroll position when switching back from multi-pane */}
      <div className="flex flex-1 min-h-0" style={{ display: paneCount > 1 ? 'none' : 'flex' }}>

      {/* ── Character rail (desktop only) ──────────────────────── */}
      {!isMobile && (agentList.length > 0 || agentListError) && (
        <div
          className="flex flex-col items-center gap-1 py-4 overflow-y-auto shrink-0 z-10"
          style={{
            width: '72px',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(5,10,15,0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Personal agent pin — always shown if onboarding created one */}
          {personaAgentId && (() => {
            const persona = agentList.find(a => a.id === personaAgentId)
            if (!persona) return null
            const isSelected = selectedAgentId === personaAgentId
            return (
              <>
                <button
                  onClick={() => setSelectedAgentId(isSelected ? null : personaAgentId)}
                  title={persona.name}
                  className="flex flex-col items-center gap-1 transition-all duration-200"
                  style={{ opacity: isSelected ? 1 : 0.55, transform: isSelected ? 'scale(1.12)' : 'scale(1)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full border-2 flex items-center justify-center text-base transition-all"
                    style={isSelected
                      ? { borderColor: '#00e5ff', background: 'rgba(0,229,255,0.15)', color: '#00e5ff', boxShadow: '0 0 16px rgba(0,229,255,0.45)' }
                      : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#6b7280' }
                    }
                  >
                    ✦
                  </div>
                  <span className="text-[8px] font-mono" style={{ color: isSelected ? '#00e5ff' : '#4b5563' }}>
                    YOU
                  </span>
                </button>
                <div className="w-8 h-px bg-white/5 my-1 shrink-0" />
              </>
            )
          })()}
          <AgentCharacters
            agents={agentList}
            selected={selectedAgentId}
            onSelect={setSelectedAgentId}
            vertical
          />
          {agentListError && agentList.length === 0 && (
            <div
              className="text-[8px] font-mono text-center px-1 mt-2 leading-tight"
              style={{ color: '#f59e0b' }}
              title="Could not load agents — check server connection or re-login"
            >
              agents<br />offline
            </div>
          )}
        </div>
      )}

      {/* ── Main chat column ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

      <MessageList
        messages={messages}
        loading={loading}
        suggestions={suggestions}
        copiedIdx={copiedIdx}
        fileNotice={fileNotice}
        onCopy={copyMessage}
        onSuggestion={handleSuggestion}
        onResolveApproval={resolveApproval}
      />

      {/* Mobile agent drawer toggle */}
      {isMobile && (agentList.length > 0 || agentListError) && (
        <>
          <button
            onClick={() => setAgentDrawerOpen(o => !o)}
            style={{
              position: 'fixed', bottom: '84px', left: '12px', zIndex: 30,
              background: 'rgba(5,10,15,0.92)', border: '1px solid rgba(0,229,255,0.30)',
              borderRadius: '50%', width: '40px', height: '40px',
              color: '#00e5ff', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Toggle agent selector"
          >
            ✳
          </button>
          {agentDrawerOpen && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 40 }}
              onClick={() => setAgentDrawerOpen(false)}
            >
              <div
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(5,10,15,0.97)', borderTop: '1px solid rgba(0,229,255,0.20)',
                  borderRadius: '16px 16px 0 0', padding: '20px 16px 32px',
                }}
                onClick={e => e.stopPropagation()}
              >
                <p className="text-xs font-mono text-center mb-4" style={{ color: '#94adc4' }}>Select Agent</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center', alignItems: 'flex-end' }}>
                  {personaAgentId && (() => {
                    const persona = agentList.find(a => a.id === personaAgentId)
                    if (!persona) return null
                    const isSelected = selectedAgentId === personaAgentId
                    return (
                      <button
                        onClick={() => { setSelectedAgentId(isSelected ? null : personaAgentId); setAgentDrawerOpen(false) }}
                        title={persona.name}
                        className="shrink-0 flex flex-col items-center gap-1 transition-all duration-200"
                        style={{ opacity: isSelected ? 1 : 0.55 }}
                      >
                        <div
                          className="w-14 h-14 rounded-full border-2 flex items-center justify-center text-xl transition-all"
                          style={isSelected
                            ? { borderColor: '#00e5ff', background: 'rgba(0,229,255,0.15)', color: '#00e5ff', boxShadow: '0 0 16px rgba(0,229,255,0.45)' }
                            : { borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#6b7280' }
                          }
                        >
                          ✦
                        </div>
                        <span className="text-[9px] font-mono" style={{ color: isSelected ? '#00e5ff' : '#374151' }}>
                          {persona.name}
                        </span>
                      </button>
                    )
                  })()}
                  <AgentCharacters
                    agents={agentList}
                    selected={selectedAgentId}
                    onSelect={(id) => { setSelectedAgentId(id); setAgentDrawerOpen(false) }}
                    vertical={false}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="glass-panel rounded-none border-x-0 border-b-0 px-4 pt-2 pb-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-10" style={isMobile ? { paddingBottom: '24px' } : {}}>
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
            {/* Skill autocomplete dropdown */}
            {skillSuggestions.length > 0 && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-950 border border-cyan-800/50 rounded-xl overflow-hidden shadow-xl z-20">
                {skillSuggestions.map(s => (
                  <button
                    key={s.name}
                    onMouseDown={e => {
                      e.preventDefault()
                      // Check if skill has variables
                      const vars = [...s.prompt.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])
                      if (vars.length > 0) {
                        setPendingSkill({ prompt: s.prompt })
                        setSkillVars(Object.fromEntries(vars.map(v => [v, ''])))
                        setInput('')
                      } else {
                        setInput(s.prompt)
                      }
                      setSkillSuggestions([])
                    }}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-cyan-500/10 transition-colors"
                  >
                    <span className="font-mono text-xs text-cyan-400">/{s.name}</span>
                    <span className="text-xs text-gray-500 truncate">{s.description}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Skill variable fill-in */}
            {pendingSkill && skillVars && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-gray-950 border border-cyan-800/50 rounded-xl p-4 shadow-xl z-20">
                <p className="text-xs font-mono text-cyan-400 mb-3">Fill in skill variables:</p>
                <div className="space-y-2 mb-3">
                  {Object.keys(skillVars).map(v => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-xs font-mono text-cyan-600/80 w-20 shrink-0">{`{{${v}}}`}</span>
                      <input
                        autoFocus
                        className="flex-1 bg-black/40 border border-white/10 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-cyan-500/50"
                        value={skillVars[v]}
                        onChange={e => setSkillVars(sv => ({ ...sv!, [v]: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            const resolved = pendingSkill.prompt.replace(/\{\{(\w+)\}\}/g, (_, k) => skillVars[k] ?? '')
                            setInput(resolved)
                            setPendingSkill(null)
                            setSkillVars(null)
                            inputRef2.current?.focus()
                          } else if (e.key === 'Escape') {
                            setPendingSkill(null); setSkillVars(null)
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onMouseDown={e => { e.preventDefault()
                      const resolved = pendingSkill.prompt.replace(/\{\{(\w+)\}\}/g, (_, k) => skillVars[k] ?? '')
                      setInput(resolved); setPendingSkill(null); setSkillVars(null); inputRef2.current?.focus()
                    }}
                    className="text-xs font-mono px-3 py-1 bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 rounded hover:bg-cyan-500/20 transition-colors"
                  >
                    Apply ↵
                  </button>
                  <button onMouseDown={() => { setPendingSkill(null); setSkillVars(null) }} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">cancel</button>
                </div>
              </div>
            )}

            {pendingImage && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <img src={pendingImage} alt="pending" className="h-12 w-12 rounded object-cover border border-cyan-800/50" />
                <span className="text-xs text-cyan-400 font-mono flex-1">Image ready to send</span>
                <button onClick={() => setPendingImage(null)} className="text-gray-600 hover:text-red-400 text-xs">✕</button>
              </div>
            )}
            <input
              ref={inputRef2}
              className="w-full bg-gray-950/80 border border-gray-700 text-cyan-50 font-mono rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(0,255,255,0.2)] transition-all placeholder:text-gray-600"
              style={{ fontSize: '16px' /* 16px prevents iOS auto-zoom on focus */ }}
              value={input}
              onChange={(e) => {
                const val = e.target.value
                setInput(val)
                if (val.startsWith('/') && val.length > 1 && !val.includes(' ')) {
                  const query = val.slice(1).toLowerCase()
                  setSkillSuggestions(skills.filter(s => s.name.startsWith(query)).slice(0, 6))
                } else {
                  setSkillSuggestions([])
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setSkillSuggestions([]); return }
                if (e.key === 'Enter' && !e.shiftKey) send()
              }}
              placeholder={isListening ? '> Listening...' : teamMode ? '> Describe a complex task for the swarm...' : '> Execute command or /skill...'}
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

      </div>{/* end main chat column */}
      </div>{/* end body row */}
    </div>
  )
}

export default function ChatPage() {
  const [sessionId] = useState(() => `session-${Date.now()}`)
  return <Chat sessionId={sessionId} onNav={() => {}} />
}
