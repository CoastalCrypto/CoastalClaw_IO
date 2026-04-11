import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface SavedStageConfig {
  agentId: string
  type: 'agent' | 'ralph-loop'
  modelPref?: string
  loopBack?: { toStageIdx: number; condition: string; maxIterations: number }
  ralphLoop?: { cron?: string; condition?: string }
}

export interface SavedPipeline {
  id: string
  name: string
  stages: SavedStageConfig[]
  createdAt: number
  updatedAt: number
}

export class PipelineStore {
  constructor(private db: Database.Database) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipelines (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        stages     TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `)
  }

  list(): SavedPipeline[] {
    return (this.db.prepare('SELECT * FROM pipelines ORDER BY updated_at DESC').all() as any[])
      .map(this.row)
  }

  get(id: string): SavedPipeline | undefined {
    const row = this.db.prepare('SELECT * FROM pipelines WHERE id = ?').get(id) as any
    return row ? this.row(row) : undefined
  }

  create(name: string, stages: SavedStageConfig[]): SavedPipeline {
    const now = Date.now()
    const id = randomUUID()
    this.db.prepare(
      'INSERT INTO pipelines (id, name, stages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(id, name, JSON.stringify(stages), now, now)
    return this.get(id)!
  }

  update(id: string, patch: Partial<Pick<SavedPipeline, 'name' | 'stages'>>): SavedPipeline | undefined {
    const existing = this.get(id)
    if (!existing) return undefined
    const name = patch.name ?? existing.name
    const stages = patch.stages ?? existing.stages
    this.db.prepare(
      'UPDATE pipelines SET name = ?, stages = ?, updated_at = ? WHERE id = ?'
    ).run(name, JSON.stringify(stages), Date.now(), id)
    return this.get(id)!
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM pipelines WHERE id = ?').run(id)
  }

  private row = (r: any): SavedPipeline => {
    return {
      id: r.id,
      name: r.name,
      stages: JSON.parse(r.stages),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }
}
