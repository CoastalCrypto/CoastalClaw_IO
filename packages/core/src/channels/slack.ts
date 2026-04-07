import type { Channel } from './types.js'

export interface SlackConfig { webhookUrl: string; channel?: string; username?: string; iconEmoji?: string }

export class SlackChannel implements Channel {
  constructor(private cfg: SlackConfig) {}

  async send(message: string): Promise<void> {
    const body: Record<string, unknown> = { text: message }
    if (this.cfg.channel)   body.channel    = this.cfg.channel
    if (this.cfg.username)  body.username   = this.cfg.username
    if (this.cfg.iconEmoji) body.icon_emoji = this.cfg.iconEmoji

    const res = await fetch(this.cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Slack error ${res.status}: ${await res.text()}`)
  }
}
