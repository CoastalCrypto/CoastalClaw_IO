import type Database from 'better-sqlite3'
import { ulid } from '@coastal-ai/core/architect/ulid'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export class SuppressionStore {
  constructor(private db: Database.Database) {}

  static buildSignature(title: string, targetHints: string[] | null): string {
    const normalTitle = title.toLowerCase().trim()
    const hints = (targetHints ?? []).slice().sort().join(',')
    return hints ? `${normalTitle}|${hints}` : normalTitle
  }

  isSuppressed(signature: string): boolean {
    const row = this.db.prepare(
      'SELECT id FROM curriculum_suppressions WHERE signature = ? AND suppressed_until > ?'
    ).get(signature, Date.now())
    return !!row
  }

  suppress(signature: string, reason: 'vetoed' | 'failed' | 'duplicate'): void {
    const id = ulid()
    this.db.prepare(`
      INSERT INTO curriculum_suppressions (id, signature, suppressed_until, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, signature, Date.now() + THIRTY_DAYS_MS, reason, Date.now())
  }

  pruneExpired(): number {
    return this.db.prepare(
      'DELETE FROM curriculum_suppressions WHERE suppressed_until <= ?'
    ).run(Date.now()).changes
  }
}
