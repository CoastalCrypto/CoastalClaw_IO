import { randomUUID } from 'node:crypto'
import type { Domain } from './persona-resolver.js'

export interface AcpSession {
  readonly id: string
  domain: Domain | null
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  pendingPrompt: AbortController | null
}

export class AcpSessionStore {
  private readonly sessions = new Map<string, AcpSession>()

  create(): AcpSession {
    const id = randomUUID()
    const session: AcpSession = { id, domain: null, history: [], pendingPrompt: null }
    this.sessions.set(id, session)
    return session
  }

  get(id: string): AcpSession | undefined {
    return this.sessions.get(id)
  }

  list(): AcpSession[] {
    return [...this.sessions.values()]
  }

  appendUser(id: string, content: string): AcpSession {
    const s = this.requireSession(id)
    return this.replaceHistory(s, [...s.history, { role: 'user', content }])
  }

  appendAssistant(id: string, content: string): AcpSession {
    const s = this.requireSession(id)
    return this.replaceHistory(s, [...s.history, { role: 'assistant', content }])
  }

  setDomain(id: string, domain: Domain): AcpSession {
    const s = this.requireSession(id)
    if (s.domain !== null) return s
    s.domain = domain
    return s
  }

  abort(id: string): void {
    const s = this.sessions.get(id)
    s?.pendingPrompt?.abort()
    if (s) s.pendingPrompt = null
  }

  private requireSession(id: string): AcpSession {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`ACP session not found: ${id}`)
    return s
  }

  private replaceHistory(s: AcpSession, history: AcpSession['history']): AcpSession {
    s.history = history
    return s
  }
}
