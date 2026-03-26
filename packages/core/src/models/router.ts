import { OllamaClient, type ChatMessage } from './ollama.js'
import { CascadeRouter } from '../routing/cascade.js'
import type { RouteDecision } from '../routing/types.js'
import { loadConfig } from '../config.js'

export interface RouterConfig {
  ollamaUrl: string
  defaultModel: string
}

export interface ChatOptions {
  model?: string
}

export class ModelRouter {
  private ollama: OllamaClient
  private cascade: CascadeRouter

  constructor(private config: RouterConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
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

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<{ reply: string; decision: RouteDecision }> {
    const lastMessage = messages[messages.length - 1].content
    const decision = await this.cascade.route(lastMessage)

    // Two-layer failover: try primary, then each fallback in order
    const candidates = options?.model
      ? [options.model]
      : [decision.model, ...decision.fallbackModels]

    let lastErr: unknown
    for (const model of candidates) {
      try {
        const reply = await this.ollama.chat(model, messages)
        return { reply, decision: { ...decision, model } }
      } catch (err) {
        lastErr = err
        console.warn(`[router] model ${model} failed, trying next fallback`)
      }
    }
    throw lastErr ?? new Error('All candidate models failed')
  }

  async listModels(): Promise<string[]> {
    return this.ollama.listModels()
  }

  close(): void {
    this.cascade.close()
  }
}
