import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import type { ChannelRecord, ChannelType, Channel } from './types.js'
import { TelegramChannel } from './telegram.js'
import { DiscordChannel } from './discord.js'
import { SlackChannel } from './slack.js'
import { ZapierChannel } from './zapier.js'

export class ChannelManager {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS output_channels (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        name        TEXT NOT NULL,
        config      TEXT NOT NULL,
        enabled     INTEGER DEFAULT 1,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      )
    `)
  }

  list(): ChannelRecord[] {
    return (this.db.prepare('SELECT * FROM output_channels ORDER BY created_at DESC').all() as any[])
      .map(this.toRecord)
  }

  get(id: string): ChannelRecord | undefined {
    const r = this.db.prepare('SELECT * FROM output_channels WHERE id = ?').get(id) as any
    return r ? this.toRecord(r) : undefined
  }

  create(data: { type: ChannelType; name: string; config: Record<string, string> }): ChannelRecord {
    const now = Date.now()
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO output_channels (id, type, name, config, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, data.type, data.name, JSON.stringify(data.config), now, now)
    return this.get(id)!
  }

  update(id: string, data: Partial<{ name: string; config: Record<string, string>; enabled: boolean }>): ChannelRecord | undefined {
    const fields: string[] = []
    const values: unknown[] = []
    if (data.name    !== undefined) { fields.push('name = ?');    values.push(data.name) }
    if (data.config  !== undefined) { fields.push('config = ?');  values.push(JSON.stringify(data.config)) }
    if (data.enabled !== undefined) { fields.push('enabled = ?'); values.push(data.enabled ? 1 : 0) }
    if (!fields.length) return this.get(id)
    fields.push('updated_at = ?')
    values.push(Date.now(), id)
    this.db.prepare(`UPDATE output_channels SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return this.get(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM output_channels WHERE id = ?').run(id)
  }

  /** Send a message to all enabled channels, or a specific channel by id */
  async broadcast(message: string, channelId?: string): Promise<{ id: string; name: string; success: boolean; error?: string }[]> {
    const records = channelId
      ? this.list().filter(c => c.id === channelId)
      : this.list().filter(c => c.enabled)

    return Promise.all(records.map(async (r) => {
      try {
        const ch = this.buildChannel(r)
        await ch.send(message)
        return { id: r.id, name: r.name, success: true }
      } catch (e: unknown) {
        return { id: r.id, name: r.name, success: false, error: (e as Error).message }
      }
    }))
  }

  private buildChannel(r: ChannelRecord): Channel {
    const cfg = JSON.parse(r.config)
    switch (r.type) {
      case 'telegram': return new TelegramChannel(cfg)
      case 'discord':  return new DiscordChannel(cfg)
      case 'slack':    return new SlackChannel(cfg)
      case 'zapier':   return new ZapierChannel(cfg)
      default: throw new Error(`Unknown channel type: ${r.type}`)
    }
  }

  private toRecord(r: any): ChannelRecord {
    return {
      id: r.id, type: r.type as ChannelType,
      name: r.name, config: r.config,
      enabled: r.enabled, createdAt: r.created_at, updatedAt: r.updated_at,
    }
  }
}
