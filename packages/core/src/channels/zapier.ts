import type { Channel } from './types.js'

export interface ZapierConfig { webhookUrl: string }

export class ZapierChannel implements Channel {
  constructor(private cfg: ZapierConfig) {}

  async send(message: string): Promise<void> {
    const res = await fetch(this.cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, timestamp: new Date().toISOString(), source: 'coastal-ai' }),
    })
    if (!res.ok) throw new Error(`Zapier error ${res.status}: ${await res.text()}`)
  }
}
