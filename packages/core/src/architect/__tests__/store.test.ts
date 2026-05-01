import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '../db.js'
import { WorkItemStore, DedupConflictError } from '../store.js'
import type Database from 'better-sqlite3'

let tempDir: string
let db: Database.Database
let store: WorkItemStore

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'architect-store-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  store = new WorkItemStore(db)
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('WorkItemStore.insert', () => {
  it('returns the inserted item with assigned id and timestamps', () => {
    const item = store.insert({
      source: 'ui',
      title: 'Add retry',
      body: 'Wrap http_get in retry',
      targetHints: ['packages/core/src/web.ts'],
    })
    expect(item.id).toMatch(/^[0-9a-z]{26}$/i) // ulid
    expect(item.status).toBe('pending')
    expect(item.budgetIters).toBe(5)
    expect(item.priority).toBe('normal')
    expect(item.dedupSignature).toMatch(/^[0-9a-f]{64}$/)
    expect(item.createdAt).toBeGreaterThan(0)
  })

  it('throws DedupConflictError when an active item with same signature exists', () => {
    store.insert({ source: 'ui', title: 'Add retry', body: 'b', targetHints: ['x.ts'] })
    expect(() =>
      store.insert({ source: 'markdown', title: 'add retry', body: 'b2', targetHints: ['x.ts'] })
    ).toThrow(DedupConflictError)
  })

  it('allows reuse of signature after the prior item reaches a terminal state', () => {
    const first = store.insert({ source: 'ui', title: 'X', body: 'b', targetHints: [] })
    store.updateStatus(first.id, 'merged')
    expect(() =>
      store.insert({ source: 'ui', title: 'X', body: 'b2', targetHints: [] })
    ).not.toThrow()
  })
})

describe('WorkItemStore.list', () => {
  it('orders pending items by priority then created_at', async () => {
    const a = store.insert({ source: 'ui', title: 'a', body: '', targetHints: [] })
    await new Promise(r => setTimeout(r, 5))
    const b = store.insert({ source: 'ui', title: 'b', body: '', targetHints: [], priority: 'high' })
    await new Promise(r => setTimeout(r, 5))
    const c = store.insert({ source: 'ui', title: 'c', body: '', targetHints: [], priority: 'low' })

    const pending = store.listPending()
    expect(pending.map(i => i.title)).toEqual(['b', 'a', 'c']) // high → normal → low
  })
})
