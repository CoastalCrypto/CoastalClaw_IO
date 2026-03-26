import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'

export interface LocalChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class OllamaClient {
  constructor(private config: { baseUrl: string }) {}

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.config.baseUrl}/api/tags`)
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { models: Array<{ name: string }> }
    return data.models.map((m) => m.name)
  }

  async chat(model: string, messages: LocalChatMessage[]): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { message: LocalChatMessage }
    return data.message.content
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      message: {
        role: string
        content: string
        tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>
      }
    }
    const toolCalls: ToolCall[] = (data.message.tool_calls ?? []).map((tc, i) => ({
      id: `tc-${i}-${Date.now()}`,
      name: tc.function.name,
      args: tc.function.arguments ?? {},
    }))
    return { content: data.message.content, toolCalls }
  }
}
