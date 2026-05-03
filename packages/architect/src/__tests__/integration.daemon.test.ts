import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { WorkItemStore } from '@coastal-ai/core/architect/store'
import { CycleStore } from '@coastal-ai/core/architect/cycle-store'
import { ArchitectDaemon } from '../daemon.js'

let tempDir: string
let db: any
let workStore: WorkItemStore
let cycleStore: CycleStore

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-daemon-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  workStore = new WorkItemStore(db)
  cycleStore = new CycleStore(db)
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('ArchitectDaemon end-to-end', () => {
  it('processes a pending work item through plan + build with mocked deps', async () => {
    workStore.insert({ source: 'ui', title: 'Add retry', body: 'b', targetHints: ['x.ts'] })

    const daemon = new ArchitectDaemon({
      workStore, cycleStore,
      runPlan: vi.fn().mockResolvedValue({
        kind: 'ok', plan: 'p', diff: '--- a/x.ts\n+++ b/x.ts\n@@\n+x\n', modelUsed: 'mock',
      }),
      runBuild: vi.fn().mockResolvedValue({ kind: 'ok', testSummary: 'OK' }),
      isApprovalRequired: () => false,
      log: vi.fn(),
    })

    await daemon.tick()

    const pendingAfter = workStore.listPending()
    expect(pendingAfter).toHaveLength(0)
    const allItems = (workStore as any).db
      .prepare('SELECT * FROM work_items')
      .all() as Array<{ status: string; id: string }>
    expect(allItems).toHaveLength(1)
    expect(allItems[0].status).toBe('awaiting_human')
    const cycles = cycleStore.listForWorkItem(allItems[0].id)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].outcome).toBe('built')
  })

  it('respects the lockfile — second tick refuses to run if first is mid-flight', async () => {
    workStore.insert({ source: 'ui', title: 'A', body: 'b', targetHints: [] })
    workStore.insert({ source: 'ui', title: 'B', body: 'b', targetHints: [] })

    let resolveA: (() => void) | null = null
    const planA = new Promise<any>(res => { resolveA = () => res({ kind: 'ok', plan: 'p', diff: '+x', modelUsed: 'm' }) })

    const daemon = new ArchitectDaemon({
      workStore, cycleStore,
      runPlan: vi.fn().mockReturnValue(planA),
      runBuild: vi.fn().mockResolvedValue({ kind: 'ok', testSummary: '' }),
      isApprovalRequired: () => false,
      log: vi.fn(),
    })

    const first = daemon.tick()
    const second = await daemon.tick()
    expect(second).toBe('locked')
    resolveA!()
    await first
  })

  it('polls and transitions merged PR to outcome=merged', async () => {
    const item = workStore.insert({ source: 'ui', title: 'Fix', body: 'b', targetHints: [] })
    // Manually create a cycle in pr_review stage
    const cycle = cycleStore.start(item.id)
    // Set it to pr_review with a prUrl by updating directly
    db.prepare("UPDATE cycles SET stage = 'pr_review', pr_url = ? WHERE id = ?")
      .run('https://github.com/x/1', cycle.id)
    workStore.updateStatus(item.id, 'awaiting_human')

    const daemon = new ArchitectDaemon({
      workStore, cycleStore,
      runPlan: vi.fn().mockResolvedValue({ kind: 'hard_fail', failureKind: 'env_llm', message: '' }),
      runBuild: vi.fn(),
      isApprovalRequired: () => false,
      pollPR: vi.fn().mockResolvedValue({ status: 'merged' }),
      emitEvent: vi.fn(),
      log: vi.fn(),
    })

    await daemon.tick()
    const updated = cycleStore.getById(cycle.id)!
    expect(updated.outcome).toBe('merged')
    expect(updated.stage).toBe('done')
    expect(workStore.getById(item.id)!.status).toBe('merged')
  })
})
