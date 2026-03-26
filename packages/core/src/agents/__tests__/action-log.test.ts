import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ActionLog } from '../action-log.js'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let db: Database.Database

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-log-'))
  db = new Database(join(tmpDir, 'test.db'))
})
afterEach(() => { db.close(); rmSync(tmpDir, { recursive: true }) })

describe('ActionLog', () => {
  it('records an action entry', () => {
    const log = new ActionLog(db)
    log.record({
      sessionId: 'sess-1',
      agentId: 'cto',
      toolName: 'read_file',
      args: { path: '/tmp/x' },
      result: 'file contents',
      decision: 'allow',
      durationMs: 42,
    })
    const entries = log.getForSession('sess-1')
    expect(entries).toHaveLength(1)
    expect(entries[0].toolName).toBe('read_file')
    expect(entries[0].decision).toBe('allow')
    expect(entries[0].result).toBe('file contents')
  })

  it('truncates result at 2000 chars for display but preserves full in result_full', () => {
    const log = new ActionLog(db)
    const longResult = 'x'.repeat(5000)
    log.record({
      sessionId: 'sess-2',
      agentId: 'cto',
      toolName: 'read_file',
      args: {},
      result: longResult,
      decision: 'allow',
      durationMs: 1,
    })
    const entries = log.getForSession('sess-2')
    expect(entries[0].result.length).toBeLessThanOrEqual(2000)
    expect(entries[0].resultFull.length).toBe(5000)
  })
})
