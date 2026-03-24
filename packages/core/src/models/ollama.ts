export interface ChatMessage {
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

  async chat(model: string, messages: ChatMessage[]): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { message: ChatMessage }
    return data.message.content
  }
}
