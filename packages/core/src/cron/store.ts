import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface CronJob {
  id: string
  name: string
  schedule: string        // cron expression e.g. "0 9 * * 1-5"
  task: string            // message to send to agent
  agentId: string
  enabled: boolean
  lastRunAt: number | null
  lastRunStatus: 'ok' | 'error' | null
  lastRunOutput: string | null
  createdAt: number
}

export class CronStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        schedule        TEXT NOT NULL,
        task            TEXT NOT NULL,
        agent_id        TEXT NOT NULL DEFAULT 'general',
        enabled         INTEGER NOT NULL DEFAULT 1,
        last_run_at     INTEGER,
        last_run_status TEXT,
        last_run_output TEXT,
        created_at      INTEGER NOT NULL
      )
    `)
  }

  list(): CronJob[] {
    return (this.db.prepare('SELECT * FROM cron_jobs ORDER BY created_at ASC').all() as any[]).map(this.map)
  }

  get(id: string): CronJob | null {
    const row = this.db.prepare('SELECT * FROM cron_jobs WHERE id = ?').get(id) as any
    return row ? this.map(row) : null
  }

  create(data: Pick<CronJob, 'name' | 'schedule' | 'task' | 'agentId'>): CronJob {
    const id = randomUUID()
    this.db.prepare(`
      INSERT INTO cron_jobs (id, name, schedule, task, agent_id, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(id, data.name, data.schedule, data.task, data.agentId, Date.now())
    return this.get(id)!
  }

  update(id: string, data: Partial<Pick<CronJob, 'name' | 'schedule' | 'task' | 'agentId' | 'enabled'>>): void {
    const sets: string[] = []
    const vals: any[] = []
    if (data.name      !== undefined) { sets.push('name = ?');     vals.push(data.name) }
    if (data.schedule  !== undefined) { sets.push('schedule = ?'); vals.push(data.schedule) }
    if (data.task      !== undefined) { sets.push('task = ?');     vals.push(data.task) }
    if (data.agentId   !== undefined) { sets.push('agent_id = ?'); vals.push(data.agentId) }
    if (data.enabled   !== undefined) { sets.push('enabled = ?');  vals.push(data.enabled ? 1 : 0) }
    if (!sets.length) return
    this.db.prepare(`UPDATE cron_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...vals, id)
  }

  recordRun(id: string, status: 'ok' | 'error', output: string): void {
    this.db.prepare(`
      UPDATE cron_jobs SET last_run_at = ?, last_run_status = ?, last_run_output = ? WHERE id = ?
    `).run(Date.now(), status, output.slice(0, 500), id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM cron_jobs WHERE id = ?').run(id)
  }

  private map(row: any): CronJob {
    return {
      id: row.id,
      name: row.name,
      schedule: row.schedule,
      task: row.task,
      agentId: row.agent_id,
      enabled: Boolean(row.enabled),
      lastRunAt: row.last_run_at ?? null,
      lastRunStatus: row.last_run_status ?? null,
      lastRunOutput: row.last_run_output ?? null,
      createdAt: row.created_at,
    }
  }
}
