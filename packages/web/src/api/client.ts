export interface SendMessageOptions {
  message: string
  sessionId?: string
  model?: string
}

export interface SendMessageResult {
  reply: string
  sessionId: string
}

export class CoreClient {
  constructor(private baseUrl: string) {}

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Chat request failed (${res.status}): ${text}`)
    }

    return res.json()
  }
}

export const coreClient = new CoreClient('/api')
