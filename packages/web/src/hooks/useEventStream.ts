import { useEffect, useRef, useState, useCallback } from 'react'

const BASE = `http://localhost:${(import.meta as any).env?.VITE_CORE_PORT ?? 4747}`

export interface AgentEvent {
  type: string
  ts: number
  sessionId?: string
  agentId?: string
  toolName?: string
  args?: Record<string, unknown>
  durationMs?: number
  decision?: string
  success?: boolean
  toolCallCount?: number
  tokenCount?: number
  jobName?: string
  status?: string
  title?: string
  url?: string
}

export function useEventStream(maxEvents = 100) {
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close()
    const es = new EventSource(`${BASE}/api/events`)
    esRef.current = es

    es.onopen = () => setConnected(true)

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as AgentEvent
        setEvents(prev => {
          const next = [...prev, event]
          return next.length > maxEvents ? next.slice(-maxEvents) : next
        })
      } catch {}
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
      // Reconnect after 3s
      setTimeout(connect, 3000)
    }
  }, [maxEvents])

  useEffect(() => {
    connect()
    return () => { esRef.current?.close() }
  }, [connect])

  const clear = useCallback(() => setEvents([]), [])

  return { events, connected, clear }
}
