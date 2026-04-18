// Coastal ACP agent — implements the Agent interface from
// @agentclientprotocol/sdk. Each ACP session resolves to a Coastal agent
// (coo/cfo/cto/general). The actual LLM/AgenticLoop wiring is intentionally
// deferred — Phase 1 proves transport + persona routing end-to-end.

import type {
  Agent,
  AgentSideConnection,
  InitializeRequest,
  InitializeResponse,
  NewSessionRequest,
  NewSessionResponse,
  AuthenticateRequest,
  AuthenticateResponse,
  PromptRequest,
  PromptResponse,
  CancelNotification,
} from '@agentclientprotocol/sdk'
import { PROTOCOL_VERSION } from '@agentclientprotocol/sdk'

import { AgentRegistry } from '../agents/registry.js'
import { PersonaManager } from '../persona/manager.js'
import { loadConfig } from '../config.js'
import { join as pathJoin } from 'node:path'

import { AcpSessionStore } from './sessions.js'
import { resolveDomain, type Domain } from './persona-resolver.js'
import { makeApprovalBridge } from './permissions.js'

interface CoastalRuntime {
  agentRegistry: AgentRegistry
  personaMgr: PersonaManager
}

function bootRuntime(): CoastalRuntime {
  const config = loadConfig()
  return {
    agentRegistry: new AgentRegistry(pathJoin(config.dataDir, 'agents.db')),
    personaMgr: new PersonaManager(pathJoin(config.dataDir, 'persona.db')),
  }
}

export class CoastalACPAgent implements Agent {
  private readonly sessions = new AcpSessionStore()
  private readonly runtime: CoastalRuntime
  private readonly conn: AgentSideConnection

  constructor(conn: AgentSideConnection) {
    this.conn = conn
    this.runtime = bootRuntime()
  }

  async initialize(_req: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: {
        loadSession: false,
      },
    }
  }

  async authenticate(_req: AuthenticateRequest): Promise<AuthenticateResponse> {
    return {}
  }

  async newSession(_req: NewSessionRequest): Promise<NewSessionResponse> {
    const session = this.sessions.create()
    return { sessionId: session.id }
  }

  async setSessionMode(): Promise<Record<string, never>> {
    return {}
  }

  async cancel(notification: CancelNotification): Promise<void> {
    this.sessions.abort(notification.sessionId)
  }

  async prompt(req: PromptRequest): Promise<PromptResponse> {
    const session = this.sessions.get(req.sessionId)
    if (!session) throw new Error(`Unknown session: ${req.sessionId}`)

    session.pendingPrompt?.abort()
    const abort = new AbortController()
    session.pendingPrompt = abort

    try {
      const userText = extractText(req)
      this.sessions.appendUser(session.id, userText)

      if (session.domain === null) {
        const domain = resolveDomain(userText)
        this.sessions.setDomain(session.id, domain)
      }
      const domain = session.domain ?? 'general'

      const reply = await this.generateReply(domain, userText, abort.signal)
      if (abort.signal.aborted) return { stopReason: 'cancelled' }

      await this.conn.sessionUpdate({
        sessionId: session.id,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: reply },
        },
      })
      this.sessions.appendAssistant(session.id, reply)

      return { stopReason: 'end_turn' }
    } finally {
      session.pendingPrompt = null
    }
  }

  // Phase-1 stub. Phase 2 replaces with: ModelRouter + AgenticLoop run,
  // streaming agent_message_chunk per delta, emitting tool_call updates,
  // and using makeApprovalBridge(this.conn, session.id) for the gate.
  private async generateReply(domain: Domain, userText: string, _signal: AbortSignal): Promise<string> {
    const agent = this.runtime.agentRegistry.getByDomain(domain)
      ?? this.runtime.agentRegistry.get('general')
    const persona = this.runtime.personaMgr.get()
    const agentLabel = agent ? `${agent.name} (${domain})` : `general agent`
    const role = agent?.role ?? 'General assistant'
    const _bridge = makeApprovalBridge(this.conn, '')

    return [
      `[Coastal ACP — Phase 1 stub]`,
      `Persona: ${persona.agentName} @ ${persona.orgName}`,
      `Routed to: ${agentLabel}`,
      `Role: ${role}`,
      ``,
      `Received: ${userText}`,
      ``,
      `(LLM completion not yet wired — confirm routing looks right, then Phase 2 plumbs in ModelRouter + AgenticLoop.)`,
    ].join('\n')
  }
}

function extractText(req: PromptRequest): string {
  const blocks = req.prompt
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') parts.push(block.text)
  }
  return parts.join('\n').trim()
}
