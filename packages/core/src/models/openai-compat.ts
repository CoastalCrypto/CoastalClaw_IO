import { randomUUID } from 'node:crypto'
import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
import type { LocalChatMessage } from './ollama.js'

export interface InferenceClient {
  chat(model: string, messages: LocalChatMessage[]): Promise<string>
  chatStream(model: string, messages: LocalChatMessage[]): AsyncGenerator<string>
  chatWithTools(model: string, messages: ChatMessage[], tools: OllamaToolSchema[]): Promise<{ content: string; toolCalls: ToolCall[] }>
}

export interface OpenAICompatConfig {
  baseUrl: string
  apiKey?: string
  clientName?: string
}

/**
 * Unified client for any OpenAI-compatible /v1/chat/completions endpoint.
 * Handles chat, SSE streaming, and tool use. VllmClient and AirLLMClient
 * extend this instead of duplicating the same wire format.
 */
export class OpenAICompatibleClient implements InferenceClient {
  protected readonly baseUrl: string
  protected readonly apiKey?: string
  private readonly clientName: string

  constructor(config: OpenAICompatConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey
    this.clientName = config.clientName ?? 'OpenAI-compat'
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(2_000) })
      if (res.ok) return true
    } catch {}
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { signal: AbortSignal.timeout(2_000) })
      return res.ok
    } catch {
      return false
    }
  }

  private authHeaders(): Record<string, string> {
    if (this.apiKey) return { 'Authorization': `Bearer ${this.apiKey}` }
    return {}
  }

  async chat(model: string, messages: LocalChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!res.ok) throw new Error(`${this.clientName} error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message.content ?? ''
  }

  async *chatStream(model: string, messages: LocalChatMessage[]): AsyncGenerator<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ model, messages, stream: true }),
      signal: AbortSignal.timeout(300_000),
    })
    if (!res.ok) throw new Error(`${this.clientName} stream error ${res.status}: ${await res.text()}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (payload === '[DONE]') return
        try {
          const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
          const token = chunk.choices?.[0]?.delta?.content
          if (token) yield token
        } catch { /* skip malformed */ }
      }
    }
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const openaiTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }))
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify({ model, messages, tools: openaiTools, stream: false }),
      signal: AbortSignal.timeout(180_000),
    })
    if (!res.ok) throw new Error(`${this.clientName} error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }
    const msg = data.choices[0]?.message
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
      id: tc.id ?? randomUUID(),
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }))
    return { content: msg?.content ?? '', toolCalls }
  }
}
