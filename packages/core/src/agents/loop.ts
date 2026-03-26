import type { OllamaClient } from '../models/ollama.js'
import type { AgentSession, ChatMessage } from './session.js'
import type { ToolRegistry } from '../tools/registry.js'
import type { PermissionGate } from './permission-gate.js'
import type { ActionLog } from './action-log.js'
import type { LoopResult } from './types.js'

const MAX_TURNS = () => Number(process.env.CC_AGENT_MAX_TURNS ?? 10)
const MAX_RESULT_CHARS = () => Number(process.env.CC_TOOL_RESULT_MAX_CHARS ?? 4000)

export class AgenticLoop {
  constructor(
    private ollama: OllamaClient,
    private registry: ToolRegistry,
    private gate: PermissionGate,
    private log: ActionLog,
    private onApprovalNeeded?: (approvalId: string, agentName: string, toolName: string, cmd: string) => void,
  ) {}

  async run(
    session: AgentSession,
    userMessage: string,
    sessionId: string,
    history: ChatMessage[],
  ): Promise<LoopResult> {
    const messages: ChatMessage[] = session.buildMessages(userMessage, history)
    let turns = 0

    while (turns < MAX_TURNS()) {
      const { content, toolCalls } = await this.ollama.chatWithTools(
        session.agent.modelPref ?? process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
        messages,
        session.toolSchemas,
      )

      if (!toolCalls.length) {
        return {
          reply: content + session.actionSummary(),
          actions: [],
          domain: session.agent.id,
          status: 'complete',
        }
      }

      // Push assistant message with tool_calls
      messages.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls.map(tc => ({
          function: { name: tc.name, arguments: tc.args },
        })),
      })

      // Separate reads and writes for parallel vs sequential execution
      const hasWrite = toolCalls.some(tc => !this.registry.isReversible(tc.name, tc.args))

      if (!hasWrite) {
        // All reads — run concurrently
        const results = await Promise.all(toolCalls.map(tc => this.executeOne(tc, session, sessionId)))
        for (const { tc, output } of results) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: output })
        }
      } else {
        // Sequential — preserve ordering for writes
        for (const tc of toolCalls) {
          const { output } = await this.executeOne(tc, session, sessionId)
          messages.push({ role: 'tool', tool_call_id: tc.id, content: output })
        }
      }

      turns++
    }

    return {
      reply: `${session.actionSummary()}\n\n[Reached maximum turns (${MAX_TURNS()}). Stopping here.]`,
      actions: [],
      domain: session.agent.id,
      status: 'interrupted',
    }
  }

  private async executeOne(
    tc: { id: string; name: string; args: Record<string, unknown> },
    session: AgentSession,
    sessionId: string,
  ): Promise<{ tc: typeof tc; output: string }> {
    const start = Date.now()
    const reversible = this.registry.isReversible(tc.name, tc.args)
    const decision = this.gate.evaluate(session.agent.id, tc.name, reversible, session.agent.tools)

    if (decision === 'block') {
      const duration = Date.now() - start
      this.log.record({
        sessionId,
        agentId: session.agent.id,
        toolName: tc.name,
        args: tc.args,
        result: 'Blocked: tool not permitted for this agent',
        decision: 'block',
        durationMs: duration,
      })
      session.recordAction({
        tool: tc.name,
        args: tc.args,
        output: 'Error: tool not permitted',
        decision: 'block',
        durationMs: duration,
      })
      return { tc, output: `Error: tool "${tc.name}" is not permitted for agent ${session.agent.name}` }
    }

    if (decision === 'queued') {
      const { approvalId, promise } = this.gate.createPendingApproval()
      this.onApprovalNeeded?.(approvalId, session.agent.name, tc.name, JSON.stringify(tc.args))
      const approval = await promise

      if (approval === 'timeout') {
        const duration = Date.now() - start
        this.log.record({
          sessionId,
          agentId: session.agent.id,
          toolName: tc.name,
          args: tc.args,
          result: 'Approval timed out',
          decision: 'timeout',
          durationMs: duration,
        })
        session.recordAction({
          tool: tc.name,
          args: tc.args,
          output: 'Approval timed out',
          decision: 'timeout',
          durationMs: duration,
        })
        return { tc, output: `Error: approval timed out for tool "${tc.name}"` }
      }

      if (approval !== 'approved') {
        // denied
        const duration = Date.now() - start
        this.log.record({
          sessionId,
          agentId: session.agent.id,
          toolName: tc.name,
          args: tc.args,
          result: 'Denied by user',
          decision: 'denied',
          durationMs: duration,
        })
        session.recordAction({
          tool: tc.name,
          args: tc.args,
          output: 'Denied by user',
          decision: 'denied',
          durationMs: duration,
        })
        return { tc, output: `Tool "${tc.name}" was denied by the user` }
      }
    }

    // Execute the tool
    let raw = ''
    try {
      raw = await this.registry.execute(tc.name, tc.args)
    } catch (e: unknown) {
      raw = `Execution error: ${(e as Error).message}`
    }

    const truncated = raw.slice(0, MAX_RESULT_CHARS())
    const duration = Date.now() - start
    const finalDecision = decision === 'queued' ? 'approved' : 'allow'

    this.log.record({
      sessionId,
      agentId: session.agent.id,
      toolName: tc.name,
      args: tc.args,
      result: raw,
      decision: finalDecision,
      durationMs: duration,
    })
    session.recordAction({
      tool: tc.name,
      args: tc.args,
      output: truncated,
      decision: finalDecision,
      durationMs: duration,
    })

    return { tc, output: truncated }
  }
}
