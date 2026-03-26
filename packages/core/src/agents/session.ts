import { readFileSync } from 'node:fs'
import type { AgentConfig, ToolDefinition, ActionSummary } from './types.js'

export interface OllamaToolSchema {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: ToolDefinition['parameters']
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
  tool_call_id?: string
}

export class AgentSession {
  private _soulContent: string | null = null
  private _actions: ActionSummary[] = []

  constructor(
    readonly agent: AgentConfig,
    readonly allowedTools: ToolDefinition[],
  ) {}

  get systemPrompt(): string {
    if (!this._soulContent) {
      this._soulContent = readFileSync(this.agent.soulPath, 'utf8')
    }
    const toolLines = this.allowedTools
      .map(t => `- ${t.name}(${Object.keys(t.parameters.properties).join(', ')}): ${t.description}`)
      .join('\n')
    const now = new Date().toISOString()
    return `${this._soulContent}\n\nAvailable tools:\n${toolLines}\n\nCurrent date/time: ${now}`
  }

  get toolSchemas(): OllamaToolSchema[] {
    return this.allowedTools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }))
  }

  buildMessages(userMessage: string, history: ChatMessage[]): ChatMessage[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ]
  }

  recordAction(summary: ActionSummary): void {
    this._actions.push(summary)
  }

  actionSummary(): string {
    if (this._actions.length === 0) return ''
    const counts = new Map<string, number>()
    for (const a of this._actions) {
      counts.set(a.tool, (counts.get(a.tool) ?? 0) + 1)
    }
    const parts = [...counts.entries()].map(([tool, count]) => `${tool}×${count}`)
    return `\n\n---\n_Actions: ${parts.join(' · ')}_`
  }

  invalidateSoulCache(): void {
    this._soulContent = null
  }
}
