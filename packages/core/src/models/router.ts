// packages/core/src/models/router.ts
import { OllamaClient, type LocalChatMessage } from './ollama.js'
import { VllmClient } from './vllm.js'
import { CascadeRouter } from '../routing/cascade.js'
import type { RouteDecision } from '../routing/types.js'
import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
import { loadConfig } from '../config.js'

export interface RouterConfig {
  ollamaUrl: string
  vllmUrl?: string
  defaultModel: string
}

export interface ChatOptions {
  model?: string
}

export class ModelRouter {
  ollama: OllamaClient
  vllm: VllmClient
  cascade: CascadeRouter
  private vllmAvailable: boolean | null = null

  constructor(private config: RouterConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
    this.vllm = new VllmClient(config.vllmUrl ?? 'http://localhost:8000')
    const appConfig = loadConfig()
    this.cascade = new CascadeRouter({
      ollamaUrl: config.ollamaUrl,
      dataDir: appConfig.dataDir,
      routerConfidence: appConfig.routerConfidence,
      tinyRouterModel: appConfig.tinyRouterModel,
      quantRouterModel: appConfig.quantRouterModel,
      vramBudgetGb: appConfig.vramBudgetGb,
    })
  }

  /** Lazy probe: checks vLLM once, caches result. */
  private async inferenceClient(): Promise<OllamaClient | VllmClient> {
    if (this.vllmAvailable === null) {
      this.vllmAvailable = await this.vllm.isAvailable()
      console.log(`[model-router] inference backend: ${this.vllmAvailable ? 'vLLM (GPU)' : 'Ollama (CPU)'}`)
    }
    return this.vllmAvailable ? this.vllm : this.ollama
  }

  async chat(
    messages: LocalChatMessage[],
    options?: ChatOptions,
  ): Promise<{ reply: string; decision: RouteDecision }> {
    const lastMessage = messages[messages.length - 1].content
    const decision = await this.cascade.route(lastMessage)
    const client = await this.inferenceClient()

    const candidates = options?.model
      ? [options.model]
      : [decision.model, ...decision.fallbackModels]

    let lastErr: unknown
    for (const model of candidates) {
      try {
        const reply = await client.chat(model, messages)
        return { reply, decision: { ...decision, model } }
      } catch (err) {
        lastErr = err
        console.warn(`[router] model ${model} failed, trying next fallback`)
      }
    }
    throw lastErr ?? new Error('All candidate models failed')
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const client = await this.inferenceClient()
    return client.chatWithTools(model, messages, tools)
  }

  async listModels(): Promise<string[]> {
    return this.ollama.listModels()
  }

  close(): void {
    this.cascade.close()
  }
}
