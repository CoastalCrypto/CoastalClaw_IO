import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { MemoryEntry, MemoryQuery, MemoryStore } from './types.js'

export class LosslessAdapter implements MemoryStore {
  private db: Database.Database

  constructor(private config: { dataDir: string }) {
    mkdirSync(config.dataDir, { recursive: true })
    this.db = new Database(join(config.dataDir, 'lossless.db'))
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_session ON messages(session_id);
    `)
  }

  async write(entry: MemoryEntry): Promise<void> {
    this.db
      .prepare(`
        INSERT OR REPLACE INTO messages (id, session_id, role, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.sessionId,
        entry.role,
        entry.content,
        entry.timestamp,
        entry.metadata ? JSON.stringify(entry.metadata) : null
      )
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM messages WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `)
      .all(q.sessionId, q.limit ?? 100) as Array<{
        id: string
        session_id: string
        role: string
        content: string
        timestamp: number
        metadata: string | null
      }>

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role as MemoryEntry['role'],
      content: r.content,
      timestamp: r.timestamp,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
    }))
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
