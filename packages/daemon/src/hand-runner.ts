// packages/daemon/src/hand-runner.ts

export interface HandRunResult {
  agentId: string
  reply: string
  status: string
  timestamp: number
}

export class HandRunner {
  private readonly baseUrl: string

  constructor(baseUrl = 'http://localhost:4747') {
    this.baseUrl = baseUrl
  }

  async run(agentId: string, goal: string, sessionId: string): Promise<HandRunResult> {
    const apiUrl = `${this.baseUrl}/api/chat`

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: `[HAND_RUN] ${goal}`,
        }),
        signal: AbortSignal.timeout(120_000),
      })

      if (!res.ok) {
        return { agentId, reply: `HTTP ${res.status}`, status: 'error', timestamp: Date.now() }
      }

      const data = await res.json() as { reply: string; domain: string }
      return { agentId, reply: data.reply, status: 'complete', timestamp: Date.now() }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { agentId, reply: `HandRunner error: ${msg}`, status: 'error', timestamp: Date.now() }
    }
  }
}
