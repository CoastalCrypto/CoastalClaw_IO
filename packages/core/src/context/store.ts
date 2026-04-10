import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface ContextDoc {
  id: string
  title: string
  content: string
  scope: string   // 'global' or an agentId to target a specific agent
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export class ContextStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_docs (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        content    TEXT NOT NULL,
        scope      TEXT NOT NULL DEFAULT 'global',
        enabled    INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  }

  /** Returns enabled docs that match 'global' or the given agentId scope */
  listForAgent(agentId: string): ContextDoc[] {
    return (this.db
      .prepare(`SELECT * FROM context_docs WHERE enabled = 1 AND (scope = 'global' OR scope = ?) ORDER BY created_at ASC`)
      .all(agentId) as any[]).map(this.map)
  }

  list(): ContextDoc[] {
    return (this.db.prepare('SELECT * FROM context_docs ORDER BY created_at ASC').all() as any[]).map(this.map)
  }

  get(id: string): ContextDoc | null {
    const row = this.db.prepare('SELECT * FROM context_docs WHERE id = ?').get(id) as any
    return row ? this.map(row) : null
  }

  create(data: Pick<ContextDoc, 'title' | 'content' | 'scope'>): ContextDoc {
    const id = randomUUID()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO context_docs (id, title, content, scope, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, data.title, data.content, data.scope ?? 'global', now, now)
    return this.get(id)!
  }

  update(id: string, data: Partial<Pick<ContextDoc, 'title' | 'content' | 'scope' | 'enabled'>>): ContextDoc | null {
    const sets: string[] = ['updated_at = ?']
    const vals: any[] = [Date.now()]
    if (data.title   !== undefined) { sets.push('title = ?');   vals.push(data.title) }
    if (data.content !== undefined) { sets.push('content = ?'); vals.push(data.content) }
    if (data.scope   !== undefined) { sets.push('scope = ?');   vals.push(data.scope) }
    if (data.enabled !== undefined) { sets.push('enabled = ?'); vals.push(data.enabled ? 1 : 0) }
    this.db.prepare(`UPDATE context_docs SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
    return this.get(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM context_docs WHERE id = ?').run(id)
  }

  private map(row: any): ContextDoc {
    return {
      id: row.id, title: row.title, content: row.content, scope: row.scope,
      enabled: Boolean(row.enabled), createdAt: row.created_at, updatedAt: row.updated_at,
    }
  }
}
