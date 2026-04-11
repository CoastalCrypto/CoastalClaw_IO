import React, { useState, useRef, useEffect, useCallback } from 'react'
import { randomUUID } from '../utils/uuid'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Agent {
  id: string
  name: string
  active: boolean
}

interface Props {
  paneIndex: number
  agents: Agent[]
  focused: boolean
  onFocus: () => void
  compact: boolean   // true at 4+ panes — shrinks font/padding for dense layouts
}

export function ChatPane({ paneIndex, agents, focused, onFocus, compact }: Props): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [thinkingMs, setThinkingMs] = useState(0)
  const [voiceMuted, setVoiceMuted] = useState(true)
  const [hoveredLastMsg, setHoveredLastMsg] = useState(false)
  const sessionId = useRef(randomUUID())
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const thinkingStart = useRef<number | null>(null)
  const voiceMutedRef = useRef(true)
  voiceMutedRef.current = voiceMuted

  useEffect(() => {
    if (!loading) { setThinkingMs(0); return }
    const tid = setInterval(() => {
      if (thinkingStart.current !== null) setThinkingMs(Date.now() - thinkingStart.current)
    }, 500)
    return () => clearInterval(tid)
  }, [loading])

  const speakReply = useCallback((text: string) => {
    if (voiceMutedRef.current || !('speechSynthesis' in window)) return
    const clean = text.replace(/[*#`_~>]/g, '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(clean)
    setTimeout(() => {
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.name.includes('Google UK English Male'))
        || voices.find(v => v.lang.startsWith('en-') && !v.name.toLowerCase().includes('zira') && !v.name.toLowerCase().includes('david'))
        || null
      if (voice) utt.voice = voice
      window.speechSynthesis.speak(utt)
    }, 0)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  const agentLabel = selectedAgent?.name ?? 'Auto'

  const doSend = useCallback(async (text: string) => {
    if (!text || loading) return
    setLoading(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    thinkingStart.current = Date.now()

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionId.current,
          ...(selectedAgentId ? { agentId: selectedAgentId } : {}),
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`)

      setMessages(m => [...m, { role: 'assistant', content: '' }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullReply = ''
      let eventType = ''
      let gotFirst = false

      const tid = setTimeout(() => reader.cancel(), 90_000)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
            if (!gotFirst) { gotFirst = true; clearTimeout(tid); thinkingStart.current = null }
            continue
          }
          if (!line.startsWith('data: ')) { eventType = ''; continue }
          try {
            const data = JSON.parse(line.slice(6))
            if (eventType === 'token') {
              fullReply += data.token
              setMessages(m => {
                const c = [...m]
                c[c.length - 1] = { ...c[c.length - 1], content: fullReply }
                return c
              })
            } else if (eventType === 'reply') {
              fullReply = data.reply
              setMessages(m => {
                const c = [...m]
                c[c.length - 1] = { ...c[c.length - 1], content: fullReply }
                return c
              })
            } else if (eventType === 'error') {
              setMessages(m => {
                const c = [...m]
                c[c.length - 1] = { ...c[c.length - 1], content: `⚠ ${data.message ?? 'Agent error'}` }
                return c
              })
            }
          } catch { /* skip */ }
          eventType = ''
        }
      }

      clearTimeout(tid)

      if (fullReply) {
        speakReply(fullReply)
      } else {
        setMessages(m => {
          const c = [...m]
          const last = c[c.length - 1]
          if (last?.role === 'assistant' && !last.content) {
            c[c.length - 1] = { ...last, content: gotFirst ? '(Empty response)' : '(No response — model may be loading)' }
          }
          return c
        })
      }
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') return
      setMessages(m => {
        const c = [...m]
        c[c.length - 1] = { ...c[c.length - 1], content: `⚠ ${e instanceof Error ? e.message : String(e)}` }
        return c
      })
    } finally {
      thinkingStart.current = null
      setLoading(false)
    }
  }, [loading, selectedAgentId, speakReply])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    await doSend(text)
  }, [input, doSend])

  const retry = useCallback(() => {
    if (loading || messages.length < 2) return
    const last = messages[messages.length - 1]
    const prevUser = [...messages].slice(0, -1).reverse().find(m => m.role === 'user')
    if (last.role !== 'assistant' || !prevUser) return
    setMessages(m => m.slice(0, -1))
    doSend(prevUser.content)
  }, [loading, messages, doSend])

  const fs = compact ? '11px' : '12px'
  const px = compact ? 8 : 12
  const inputPy = compact ? 6 : 9

  return (
    <div
      onClick={onFocus}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(5,10,15,0.80)',
        border: focused ? '1px solid rgba(0,229,255,0.45)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        overflow: 'hidden',
        fontFamily: 'Space Grotesk, sans-serif',
        transition: 'border-color 0.15s',
        minWidth: 0,
      }}
    >
      {/* Pane header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: `6px ${px}px`,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.30)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', color: '#94adc4', fontFamily: 'monospace', minWidth: '16px' }}>
          {paneIndex + 1}
        </span>

        <select
          value={selectedAgentId ?? ''}
          onChange={e => setSelectedAgentId(e.target.value || null)}
          onClick={e => e.stopPropagation()}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: selectedAgentId ? '#00e5ff' : '#718096',
            fontSize: '11px',
            fontFamily: 'Space Grotesk, sans-serif',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="">Auto</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <button
          onClick={e => { e.stopPropagation(); if (!voiceMuted) window.speechSynthesis?.cancel(); setVoiceMuted(m => !m) }}
          title={voiceMuted ? 'Enable voice' : 'Mute voice'}
          style={{ fontSize: '11px', color: voiceMuted ? '#2d3748' : '#00e5ff', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 3px' }}
        >
          {voiceMuted ? '🔇' : '🔊'}
        </button>

        {messages.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); abortRef.current?.abort(); window.speechSynthesis?.cancel(); setMessages([]); setLoading(false) }}
            title="Clear pane"
            style={{ fontSize: '10px', color: '#4a5568', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 4px', borderRadius: '4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0aec0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
          >
            ✕
          </button>
        )}

        {focused && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00e5ff', flexShrink: 0 }} />}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${px}px`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#1a3a5c', fontSize: fs }}>
            <div style={{ fontSize: compact ? '20px' : '28px', marginBottom: '6px' }}>✳</div>
            <div>{agentLabel}</div>
          </div>
        )}

        {messages.map((m, i) => {
          const isLastAssistant = i === messages.length - 1 && m.role === 'assistant'
          return (
            <div
              key={i}
              style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}
              onMouseEnter={() => isLastAssistant && setHoveredLastMsg(true)}
              onMouseLeave={() => isLastAssistant && setHoveredLastMsg(false)}
            >
              <div style={{
                maxWidth: '88%',
                padding: `${compact ? 5 : 7}px ${compact ? 9 : 12}px`,
                borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                background: m.role === 'user'
                  ? 'rgba(0,229,255,0.10)'
                  : m.content.startsWith('⚠')
                    ? 'rgba(255,82,82,0.10)'
                    : '#0d1f33',
                border: m.role === 'user'
                  ? '1px solid rgba(0,229,255,0.20)'
                  : m.content.startsWith('⚠')
                    ? '1px solid rgba(255,82,82,0.20)'
                    : '1px solid rgba(255,255,255,0.06)',
                color: m.role === 'user' ? '#e2e8f0' : '#cbd5e0',
                fontSize: fs,
                lineHeight: '1.55',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {m.content || (loading && i === messages.length - 1
                  ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ display: 'flex', gap: 3 }}>
                        {[0, 0.3, 0.6].map((d, k) => (
                          <span key={k} style={{ animation: `blink 1.2s ${d}s infinite step-end`, color: '#00e5ff', fontSize: fs }}>●</span>
                        ))}
                      </span>
                      {thinkingMs > 3000 && (
                        <span style={{ fontSize: '9px', color: 'rgba(0,229,255,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {(thinkingMs / 1000).toFixed(0)}s
                        </span>
                      )}
                    </span>
                  )
                  : '')}
              </div>
              {isLastAssistant && !loading && m.content && hoveredLastMsg && (
                <button
                  onClick={e => { e.stopPropagation(); retry() }}
                  title="Retry"
                  style={{ fontSize: '9px', color: '#4a5568', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 4px', marginTop: '2px', fontFamily: 'monospace' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#a0aec0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
                >
                  ↺ retry
                </button>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: `${compact ? 6 : 8}px ${px}px`,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        gap: '6px',
        background: 'rgba(0,0,0,0.20)',
        flexShrink: 0,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          onClick={e => e.stopPropagation()}
          placeholder="Send a message…"
          disabled={loading}
          style={{
            flex: 1,
            background: 'rgba(10,22,40,0.90)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: `${inputPy}px 10px`,
            color: '#e2e8f0',
            fontSize: fs,
            fontFamily: 'monospace',
            outline: 'none',
            minWidth: 0,
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(0,229,255,0.40)'; onFocus() }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
        />
        <button
          onClick={e => { e.stopPropagation(); send() }}
          disabled={!input.trim() || loading}
          style={{
            padding: `${inputPy}px ${compact ? 10 : 14}px`,
            background: input.trim() && !loading ? '#00e5ff' : 'rgba(0,229,255,0.08)',
            border: '1px solid rgba(0,229,255,0.20)',
            borderRadius: '8px',
            color: input.trim() && !loading ? '#050a0f' : '#4a5568',
            fontSize: fs,
            fontWeight: 'bold',
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  )
}
