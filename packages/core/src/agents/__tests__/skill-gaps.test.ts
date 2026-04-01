// packages/core/src/agents/__tests__/skill-gaps.test.ts
import { describe, it, expect, afterAll } from 'vitest'
import { SkillGapsLog } from '../skill-gaps.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

describe('SkillGapsLog', () => {
  const dir = mkdtempSync(`${tmpdir()}/coastal-gaps-`)
  const log = new SkillGapsLog(dir)

  afterAll(() => {
    log.close()
    rmSync(dir, { recursive: true })
  })

  it('records a skill gap', () => {
    log.record({
      sessionId: 'sess-1',
      agentId: 'cfo',
      toolName: 'query_db',
      failurePattern: 'Error: SQLITE_ERROR: no such table: revenues',
      args: { mode: 'read', query: 'SELECT * FROM revenues' },
      timestamp: Date.now(),
    })
    const gaps = log.listUnreviewed()
    expect(gaps).toHaveLength(1)
    expect(gaps[0].agentId).toBe('cfo')
    expect(gaps[0].toolName).toBe('query_db')
  })

  it('markReviewed removes from unreviewed list', () => {
    const gaps = log.listUnreviewed()
    log.markReviewed(gaps[0].id)
    expect(log.listUnreviewed()).toHaveLength(0)
  })
})
