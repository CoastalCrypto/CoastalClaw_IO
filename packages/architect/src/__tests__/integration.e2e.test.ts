// packages/architect/src/__tests__/integration.e2e.test.ts
//
// End-to-end test of the full architect pipeline with mocked LLM.
// Exercises: insert work item -> plan -> build -> PR -> poll merge.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { WorkItemStore } from '@coastal-ai/core/architect/store'
import { CycleStore } from '@coastal-ai/core/architect/cycle-store'
import { ArchitectDaemon } from '../daemon.js'
import { EventLog } from '../event-log.js'

let tempDir: string
let db: any
let workStore: WorkItemStore
let cycleStore: CycleStore
let eventLog: EventLog

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-e2e-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  workStore = new WorkItemStore(db)
  cycleStore = new CycleStore(db)
  eventLog = new EventLog(db)
})

afterEach(() => {
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('Architect E2E', () => {
  it('full pipeline: insert -> plan -> build -> PR -> poll merge', async () => {
    // 1. Insert a work item
    const item = workStore.insert({
      source: 'ui',
      title: 'Add retry logic',
      body: 'Wrap http_get in exponential backoff',
      targetHints: ['packages/core/src/tools/core/web.ts'],
    })
    expect(item.status).toBe('pending')

    // 2. Create daemon with mocked stages
    const daemon = new ArchitectDaemon({
      workStore,
      cycleStore,
      runPlan: vi.fn().mockResolvedValue({
        kind: 'ok',
        plan: 'Wrap http_get in retry with 3 attempts',
        diff: '--- a/web.ts\n+++ b/web.ts\n@@\n+retry()',
        modelUsed: 'vllm:llama-3.1-70b',
      }),
      runBuild: vi.fn().mockResolvedValue({
        kind: 'ok',
        testSummary: '12 tests passed',
      }),
      runPR: vi.fn().mockResolvedValue({
        kind: 'ok',
        prUrl: 'https://github.com/CoastalCrypto/Coastal.AI/pull/42',
        prNumber: 42,
      }),
      isApprovalRequired: () => false,
      captureSnapshot: vi.fn(),
      emitEvent: (type, opts) => eventLog.emit(type, opts),
      pollPR: vi.fn().mockResolvedValue({ status: 'merged' }),
      log: vi.fn(),
    })

    // 3. First tick: processes the work item through plan -> build -> PR
    await daemon.tick()

    // 4. Verify cycle was created with PR
    const cycles = cycleStore.listForWorkItem(item.id)
    expect(cycles.length).toBeGreaterThanOrEqual(1)
    const lastCycle = cycles[cycles.length - 1]
    expect(lastCycle.planText).toBe('Wrap http_get in retry with 3 attempts')
    expect(lastCycle.testSummary).toBe('12 tests passed')
    expect(lastCycle.prUrl).toBe('https://github.com/CoastalCrypto/Coastal.AI/pull/42')

    // 5. Second tick: polls PR and transitions to merged
    await daemon.tick()

    // 6. Verify final state
    const updatedItem = workStore.getById(item.id)!
    expect(updatedItem.status).toBe('merged')

    const finalCycle = cycleStore.getById(lastCycle.id)!
    expect(finalCycle.outcome).toBe('merged')

    // 7. Verify events were emitted
    const events = eventLog.listForWorkItem(item.id)
    expect(events.length).toBeGreaterThan(0)
    const eventTypes = events.map(e => e.eventType)
    expect(eventTypes).toContain('build_ok')
    expect(eventTypes).toContain('pr_created')
  })

  it('revise loop: plan fails, retries, then succeeds', async () => {
    const item = workStore.insert({
      source: 'ui',
      title: 'Fix timeout',
      body: 'Handle connection timeout',
      targetHints: [],
    })

    const runPlan = vi.fn()
      .mockResolvedValueOnce({
        kind: 'soft_fail',
        failureKind: 'parse',
        message: 'no diff block in response',
      })
      .mockResolvedValueOnce({
        kind: 'ok',
        plan: 'Add timeout handler',
        diff: '+timeout()',
        modelUsed: 'test',
      })

    const daemon = new ArchitectDaemon({
      workStore,
      cycleStore,
      runPlan,
      runBuild: vi.fn().mockResolvedValue({ kind: 'ok', testSummary: 'ok' }),
      isApprovalRequired: () => false,
      emitEvent: vi.fn(),
      captureSnapshot: vi.fn(),
      log: vi.fn(),
    })

    await daemon.tick()

    // Should have 2 cycles: first failed, second succeeded
    const cycles = cycleStore.listForWorkItem(item.id)
    expect(cycles).toHaveLength(2)
    expect(cycles[0].outcome).toBe('revised')
    expect(cycles[0].failureKind).toBe('parse')
    expect(cycles[1].outcome).toBe('built')
    expect(cycles[1].iteration).toBe(2)
  })

  it('hard fail pauses the work item', async () => {
    const item = workStore.insert({
      source: 'ui',
      title: 'Broken env',
      body: '',
      targetHints: [],
    })

    const daemon = new ArchitectDaemon({
      workStore,
      cycleStore,
      runPlan: vi.fn().mockResolvedValue({
        kind: 'hard_fail',
        failureKind: 'env_llm',
        message: 'Ollama not running',
      }),
      runBuild: vi.fn(),
      isApprovalRequired: () => false,
      log: vi.fn(),
    })

    await daemon.tick()

    const updated = workStore.getById(item.id)!
    expect(updated.status).toBe('error')
    expect(updated.pausedReason).toContain('Ollama not running')
  })
})
