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
})
