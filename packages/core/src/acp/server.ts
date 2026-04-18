// Coastal ACP agent — implements the Agent interface from
// @agentclientprotocol/sdk and bridges into Coastal's AgenticLoop.
//
// Phase 2 wires the real LLM:
//   - newSession creates an AcpSession (ACP holds its own short-form history)
//   - prompt resolves the domain (env pin > keyword classify > general),
//     looks up the AgentConfig, builds an AgentSession, and runs AgenticLoop
//   - onToken streams agent_message_chunk updates as the LLM generates
//   - onApprovalNeeded routes through ACP's requestPermission

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

import { AgentSession, type ChatMessage } from '../agents/session.js'
import { AgenticLoop } from '../agents/loop.js'

import type { CoastalRuntime } from './runtime.js'
import { AcpSessionStore, type AcpSession } from './sessions.js'
import { resolveDomain, type Domain } from './persona-resolver.js'
import { makeApprovalNotifier } from './permissions.js'
import { subscribeToolCalls } from './tool-call-bridge.js'

export class CoastalACPAgent implements Agent {
  private readonly sessions = new AcpSessionStore()

  constructor(
    private readonly conn: AgentSideConnection,
    private readonly runtime: CoastalRuntime,
    private readonly logToStderr: (...parts: unknown[]) => void = () => {},
  ) {}

  async initialize(_req: InitializeRequest): Promise<InitializeResponse> {
    return {
      protocolVersion: PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false },
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
        this.sessions.setDomain(session.id, resolveDomain(userText))
      }
      const domain: Domain = session.domain ?? 'general'

      const reply = await this.runLoop(session, domain, userText, abort.signal)

      if (abort.signal.aborted) return { stopReason: 'cancelled' }

      this.sessions.appendAssistant(session.id, reply)
      return { stopReason: 'end_turn' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logToStderr('prompt error:', msg)
      await this.conn.sessionUpdate({
        sessionId: session.id,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: `[Coastal error] ${msg}` },
        },
      })
      return { stopReason: 'end_turn' }
    } finally {
      session.pendingPrompt = null
    }
  }

  private async runLoop(
    session: AcpSession,
    domain: Domain,
    userText: string,
    signal: AbortSignal,
  ): Promise<string> {
    const agent = this.runtime.agentRegistry.getByDomain(domain)
      ?? this.runtime.agentRegistry.get('general')
    if (!agent) throw new Error('No agent registered (not even general)')

    const persona = this.runtime.personaMgr.get()
    const toolDefs = this.runtime.toolRegistry.getDefinitionsFor(agent.tools)
    const agentSession = new AgentSession(agent, toolDefs, persona)

    const onToken = (token: string): void => {
      void this.conn.sessionUpdate({
        sessionId: session.id,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: token },
        },
      })
    }

    const onApprovalNeeded = makeApprovalNotifier({
      gate: this.runtime.gate,
      conn: this.conn,
      acpSessionId: session.id,
      agentId: agent.id,
      logToStderr: this.logToStderr,
    })

    const loop = new AgenticLoop(
      this.runtime.ollama,
      this.runtime.toolRegistry,
      this.runtime.gate,
      this.runtime.log,
      onApprovalNeeded,
      undefined,
      onToken,
    )

    const history: ChatMessage[] = session.history.slice(0, -1).map((h) => ({
      role: h.role,
      content: h.content,
    }))

    const unsubscribeToolCalls = subscribeToolCalls({
      conn: this.conn,
      acpSessionId: session.id,
      loopSessionId: session.id,
      logToStderr: this.logToStderr,
    })

    try {
      const result = await loop.run(
        agentSession,
        userText,
        session.id,
        history,
        undefined,
        signal,
      )
      return result.reply
    } finally {
      unsubscribeToolCalls()
    }
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
