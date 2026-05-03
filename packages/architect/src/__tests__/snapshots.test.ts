// packages/architect/src/__tests__/snapshots.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { SnapshotManager } from '../snapshots.js'
import type Database from 'better-sqlite3'

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function gitRepo(dir: string): void {
  execFileSync('git', ['init', '-q', dir])
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  writeFileSync(join(dir, 'hello.txt'), 'hello\n')
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir })
}

function insertWorkItemAndCycle(db: Database.Database): { workItemId: string; cycleId: string } {
  const now = Date.now()
  db.prepare(`
    INSERT INTO work_items (id, source, title, body, created_at, updated_at)
    VALUES ('wi1', 'ui', 'Test', 'Body', ?, ?)
  `).run(now, now)
  db.prepare(`
    INSERT INTO cycles (id, work_item_id, stage, created_at, updated_at)
    VALUES ('cy1', 'wi1', 'planning', ?, ?)
  `).run(now, now)
  return { workItemId: 'wi1', cycleId: 'cy1' }
}

// -------------------------------------------------------------------------
// Setup / teardown
// -------------------------------------------------------------------------

let repoRoot: string
let dataDir: string
let db: Database.Database
let mgr: SnapshotManager

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'arch-snap-repo-'))
  dataDir  = mkdtempSync(join(tmpdir(), 'arch-snap-data-'))
  gitRepo(repoRoot)

  db = openArchitectDb(join(dataDir, 'architect.db'))
  insertWorkItemAndCycle(db)

  mgr = new SnapshotManager({ repoRoot, dataDir, db })
})

afterEach(() => {
  // Return to master before cleanup (restore tests may leave us on another branch)
  try {
    execFileSync('git', ['checkout', 'master'], { cwd: repoRoot })
  } catch { /* ignore */ }

  db.close()
  rmSync(repoRoot, { recursive: true, force: true })
  rmSync(dataDir,  { recursive: true, force: true })
})

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe('SnapshotManager', () => {
  it('captures a snapshot and records it in the DB', () => {
    const snap = mgr.capture({
      cycleId: 'cy1',
      workItemId: 'wi1',
      capturedBy: 'auto:plan',
      note: 'before planning',
      retention: 'short',
    })

    expect(snap.id).toBeTruthy()
    expect(snap.shadowRef).toMatch(/^[0-9a-f]{40}$/)
    expect(snap.capturedBy).toBe('auto:plan')
    expect(snap.cycleId).toBe('cy1')
    expect(snap.retention).toBe('short')

    const list = mgr.listForCycle('cy1')
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(snap.id)
  })

  it('captures a second snapshot parented to the first', () => {
    const first = mgr.capture({
      cycleId: 'cy1',
      workItemId: 'wi1',
      capturedBy: 'auto:plan',
    })

    // Modify a file so the tree changes
    writeFileSync(join(repoRoot, 'hello.txt'), 'updated\n')

    const second = mgr.capture({
      cycleId: 'cy1',
      workItemId: 'wi1',
      capturedBy: 'auto:building',
    })

    expect(second.parentId).toBe(first.id)

    const list = mgr.listForCycle('cy1')
    expect(list).toHaveLength(2)
  })

  it('restores a snapshot to a recovery branch', () => {
    // Capture initial state (hello.txt = "hello\n")
    const snap = mgr.capture({
      cycleId: 'cy1',
      workItemId: 'wi1',
      capturedBy: 'manual',
    })

    // Modify and commit in the real repo so master has changed
    writeFileSync(join(repoRoot, 'hello.txt'), 'modified\n')
    execFileSync('git', ['add', '-A'], { cwd: repoRoot })
    execFileSync('git', ['commit', '-qm', 'change'], { cwd: repoRoot })

    // Restore the snapshot — should land on architect/restore-<id>
    const branchName = mgr.restore(snap.id)
    expect(branchName).toBe(`architect/restore-${snap.id}`)

    // Current branch should be the restore branch
    const currentBranch = execFileSync(
      'git', ['branch', '--show-current'],
      { cwd: repoRoot, encoding: 'utf8' },
    ).trim()
    expect(currentBranch).toBe(branchName)

    // The file content should be restored to the snapshot state
    const content = readFileSync(join(repoRoot, 'hello.txt'), 'utf8')
    expect(content.replace(/\r\n/g, '\n')).toBe('hello\n')
  })

  it('prunes short-retention snapshots older than maxAgeMs', () => {
    const snap = mgr.capture({
      cycleId: 'cy1',
      workItemId: 'wi1',
      capturedBy: 'auto:plan',
      retention: 'short',
    })

    // Backdate captured_at to make it appear old
    db.prepare('UPDATE snapshots SET captured_at = ? WHERE id = ?')
      .run(Date.now() - 10_000, snap.id)

    const pruned = mgr.prune({ shortMaxAgeMs: 5_000 })
    expect(pruned).toBe(1)

    const list = mgr.listForCycle('cy1')
    expect(list).toHaveLength(0)
  })

  it('does not prune pinned snapshots', () => {
    const snap = mgr.capture({
      cycleId: 'cy1',
      workItemId: 'wi1',
      capturedBy: 'manual',
      retention: 'short',
    })

    // Pin it
    mgr.pin(snap.id)

    // Backdate so it looks old
    db.prepare('UPDATE snapshots SET captured_at = ? WHERE id = ?')
      .run(Date.now() - 10_000, snap.id)

    const pruned = mgr.prune({ shortMaxAgeMs: 5_000 })
    expect(pruned).toBe(0)

    const list = mgr.listForCycle('cy1')
    expect(list).toHaveLength(1)
    expect(list[0].retention).toBe('pinned')
  })
})
