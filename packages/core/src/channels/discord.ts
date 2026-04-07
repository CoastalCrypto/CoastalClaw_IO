import type { Channel } from './types.js'

export interface DiscordConfig { webhookUrl: string; username?: string; avatarUrl?: string }

export class DiscordChannel implements Channel {
  constructor(private cfg: DiscordConfig) {}

  async send(message: string): Promise<void> {
    const res = await fetch(this.cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        username: this.cfg.username ?? 'CoastalClaw',
        avatar_url: this.cfg.avatarUrl,
      }),
    })
    if (!res.ok) throw new Error(`Discord error ${res.status}: ${await res.text()}`)
  }
}
