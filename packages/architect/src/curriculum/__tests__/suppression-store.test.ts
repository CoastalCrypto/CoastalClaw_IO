import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { SuppressionStore } from '../suppression-store.js'

let tempDir: string
let db: Database.Database
let store: SuppressionStore

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-supp-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  store = new SuppressionStore(db)
})

afterEach(() => {
  if (db && db.open) db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('SuppressionStore', () => {
  it('unsuppressed signature returns false', () => {
    const sig = 'test-signature'
    expect(store.isSuppressed(sig)).toBe(false)
  })

  it('suppressed signature returns true', () => {
    const sig = 'test-signature'
    store.suppress(sig, 'vetoed')
    expect(store.isSuppressed(sig)).toBe(true)
  })

  it('expired suppression is not returned as suppressed', () => {
    const sig = 'expired-sig'
    // Directly insert an expired suppression
    db.prepare(`
      INSERT INTO curriculum_suppressions (id, signature, suppressed_until, reason, created_at)
      VALUES (?, ?, ?, 'failed', ?)
    `).run('test-id', sig, Date.now() - 1000, Date.now())

    expect(store.isSuppressed(sig)).toBe(false)
  })

  it('pruneExpired removes expired suppressions', () => {
    const activeSig = 'active-sig'
    const expiredSig = 'expired-sig'

    store.suppress(activeSig, 'vetoed')
    db.prepare(`
      INSERT INTO curriculum_suppressions (id, signature, suppressed_until, reason, created_at)
      VALUES (?, ?, ?, 'failed', ?)
    `).run('expired-id', expiredSig, Date.now() - 1000, Date.now())

    const removed = store.pruneExpired()
    expect(removed).toBe(1)
    expect(store.isSuppressed(activeSig)).toBe(true)
    expect(store.isSuppressed(expiredSig)).toBe(false)
  })

  it('buildSignature normalizes title and sorts hints', () => {
    const sig1 = SuppressionStore.buildSignature('My Title', ['hint2', 'hint1'])
    const sig2 = SuppressionStore.buildSignature('MY TITLE', ['hint1', 'hint2'])
    expect(sig1).toBe(sig2)
    expect(sig1).toContain('my title')
    expect(sig1).toContain('hint1,hint2')
  })
})
