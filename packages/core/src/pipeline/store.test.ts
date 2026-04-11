import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PipelineStore } from './store.js'
import Database from 'better-sqlite3'

let db: Database.Database
let store: PipelineStore

beforeEach(() => {
  db = new Database(':memory:')
  store = new PipelineStore(db)
})
afterEach(() => {
  void db.close()
})

describe('PipelineStore', () => {
  it('creates and retrieves a pipeline', () => {
    const p = store.create('My Pipeline', [{ agentId: 'general', type: 'agent' }])
    expect(p.name).toBe('My Pipeline')
    expect(p.stages).toHaveLength(1)
    expect(store.get(p.id)?.name).toBe('My Pipeline')
  })

  it('lists all pipelines', () => {
    store.create('A', [])
    store.create('B', [])
    expect(store.list()).toHaveLength(2)
  })

  it('updates a pipeline', () => {
    const p = store.create('Old', [])
    const updated = store.update(p.id, { name: 'New' })
    expect(updated?.name).toBe('New')
  })

  it('deletes a pipeline', () => {
    const p = store.create('Del', [])
    store.delete(p.id)
    expect(store.get(p.id)).toBeUndefined()
  })

  it('returns undefined for unknown id', () => {
    expect(store.get('no-such-id')).toBeUndefined()
  })
})
