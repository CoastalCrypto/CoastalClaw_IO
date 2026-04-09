import { useState, useRef, useEffect, useCallback } from 'react'
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
  compact: boolean   // true when 3+ panes — shrinks font/padding
}

export function ChatPane({ paneIndex, agents, focused, onFocus, compact }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const sessionId = useRef(randomUUID())
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedAgent = agents.find(a => a.id === selectedAgentId)
  const agentLabel = selectedAgent?.name ?? 'Auto'

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setLoading(true)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

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
            if (!gotFirst) { gotFirst = true; clearTimeout(tid) }
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

      if (!fullReply) {
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
      setLoading(false)
    }
  }, [input, loading, selectedAgentId])

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
        background: 'rgba(5,13,26,0.80)',
        border: focused ? '1px solid rgba(0,212,255,0.45)' : '1px solid rgba(255,255,255,0.06)',
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
        <span style={{ fontSize: '10px', color: '#A0AEC0', fontFamily: 'monospace', minWidth: '16px' }}>
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
            color: selectedAgentId ? '#00D4FF' : '#718096',
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

        {messages.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); abortRef.current?.abort(); setMessages([]); setLoading(false) }}
            title="Clear pane"
            style={{ fontSize: '10px', color: '#4a5568', cursor: 'pointer', background: 'none', border: 'none', padding: '2px 4px', borderRadius: '4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#a0aec0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#4a5568')}
          >
            ✕
          </button>
        )}

        {focused && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#00D4FF', flexShrink: 0 }} />}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `${px}px`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#2d3748', fontSize: fs }}>
            <div style={{ fontSize: compact ? '20px' : '28px', marginBottom: '6px' }}>✳</div>
            <div>{agentLabel}</div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '88%',
              padding: `${compact ? 5 : 7}px ${compact ? 9 : 12}px`,
              borderRadius: m.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: m.role === 'user'
                ? 'rgba(0,212,255,0.15)'
                : m.content.startsWith('⚠')
                  ? 'rgba(255,82,82,0.10)'
                  : 'rgba(26,39,68,0.90)',
              border: m.role === 'user'
                ? '1px solid rgba(0,212,255,0.25)'
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
                ? <span style={{ color: '#00D4FF', animation: 'pulse 1.2s infinite' }}>▍</span>
                : '')}
            </div>
          </div>
        ))}
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
            background: 'rgba(5,13,26,0.90)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: `${inputPy}px 10px`,
            color: '#e2e8f0',
            fontSize: fs,
            fontFamily: 'monospace',
            outline: 'none',
            minWidth: 0,
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(0,212,255,0.40)'; onFocus() }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)' }}
        />
        <button
          onClick={e => { e.stopPropagation(); send() }}
          disabled={!input.trim() || loading}
          style={{
            padding: `${inputPy}px ${compact ? 10 : 14}px`,
            background: input.trim() && !loading ? '#00D4FF' : 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.20)',
            borderRadius: '8px',
            color: input.trim() && !loading ? '#050d1a' : '#4a5568',
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
