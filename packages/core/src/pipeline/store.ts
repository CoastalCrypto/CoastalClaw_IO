import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export interface PipelineRun {
  runId: string
  pipelineId: string | null
  pipelineName: string
  status: 'running' | 'done' | 'error' | 'aborted'
  stageCount: number
  finalOutput: string | null
  error: string | null
  totalDurationMs: number | null
  startedAt: number
}

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
      );
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        run_id            TEXT PRIMARY KEY,
        pipeline_id       TEXT,
        pipeline_name     TEXT NOT NULL DEFAULT '',
        status            TEXT NOT NULL DEFAULT 'running',
        stage_count       INTEGER NOT NULL DEFAULT 0,
        final_output      TEXT,
        error             TEXT,
        total_duration_ms INTEGER,
        started_at        INTEGER NOT NULL
      )
    `)
  }

  // ── Run history ────────────────────────────────────────────────────────────

  createRun(runId: string, pipelineId: string | undefined, pipelineName: string, stageCount: number, startedAt: number): void {
    this.db.prepare(
      'INSERT OR IGNORE INTO pipeline_runs (run_id, pipeline_id, pipeline_name, stage_count, started_at) VALUES (?, ?, ?, ?, ?)'
    ).run(runId, pipelineId ?? null, pipelineName, stageCount, startedAt)
  }

  finalizeRun(runId: string, status: 'done' | 'error' | 'aborted', opts: { finalOutput?: string; error?: string; totalDurationMs?: number } = {}): void {
    this.db.prepare(
      'UPDATE pipeline_runs SET status = ?, final_output = ?, error = ?, total_duration_ms = ? WHERE run_id = ?'
    ).run(status, opts.finalOutput ?? null, opts.error ?? null, opts.totalDurationMs ?? null, runId)
  }

  listRuns(limit = 20): PipelineRun[] {
    return (this.db.prepare('SELECT * FROM pipeline_runs ORDER BY started_at DESC LIMIT ?').all(limit) as any[])
      .map(r => ({
        runId: r.run_id,
        pipelineId: r.pipeline_id,
        pipelineName: r.pipeline_name,
        status: r.status,
        stageCount: r.stage_count,
        finalOutput: r.final_output,
        error: r.error,
        totalDurationMs: r.total_duration_ms,
        startedAt: r.started_at,
      }))
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
