import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PermissionGate } from '../permission-gate.js'
import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let db: Database.Database

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-gate-'))
  db = new Database(join(tmpDir, 'test.db'))
})
afterEach(() => { db.close(); rmSync(tmpDir, { recursive: true }) })

describe('PermissionGate.evaluate', () => {
  it('BLOCKs tool not in agent permitted list', () => {
    const gate = new PermissionGate(db)
    const decision = gate.evaluate('cto', 'unknown_tool', false)
    expect(decision).toBe('block')
  })

  it('ALLOWs reversible tool in permitted list', () => {
    const gate = new PermissionGate(db)
    const decision = gate.evaluate('cto', 'read_file', true, ['read_file'])
    expect(decision).toBe('allow')
  })

  it('QUEUEs irreversible tool not always-allowed', () => {
    const gate = new PermissionGate(db)
    const decision = gate.evaluate('cto', 'run_command', false, ['run_command'])
    expect(decision).toBe('queued')
  })

  it('ALLOWs irreversible tool after always-allow set', () => {
    const gate = new PermissionGate(db)
    gate.setAlwaysAllow('cto', 'run_command')
    const decision = gate.evaluate('cto', 'run_command', false, ['run_command'])
    expect(decision).toBe('allow')
  })

  it('query_db is ALLOW in read mode, QUEUE in write mode', () => {
    const gate = new PermissionGate(db)
    expect(gate.evaluate('cto', 'query_db', true, ['query_db'])).toBe('allow')
    expect(gate.evaluate('cto', 'query_db', false, ['query_db'])).toBe('queued')
  })
})
