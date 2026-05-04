import { useEffect, useRef } from 'react'

const BASE_URL = import.meta.env.VITE_CORE_API_URL || 'http://127.0.0.1:4747'

/**
 * Subscribe to the architect SSE event stream.
 * Calls `onEvent` for each incoming event.
 * Automatically reconnects on connection loss.
 */
export function useArchitectSSE(onEvent: (event: any) => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      const url = `${BASE_URL}/api/admin/architect/events?since=${Date.now()}`

      es = new EventSource(url)

      es.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data)
          onEventRef.current(data)
        } catch {}
      }

      es.onerror = () => {
        es?.close()
        reconnectTimer = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      es?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])
}
