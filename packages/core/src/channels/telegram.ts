import type { Channel } from './types.js'

export interface TelegramConfig { botToken: string; chatId: string }

export class TelegramChannel implements Channel {
  constructor(private cfg: TelegramConfig) {}

  async send(message: string): Promise<void> {
    const res = await fetch(
      `https://api.telegram.org/bot${this.cfg.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: this.cfg.chatId, text: message, parse_mode: 'Markdown' }),
      },
    )
    if (!res.ok) throw new Error(`Telegram error ${res.status}: ${await res.text()}`)
  }
}
