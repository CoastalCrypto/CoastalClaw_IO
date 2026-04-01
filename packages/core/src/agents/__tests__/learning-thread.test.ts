import { describe, it, expect, afterAll } from 'vitest'
import { runBackgroundReview } from '../learning-thread.js'
import { SkillGapsLog } from '../skill-gaps.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import type { LoopResult } from '../types.js'

describe('runBackgroundReview', () => {
  const dir = mkdtempSync(`${tmpdir()}/coastal-review-`)
  const log = new SkillGapsLog(dir)

  afterAll(() => {
    log.close()
    rmSync(dir, { recursive: true })
  })

  it('logs tool errors as skill gaps', async () => {
    const result: LoopResult = {
      reply: 'Done',
      domain: 'cfo',
      status: 'complete',
      actions: [
        { tool: 'query_db', args: { mode: 'read' }, output: 'Error: no such table', decision: 'allow', durationMs: 5 },
        { tool: 'read_file', args: { path: 'report.txt' }, output: 'file contents', decision: 'allow', durationMs: 3 },
      ],
    }
    await runBackgroundReview(result, 'sess-abc', log)
    const gaps = log.listUnreviewed()
    expect(gaps).toHaveLength(1)
    expect(gaps[0].toolName).toBe('query_db')
    expect(gaps[0].failurePattern).toContain('no such table')
  })

  it('logs blocked tool calls', async () => {
    const result: LoopResult = {
      reply: 'Done',
      domain: 'general',
      status: 'complete',
      actions: [
        { tool: 'write_file', args: {}, output: 'Error: tool not permitted', decision: 'block', durationMs: 1 },
      ],
    }
    await runBackgroundReview(result, 'sess-xyz', log)
    const gaps = log.listUnreviewed()
    expect(gaps.some((g: any) => g.toolName === 'write_file')).toBe(true)
  })

  it('ignores successful actions', async () => {
    const before = log.listUnreviewed().length
    const result: LoopResult = {
      reply: 'Done',
      domain: 'general',
      status: 'complete',
      actions: [
        { tool: 'read_file', args: {}, output: 'contents', decision: 'allow', durationMs: 2 },
      ],
    }
    await runBackgroundReview(result, 'sess-clean', log)
    expect(log.listUnreviewed().length).toBe(before)
  })
})
