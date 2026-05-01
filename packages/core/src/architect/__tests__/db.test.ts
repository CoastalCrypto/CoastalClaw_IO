import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '../db.js'

let tempDir: string
let dbPath: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'architect-db-'))
  dbPath = join(tempDir, 'architect.db')
})

afterEach(() => { rmSync(tempDir, { recursive: true, force: true }) })

describe('openArchitectDb', () => {
  it('creates all required tables on first open', () => {
    const db = openArchitectDb(dbPath)
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>
    const names = tables.map(t => t.name)
    expect(names).toEqual(expect.arrayContaining([
      'work_items', 'cycles', 'approvals', 'cycle_metrics',
      'snapshots', 'curriculum_suppressions',
    ]))
    db.close()
  })

  it('is idempotent on second open', () => {
    openArchitectDb(dbPath).close()
    expect(() => openArchitectDb(dbPath).close()).not.toThrow()
  })

  it('CHECK on cycles.outcome enforces the enum', () => {
    const db = openArchitectDb(dbPath)
    expect(() => {
      db.prepare(
        "INSERT INTO cycles (id, kind, iteration, stage, outcome, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run('c1', 'normal', 1, 'done', 'INVALID_VALUE', Date.now(), Date.now())
    }).toThrow(/CHECK/)
    db.close()
  })

  it('CHECK on work_items.status enforces the enum', () => {
    const db = openArchitectDb(dbPath)
    expect(() => {
      db.prepare(
        "INSERT INTO work_items (id, source, title, body, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run('w1', 'ui', 't', 'b', 'NOT_A_STATUS', Date.now(), Date.now())
    }).toThrow(/CHECK/)
    db.close()
  })
})
