import Database from 'better-sqlite3'

export interface UserPreference {
  key: string
  value: string
  updatedAt: number
}

export class UserModelStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  }

  getAll(): UserPreference[] {
    return (this.db.prepare('SELECT * FROM user_preferences ORDER BY key ASC').all() as any[]).map(r => ({
      key: r.key, value: r.value, updatedAt: r.updated_at,
    }))
  }

  set(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, Date.now())
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM user_preferences WHERE key = ?').run(key)
  }

  /** Renders preferences as a system prompt section, empty string if none set */
  toPromptSection(): string {
    const prefs = this.getAll()
    if (prefs.length === 0) return ''
    return '\n\n---\n## User Preferences\n' + prefs.map(p => `- **${p.key}**: ${p.value}`).join('\n')
  }
}
