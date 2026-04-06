// packages/core/src/models/vllm.ts
import { randomUUID } from 'node:crypto'
import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
import type { LocalChatMessage } from './ollama.js'

/**
 * Thin client for vLLM's OpenAI-compatible HTTP API.
 * Speaks the same logical interface as OllamaClient so ModelRouter can swap them.
 *
 * vLLM serves at localhost:8000 by default.
 * Install: pip install vllm
 * Start:   vllm serve <model-name>
 */
export class VllmClient {
  constructor(private readonly baseUrl = 'http://localhost:8000') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async chat(model: string, messages: LocalChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`vLLM error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices[0]?.message.content ?? ''
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    // Convert Ollama tool schema → OpenAI function tool format
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools: openaiTools, stream: false }),
    })
    if (!res.ok) throw new Error(`vLLM error ${res.status}: ${await res.text()}`)

    const data = await res.json() as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{
            id: string
            function: { name: string; arguments: string }
          }>
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
