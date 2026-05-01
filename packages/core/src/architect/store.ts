import type Database from 'better-sqlite3'
import { ulid } from './ulid.js'
import { computeDedupSignature } from './dedup.js'
import type {
  WorkItem, ApprovalPolicy, Priority, Source, WorkItemStatus,
} from './types.js'

export class DedupConflictError extends Error {
  constructor(public existingId: string) {
    super(`Active work item with same signature already exists: ${existingId}`)
    this.name = 'DedupConflictError'
  }
}

export interface InsertWorkItemInput {
  source: Source
  sourceRef?: string | null
  title: string
  body: string
  targetHints?: string[] | null
  acceptance?: string | null
  budgetLoc?: number
  budgetIters?: number
  approvalPolicy?: ApprovalPolicy
  reviewTimeoutMin?: number
  onTimeout?: 'revise' | 'reject' | 'auto_approve'
  priority?: Priority
  allowSelfModify?: boolean
  createdByUserId?: string | null
}

const ACTIVE_STATUSES: WorkItemStatus[] = ['pending', 'active', 'awaiting_human']

export class WorkItemStore {
  constructor(private db: Database.Database) {}

  insert(input: InsertWorkItemInput): WorkItem {
    const dedupSig = computeDedupSignature(input.title, input.targetHints)
    const conflict = this.db.prepare(
      `SELECT id FROM work_items
       WHERE dedup_signature = ?
         AND status IN ('pending','active','awaiting_human')
       LIMIT 1`
    ).get(dedupSig) as { id: string } | undefined
    if (conflict) throw new DedupConflictError(conflict.id)

    const id = ulid()
    const now = Date.now()
    this.db.prepare(`
      INSERT INTO work_items (
        id, source, source_ref, title, body,
        target_hints, acceptance,
        budget_loc, budget_iters, approval_policy,
        review_timeout_min, on_timeout, priority, status,
        allow_self_modify, created_by_user_id, dedup_signature,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, 'pending',
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id, input.source, input.sourceRef ?? null, input.title, input.body,
      input.targetHints ? JSON.stringify(input.targetHints) : null,
      input.acceptance ?? null,
      input.budgetLoc ?? 200,
      input.budgetIters ?? 5,
      input.approvalPolicy ?? 'plan-only',
      input.reviewTimeoutMin ?? 60,
      input.onTimeout ?? 'reject',
      input.priority ?? 'normal',
      input.allowSelfModify ? 1 : 0,
      input.createdByUserId ?? null,
      dedupSig,
      now, now,
    )
    return this.getById(id)!
  }

  getById(id: string): WorkItem | null {
    const row = this.db.prepare('SELECT * FROM work_items WHERE id = ?').get(id) as any
    return row ? this.fromRow(row) : null
  }

  listPending(limit = 50): WorkItem[] {
    const rows = this.db.prepare(`
      SELECT * FROM work_items
      WHERE status = 'pending'
      ORDER BY
        CASE priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 WHEN 'low' THEN 2 END,
        created_at ASC
      LIMIT ?
    `).all(limit) as any[]
    return rows.map(r => this.fromRow(r))
  }

  updateStatus(id: string, status: WorkItemStatus, opts: { pausedReason?: string } = {}): void {
    const now = Date.now()
    this.db.prepare(`
      UPDATE work_items
      SET status = ?, paused_reason = ?, paused_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      status,
      status === 'error' || status === 'paused' ? (opts.pausedReason ?? null) : null,
      status === 'error' || status === 'paused' ? now : null,
      now,
      id,
    )
  }

  private fromRow(r: any): WorkItem {
    return {
      id: r.id,
      source: r.source,
      sourceRef: r.source_ref,
      title: r.title,
      body: r.body,
      targetHints: r.target_hints ? JSON.parse(r.target_hints) : null,
      acceptance: r.acceptance,
      budgetLoc: r.budget_loc,
      budgetIters: r.budget_iters,
      approvalPolicy: r.approval_policy,
      reviewTimeoutMin: r.review_timeout_min,
      onTimeout: r.on_timeout,
      priority: r.priority,
      status: r.status,
      pausedReason: r.paused_reason,
      pausedAt: r.paused_at,
      resumable: !!r.resumable,
      recurrenceCount: r.recurrence_count,
      escalatedAt: r.escalated_at,
      allowSelfModify: !!r.allow_self_modify,
      createdByUserId: r.created_by_user_id,
      dedupSignature: r.dedup_signature,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }
}
