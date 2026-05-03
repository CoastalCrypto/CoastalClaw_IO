import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { EventLog } from '../event-log.js'

let tempDir: string
let db: any
let log: EventLog

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-events-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  log = new EventLog(db)
  // Create dummy work_items and cycles for FK constraints
  db.prepare(`
    INSERT INTO work_items (id, source, title, body, created_at, updated_at)
    VALUES ('w1', 'ui', 'Test', 'Body', ?, ?)
  `).run(Date.now(), Date.now())
  db.prepare(`
    INSERT INTO cycles (id, work_item_id, stage, created_at, updated_at)
    VALUES ('c1', 'w1', 'planning', ?, ?)
  `).run(Date.now(), Date.now())
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('EventLog', () => {
  it('emits and retrieves events', () => {
    log.emit('cycle_started', { cycleId: 'c1', workItemId: 'w1' })
    log.emit('plan_ok', { cycleId: 'c1', workItemId: 'w1', modelUsed: 'test' })
    const events = log.listForWorkItem('w1')
    expect(events).toHaveLength(2)
    expect(events[0].eventType).toBe('cycle_started')
    expect(events[1].eventType).toBe('plan_ok')
  })

  it('returns events since a given timestamp', async () => {
    log.emit('a', { cycleId: null, workItemId: null })
    await new Promise(r => setTimeout(r, 2))
    const before = Date.now()
    await new Promise(r => setTimeout(r, 2))
    log.emit('b', { cycleId: null, workItemId: null })
    const since = log.listSince(before)
    expect(since).toHaveLength(1)
    expect(since[0].eventType).toBe('b')
  })

  it('stores payload as JSON', () => {
    log.emit('pr_created', { cycleId: 'c1', workItemId: 'w1', prUrl: 'https://github.com/x/1' })
    const events = log.listForWorkItem('w1')
    expect(events[0].payload).toEqual({ prUrl: 'https://github.com/x/1' })
  })
})
