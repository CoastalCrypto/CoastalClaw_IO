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

describe('WorkItemStore.listByStatus', () => {
  it('filters by status', () => {
    const a = store.insert({ source: 'ui', title: 'A', body: '', targetHints: [] })
    const b = store.insert({ source: 'ui', title: 'B', body: '', targetHints: [] })
    store.updateStatus(b.id, 'cancelled')

    expect(store.listByStatus('pending')).toHaveLength(1)
    expect(store.listByStatus('pending')[0].title).toBe('A')
    expect(store.listByStatus('cancelled')).toHaveLength(1)
    expect(store.listByStatus('merged')).toHaveLength(0)
  })
})

describe('WorkItemStore.listAll', () => {
  it('returns all items up to limit', () => {
    for (let i = 0; i < 5; i++) {
      store.insert({ source: 'ui', title: `T${i}`, body: '', targetHints: [] })
    }
    expect(store.listAll(3)).toHaveLength(3)
    expect(store.listAll()).toHaveLength(5)
  })
})

describe('WorkItemStore.countByStatus', () => {
  it('returns counts grouped by status', () => {
    store.insert({ source: 'ui', title: 'X', body: '', targetHints: [] })
    store.insert({ source: 'ui', title: 'Y', body: '', targetHints: [] })
    const z = store.insert({ source: 'ui', title: 'Z', body: '', targetHints: [] })
    store.updateStatus(z.id, 'cancelled')

    const counts = store.countByStatus()
    expect(counts.pending).toBe(2)
    expect(counts.cancelled).toBe(1)
  })
})

describe('WorkItemStore.updateStatus', () => {
  it('sets pausedReason for error status', () => {
    const item = store.insert({ source: 'ui', title: 'Err', body: '', targetHints: [] })
    store.updateStatus(item.id, 'error', { pausedReason: 'LLM down' })

    const updated = store.getById(item.id)!
    expect(updated.status).toBe('error')
    expect(updated.pausedReason).toBe('LLM down')
    expect(updated.pausedAt).toBeGreaterThan(0)
  })

  it('clears pausedReason when resuming from error', () => {
    const item = store.insert({ source: 'ui', title: 'Fix', body: '', targetHints: [] })
    store.updateStatus(item.id, 'error', { pausedReason: 'broken' })
    store.updateStatus(item.id, 'pending')

    const updated = store.getById(item.id)!
    expect(updated.status).toBe('pending')
    expect(updated.pausedReason).toBeNull()
    expect(updated.pausedAt).toBeNull()
  })

  it('getById returns null for nonexistent id', () => {
    expect(store.getById('nonexistent')).toBeNull()
  })
})
