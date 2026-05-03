import type Database from 'better-sqlite3'
import { ulid } from './ulid.js'
import type { Cycle, CycleStage, CycleOutcome, FailureKind, CycleKind } from './types.js'

export interface StartOpts {
  kind?: CycleKind
}

export interface TerminateOpts {
  outcome: CycleOutcome
  failureKind?: FailureKind
  planText?: string
  diffText?: string
  branchName?: string
  prUrl?: string
  testSummary?: string
  modelUsed?: string
  errorMessage?: string
  durationMs?: number
}

export interface ReviseContext {
  from_cycle?: string
  reason?: string
  comment?: string
  testOutput?: string
  prComments?: string
}

export class CycleStore {
  constructor(private db: Database.Database) {}

  start(workItemId: string, opts: StartOpts = {}): Cycle {
    const id = ulid()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO cycles (id, work_item_id, kind, iteration, stage, created_at, updated_at)
      VALUES (?, ?, ?, 1, 'planning', ?, ?)
    `).run(id, workItemId, opts.kind ?? 'normal', now, now)
    return this.getById(id)!
  }

  startRevise(workItemId: string, fromCycleId: string, ctx: ReviseContext): Cycle {
    const prior = this.db.prepare('SELECT iteration FROM cycles WHERE id = ?').get(fromCycleId) as { iteration: number } | undefined
    if (!prior) throw new Error(`startRevise: cycle ${fromCycleId} not found`)
    const nextIter = prior.iteration + 1
    const id = ulid()
    const now = Date.now()
    // Spread ctx first so the explicit from_cycle always wins, even if a caller
    // accidentally passes one in ReviseContext.
    const reviseContext = JSON.stringify({ ...ctx, from_cycle: fromCycleId })
    this.db.prepare(`
      INSERT INTO cycles (id, work_item_id, kind, iteration, stage, revise_context, created_at, updated_at)
      VALUES (?, ?, 'normal', ?, 'planning', ?, ?, ?)
    `).run(id, workItemId, nextIter, reviseContext, now, now)
    return this.getById(id)!
  }

  terminate(cycleId: string, opts: TerminateOpts): void {
    // 'built' (Plan 1 success) and 'merged' (Plan 2 success) both transition to done.
    const stage: CycleStage =
      opts.outcome === 'merged' || opts.outcome === 'built' ? 'done' : 'cancelled'
    const now = Date.now()
    this.db.prepare(`
      UPDATE cycles
      SET stage = ?, outcome = ?, failure_kind = ?, plan_text = COALESCE(?, plan_text),
          diff_text = COALESCE(?, diff_text), branch_name = COALESCE(?, branch_name),
          pr_url = COALESCE(?, pr_url), test_summary = COALESCE(?, test_summary),
          model_used = COALESCE(?, model_used), error_message = COALESCE(?, error_message),
          duration_ms = COALESCE(?, duration_ms),
          updated_at = ?
      WHERE id = ?
    `).run(
      stage, opts.outcome, opts.failureKind ?? null,
      opts.planText ?? null, opts.diffText ?? null, opts.branchName ?? null,
      opts.prUrl ?? null, opts.testSummary ?? null, opts.modelUsed ?? null,
      opts.errorMessage ?? null, opts.durationMs ?? null,
      now, cycleId,
    )
  }

  setStage(cycleId: string, stage: CycleStage): void {
    this.db.prepare('UPDATE cycles SET stage = ?, updated_at = ? WHERE id = ?')
      .run(stage, Date.now(), cycleId)
  }

  getById(id: string): Cycle | null {
    const r = this.db.prepare('SELECT * FROM cycles WHERE id = ?').get(id) as any
    return r ? this.fromRow(r) : null
  }

  listForWorkItem(workItemId: string): Cycle[] {
    const rows = this.db.prepare(
      'SELECT * FROM cycles WHERE work_item_id = ? ORDER BY iteration ASC'
    ).all(workItemId) as any[]
    return rows.map(r => this.fromRow(r))
  }

  listByStage(stage: CycleStage): Cycle[] {
    const rows = this.db.prepare(
      'SELECT * FROM cycles WHERE stage = ? ORDER BY created_at ASC'
    ).all(stage) as any[]
    return rows.map(r => this.fromRow(r))
  }

  listRecent(limit: number, opts?: { stage?: string; sinceMs?: number }): Cycle[] {
    let sql = 'SELECT * FROM cycles WHERE 1=1'
    const params: any[] = []
    if (opts?.stage) { sql += ' AND stage = ?'; params.push(opts.stage) }
    if (opts?.sinceMs) { sql += ' AND created_at >= ?'; params.push(opts.sinceMs) }
    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(limit)
    return (this.db.prepare(sql).all(...params) as any[]).map(r => this.fromRow(r))
  }

  recordApproval(cycleId: string, opts: { gate: string; decision: string; comment?: string; decidedBy?: string }): void {
    const id = ulid()
    this.db.prepare(`
      INSERT INTO approvals (id, cycle_id, gate, decision, decided_by, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, cycleId, opts.gate, opts.decision, opts.decidedBy ?? null, opts.comment ?? null, Date.now())
  }

  private fromRow(r: any): Cycle {
    return {
      id: r.id,
      workItemId: r.work_item_id,
      kind: r.kind,
      iteration: r.iteration,
      stage: r.stage,
      planText: r.plan_text,
      diffText: r.diff_text,
      branchName: r.branch_name,
      prUrl: r.pr_url,
      testSummary: r.test_summary,
      modelUsed: r.model_used,
      failureKind: r.failure_kind,
      reviseContext: r.revise_context ? JSON.parse(r.revise_context) : null,
      durationMs: r.duration_ms,
      outcome: r.outcome,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }
}
