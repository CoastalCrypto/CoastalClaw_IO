import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '@coastal-ai/core/architect/db'
import { WorkItemStore } from '@coastal-ai/core/architect/store'
import { CycleStore } from '@coastal-ai/core/architect/cycle-store'
import { SuppressionStore } from '../suppression-store.js'
import { CurriculumScanner } from '../scanner.js'
import type { HarvestedSignals } from '../signals.js'

let tempDir: string
let db: Database.Database
let workStore: WorkItemStore
let cycleStore: CycleStore
let suppressions: SuppressionStore

const testSignals: HarvestedSignals = {
  staleTodos: [
    { file: 'src/foo.ts', line: 10, text: 'TODO: fix retry logic' },
  ],
  churnHotspots: [
    { file: 'src/bar.ts', changes: 5 },
  ],
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-scanner-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  workStore = new WorkItemStore(db)
  cycleStore = new CycleStore(db)
  suppressions = new SuppressionStore(db)
})

afterEach(() => {
  if (db && db.open) db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

function makeScanner(overrides: Partial<{
  callLLM: (prompt: string) => Promise<{ text: string; modelId: string }>
  isLockedPath: (path: string) => string | null
  repoRoot: string
}> = {}) {
  return new CurriculumScanner({
    workStore,
    cycleStore,
    suppressions,
    repoRoot: overrides.repoRoot ?? tempDir,
    callLLM: overrides.callLLM ?? vi.fn().mockResolvedValue({
      text: '[]',
      modelId: 'test-model',
    }),
    harvestSignals: () => testSignals,
    isLockedPath: overrides.isLockedPath ?? (() => null),
    dailyBudget: 5,
  })
}

describe('CurriculumScanner', () => {
  it('inserts valid proposals as work items with source=curriculum, policy=full, priority=low', async () => {
    // Create a real file the proposal targets
    writeFileSync(join(tempDir, 'target.ts'), '// stub')

    const callLLM = vi.fn().mockResolvedValue({
      text: JSON.stringify([
        {
          title: 'Fix retry logic in target',
          targetHints: ['target.ts'],
          budgetLoc: 50,
        },
      ]),
      modelId: 'claude-3-5',
    })

    const scanner = makeScanner({ callLLM, repoRoot: tempDir })
    const result = await scanner.scan()

    expect(result.proposalsInserted).toBe(1)
    expect(result.proposalsRejected).toBe(0)
    expect(result.modelUsed).toBe('claude-3-5')
    expect(result.signalsSummarized).toBe(2) // 1 todo + 1 churn

    const items = workStore.listPending()
    expect(items).toHaveLength(1)
    expect(items[0].source).toBe('curriculum')
    expect(items[0].approvalPolicy).toBe('full')
    expect(items[0].priority).toBe('low')
    expect(items[0].title).toBe('Fix retry logic in target')
    expect(items[0].targetHints).toEqual(['target.ts'])
    expect(items[0].budgetLoc).toBe(50)
  })

  it('rejects proposals for locked paths', async () => {
    writeFileSync(join(tempDir, 'locked-file.ts'), '// locked')

    const callLLM = vi.fn().mockResolvedValue({
      text: JSON.stringify([
        {
          title: 'Modify locked file',
          targetHints: ['locked-file.ts'],
          budgetLoc: 30,
        },
        {
          title: 'Another locked file change',
          targetHints: ['secrets/config.ts'],
          budgetLoc: 20,
        },
      ]),
      modelId: 'test-model',
    })

    const isLockedPath = (path: string) =>
      path.includes('locked') || path.includes('secrets') ? `locked: ${path}` : null

    const scanner = makeScanner({ callLLM, isLockedPath, repoRoot: tempDir })
    const result = await scanner.scan()

    expect(result.proposalsInserted).toBe(0)
    expect(result.proposalsRejected).toBe(2)
    expect(workStore.listPending()).toHaveLength(0)
  })

  it('skips suppressed proposals', async () => {
    writeFileSync(join(tempDir, 'some-file.ts'), '// target')

    const title = 'Refactor some-file module'
    const targetHints = ['some-file.ts']

    // Pre-suppress the signature matching this proposal
    const sig = SuppressionStore.buildSignature(title, targetHints)
    suppressions.suppress(sig, 'vetoed')

    const callLLM = vi.fn().mockResolvedValue({
      text: JSON.stringify([
        { title, targetHints, budgetLoc: 60 },
      ]),
      modelId: 'test-model',
    })

    const scanner = makeScanner({ callLLM, repoRoot: tempDir })
    const result = await scanner.scan()

    expect(result.proposalsInserted).toBe(0)
    expect(result.proposalsRejected).toBe(1)
    expect(workStore.listPending()).toHaveLength(0)
  })

  it('records a curriculum_scan cycle', async () => {
    writeFileSync(join(tempDir, 'cycle-target.ts'), '// target')

    const callLLM = vi.fn().mockResolvedValue({
      text: JSON.stringify([
        {
          title: 'Improve cycle target',
          targetHints: ['cycle-target.ts'],
          budgetLoc: 40,
        },
      ]),
      modelId: 'scan-model',
    })

    const scanner = makeScanner({ callLLM, repoRoot: tempDir })
    await scanner.scan()

    // Find the cycle that was created
    const allCycles = db.prepare('SELECT * FROM cycles WHERE kind = ?').all('curriculum_scan') as Array<{
      id: string
      work_item_id: string | null
      kind: string
      stage: string
      outcome: string
      model_used: string
    }>

    expect(allCycles).toHaveLength(1)
    const cycle = allCycles[0]
    expect(cycle.kind).toBe('curriculum_scan')
    expect(cycle.work_item_id).toBeNull()
    expect(cycle.stage).toBe('done')
    expect(cycle.outcome).toBe('merged') // inserted >= 1
    expect(cycle.model_used).toBe('scan-model')
  })
})
