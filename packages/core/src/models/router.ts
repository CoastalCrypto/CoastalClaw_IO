import { OllamaClient, type ChatMessage } from './ollama.js'

export interface RouterConfig {
  ollamaUrl: string
  defaultModel: string
}

export interface ChatOptions {
  model?: string
}

export class ModelRouter {
  private ollama: OllamaClient

  constructor(private config: RouterConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const model = options?.model ?? this.config.defaultModel
    return this.ollama.chat(model, messages)
  }

  async listModels(): Promise<string[]> {
    return this.ollama.listModels()
  }
}
