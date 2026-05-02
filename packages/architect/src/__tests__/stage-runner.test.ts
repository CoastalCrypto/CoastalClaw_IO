import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { WorkItemStore } from '@coastal-ai/core/architect/store'
import { CycleStore } from '@coastal-ai/core/architect/cycle-store'
import { runWorkItemCycle } from '../stage-runner.js'

let tempDir: string
let db: any
let workStore: WorkItemStore
let cycleStore: CycleStore

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-runner-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  workStore = new WorkItemStore(db)
  cycleStore = new CycleStore(db)
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

const okPlanResult = { kind: 'ok' as const, plan: 'p', diff: 'd', modelUsed: 'm' }
const okBuildResult = { kind: 'ok' as const, testSummary: '4 passed' }

describe('runWorkItemCycle', () => {
  it('happy path — plan ok + build ok → cycle outcome=built, work item awaiting_human', async () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const result = await runWorkItemCycle({
      workItem: item,
      workStore, cycleStore,
      runPlan: vi.fn().mockResolvedValue(okPlanResult),
      runBuild: vi.fn().mockResolvedValue(okBuildResult),
      isApprovalRequired: () => false,
    } as any)
    expect(result.outcome).toBe('built')
    const cycles = cycleStore.listForWorkItem(item.id)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].outcome).toBe('built')
    expect(cycles[0].stage).toBe('done')
    expect(cycles[0].planText).toBe('p')
    expect(cycles[0].diffText).toBe('d')
    expect(cycles[0].testSummary).toBe('4 passed')
    expect(workStore.getById(item.id)!.status).toBe('awaiting_human')
  })

  it('soft fail at planning → revise loop, second cycle iteration=2', async () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const runPlan = vi.fn()
      .mockResolvedValueOnce({ kind: 'soft_fail', failureKind: 'parse', message: 'no diff' })
      .mockResolvedValueOnce(okPlanResult)
    const runBuild = vi.fn().mockResolvedValue(okBuildResult)
    const result = await runWorkItemCycle({
      workItem: item,
      workStore, cycleStore,
      runPlan, runBuild,
      isApprovalRequired: () => false,
    } as any)
    expect(result.outcome).toBe('built')
    const cycles = cycleStore.listForWorkItem(item.id)
    expect(cycles.map(c => c.iteration)).toEqual([1, 2])
    expect(cycles[0].failureKind).toBe('parse')
    expect(cycles[0].outcome).toBe('revised')
  })

  it('soft fail exhausts budget → work item cancelled', async () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [], budgetIters: 2 })
    const runPlan = vi.fn().mockResolvedValue({ kind: 'soft_fail', failureKind: 'parse', message: 'x' })
    const result = await runWorkItemCycle({
      workItem: item,
      workStore, cycleStore,
      runPlan,
      runBuild: vi.fn(),
      isApprovalRequired: () => false,
    } as any)
    expect(result.outcome).toBe('cancelled')
    expect(workStore.getById(item.id)!.status).toBe('cancelled')
    const cycles = cycleStore.listForWorkItem(item.id)
    expect(cycles.map(c => c.iteration)).toEqual([1, 2])
    expect(cycles.every(c => c.failureKind === 'parse')).toBe(true)
  })

  it('hard fail at planning → work item paused with status=error', async () => {
    const item = workStore.insert({ source: 'ui', title: 't', body: '', targetHints: [] })
    const runPlan = vi.fn().mockResolvedValue({
      kind: 'hard_fail', failureKind: 'env_llm', message: 'connection refused',
    })
    const result = await runWorkItemCycle({
      workItem: item,
      workStore, cycleStore,
      runPlan,
      runBuild: vi.fn(),
      isApprovalRequired: () => false,
    } as any)
    expect(result.outcome).toBe('error')
    expect(workStore.getById(item.id)!.status).toBe('error')
    expect(workStore.getById(item.id)!.pausedReason).toContain('connection refused')
    const cycles = cycleStore.listForWorkItem(item.id)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].iteration).toBe(1)
  })
})
