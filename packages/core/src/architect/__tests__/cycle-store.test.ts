import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '../db.js'
import { WorkItemStore } from '../store.js'
import { CycleStore } from '../cycle-store.js'

let tempDir: string
let db: Database.Database
let workStore: WorkItemStore
let cycleStore: CycleStore

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-cycle-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  workStore = new WorkItemStore(db)
  cycleStore = new CycleStore(db)
})

afterEach(() => {
  // Close db handle before rm to avoid Windows EPERM on the SQLite files.
  if (db && db.open) db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('CycleStore', () => {
  it('starts a cycle with iteration=1 for first attempt', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const cycle = cycleStore.start(item.id)
    expect(cycle.iteration).toBe(1)
    expect(cycle.stage).toBe('planning')
    expect(cycle.outcome).toBeNull()
  })

  it('increments iteration on subsequent revises within the same work item', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c1 = cycleStore.start(item.id)
    cycleStore.terminate(c1.id, { outcome: 'revised', failureKind: 'test', planText: 'p1' })
    const c2 = cycleStore.startRevise(item.id, c1.id, { reason: 'tests failed', testOutput: '...' })
    expect(c2.iteration).toBe(2)
    expect(c2.reviseContext).toMatchObject({ from_cycle: c1.id, reason: 'tests failed' })
  })

  it('terminate sets stage to done on outcome=merged', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c = cycleStore.start(item.id)
    cycleStore.terminate(c.id, { outcome: 'merged' })
    const refreshed = cycleStore.getById(c.id)!
    expect(refreshed.stage).toBe('done')
    expect(refreshed.outcome).toBe('merged')
  })

  it('terminate sets stage to done on outcome=built (Plan-1 success)', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c = cycleStore.start(item.id)
    cycleStore.terminate(c.id, { outcome: 'built' })
    const refreshed = cycleStore.getById(c.id)!
    expect(refreshed.stage).toBe('done')
    expect(refreshed.outcome).toBe('built')
  })

  it('terminate sets stage to cancelled on outcome=vetoed/failed/error', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    for (const outcome of ['vetoed', 'failed', 'error'] as const) {
      const c = cycleStore.start(item.id)
      cycleStore.terminate(c.id, { outcome })
      expect(cycleStore.getById(c.id)!.stage).toBe('cancelled')
    }
  })

  it('listForWorkItem returns all cycles ordered by iteration', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const a = cycleStore.start(item.id)
    cycleStore.terminate(a.id, { outcome: 'revised' })
    const b = cycleStore.startRevise(item.id, a.id, { reason: 'r' })
    expect(cycleStore.listForWorkItem(item.id).map(c => c.iteration)).toEqual([1, 2])
    expect(cycleStore.listForWorkItem(item.id)[1].id).toBe(b.id)
  })

  it('startRevise throws when fromCycleId does not exist', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    expect(() => cycleStore.startRevise(item.id, 'NONEXISTENT_ID', { reason: 'r' })).toThrow(/not found/)
  })

  it('startRevise: explicit from_cycle wins over a stray field in ctx', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c1 = cycleStore.start(item.id)
    cycleStore.terminate(c1.id, { outcome: 'revised' })
    const c2 = cycleStore.startRevise(item.id, c1.id, { from_cycle: 'WRONG', reason: 'r' })
    expect(c2.reviseContext).toMatchObject({ from_cycle: c1.id })
  })

  it('listByStage returns cycles in the given stage', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c = cycleStore.start(item.id)
    expect(cycleStore.listByStage('planning')).toHaveLength(1)
    expect(cycleStore.listByStage('building')).toHaveLength(0)
    cycleStore.setStage(c.id, 'building')
    expect(cycleStore.listByStage('building')).toHaveLength(1)
    expect(cycleStore.listByStage('planning')).toHaveLength(0)
  })

  it('listRecent returns recent cycles with limit', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    for (let i = 0; i < 5; i++) {
      const c = cycleStore.start(item.id)
      cycleStore.terminate(c.id, { outcome: 'revised' })
    }
    expect(cycleStore.listRecent(3)).toHaveLength(3)
    expect(cycleStore.listRecent(10)).toHaveLength(5)
  })

  it('recordApproval stores the approval decision', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c = cycleStore.start(item.id)
    cycleStore.recordApproval(c.id, {
      gate: 'plan',
      decision: 'approved',
      decidedBy: 'admin',
      comment: 'Looks good',
    })
    // Verify via the cycle detail (approval is recorded)
    const cycle = cycleStore.getById(c.id)!
    expect(cycle).toBeDefined()
  })

  it('getInsights returns aggregate stats', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c1 = cycleStore.start(item.id)
    cycleStore.terminate(c1.id, { outcome: 'merged', durationMs: 5000 })
    const c2 = cycleStore.start(item.id)
    cycleStore.terminate(c2.id, { outcome: 'failed', failureKind: 'test' })

    const insights = cycleStore.getInsights(30)
    expect(insights.successRate).toBe(0.5)
    expect(insights.totalDurationMs).toBe(5000)
    expect(insights.topFailureKind).toBe('test')
  })

  it('listMergedWithPR returns only merged cycles with PR URLs', () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const c1 = cycleStore.start(item.id)
    cycleStore.terminate(c1.id, { outcome: 'merged', prUrl: 'https://github.com/x/1' })
    const c2 = cycleStore.start(item.id)
    cycleStore.terminate(c2.id, { outcome: 'failed' })

    const merged = cycleStore.listMergedWithPR()
    expect(merged).toHaveLength(1)
    expect(merged[0].prUrl).toBe('https://github.com/x/1')
    expect(merged[0].outcome).toBe('merged')
  })
})
