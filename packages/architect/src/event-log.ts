import type Database from 'better-sqlite3'
import { ulid } from '@coastal-ai/core/architect/ulid'

export interface ArchitectEvent {
  id: string
  cycleId: string | null
  workItemId: string | null
  eventType: string
  payload: Record<string, unknown> | null
  createdAt: number
}

export class EventLog {
  constructor(private db: Database.Database) {}

  emit(
    eventType: string,
    opts: { cycleId?: string | null; workItemId?: string | null; [key: string]: unknown },
  ): void {
    const { cycleId, workItemId, ...rest } = opts
    const id = ulid()
    const payload = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null
    this.db.prepare(`
      INSERT INTO architect_events (id, cycle_id, work_item_id, event_type, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, cycleId ?? null, workItemId ?? null, eventType, payload, Date.now())
  }

  listForWorkItem(workItemId: string, limit = 100): ArchitectEvent[] {
    const rows = this.db.prepare(
      'SELECT * FROM architect_events WHERE work_item_id = ? ORDER BY created_at ASC LIMIT ?'
    ).all(workItemId, limit) as any[]
    return rows.map(r => this.fromRow(r))
  }

  listSince(sinceMs: number, limit = 100): ArchitectEvent[] {
    const rows = this.db.prepare(
      'SELECT * FROM architect_events WHERE created_at >= ? ORDER BY created_at ASC LIMIT ?'
    ).all(sinceMs, limit) as any[]
    return rows.map(r => this.fromRow(r))
  }

  private fromRow(r: any): ArchitectEvent {
    return {
      id: r.id,
      cycleId: r.cycle_id,
      workItemId: r.work_item_id,
      eventType: r.event_type,
      payload: r.payload ? JSON.parse(r.payload) : null,
      createdAt: r.created_at,
    }
  }
}
