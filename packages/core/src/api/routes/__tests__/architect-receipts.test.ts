import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { openArchitectDb } from '../../../architect/db.js'
import { WorkItemStore } from '../../../architect/store.js'
import { CycleStore } from '../../../architect/cycle-store.js'
import { architectReceiptRoutes } from '../architect-receipts.js'

let app: ReturnType<typeof Fastify>
let architectDb: Database.Database
let workStore: WorkItemStore
let cycleStore: CycleStore
let tmpDir: string

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-receipts-test-'))
  architectDb = openArchitectDb(join(tmpDir, 'architect.db'))
  workStore = new WorkItemStore(architectDb)
  cycleStore = new CycleStore(architectDb)

  app = Fastify({ logger: false })
  await app.register(architectReceiptRoutes, { cycleStore })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  architectDb.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/admin/architect/receipts', () => {
  it('returns empty prs array when no merged cycles exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/receipts',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.prs).toEqual([])
    expect(body.totals.prsMerged).toBe(0)
    expect(body.release).toBe('current')
  })

  it('returns merged cycles with PR URLs', async () => {
    // Insert a work item
    const workItem = workStore.insert({
      source: 'ui',
      title: 'Test Feature',
      body: 'Test body',
    })

    // Start and merge a cycle with PR
    const cycle = cycleStore.start(workItem.id)
    cycleStore.terminate(cycle.id, {
      outcome: 'merged',
      prUrl: 'https://github.com/owner/repo/pull/123',
      branchName: 'feat/test',
      planText: 'Added tests',
      testSummary: 'All tests passed',
      modelUsed: 'gpt-4',
      durationMs: 10000,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/receipts',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.prs.length).toBe(1)
    expect(body.prs[0]).toMatchObject({
      cycleId: cycle.id,
      workItemId: workItem.id,
      prUrl: 'https://github.com/owner/repo/pull/123',
      branchName: 'feat/test',
      planText: 'Added tests',
      testSummary: 'All tests passed',
      modelUsed: 'gpt-4',
      iteration: 1,
    })
    expect(body.totals.prsMerged).toBe(1)
  })

  it('respects release parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/receipts?release=v1.0.0',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.release).toBe('v1.0.0')
  })

  it('filters out merged cycles without PR URLs', async () => {
    // Insert a work item
    const workItem = workStore.insert({
      source: 'ui',
      title: 'Test Without PR',
      body: 'Test body',
    })

    // Start and merge a cycle WITHOUT PR
    const cycle = cycleStore.start(workItem.id)
    cycleStore.terminate(cycle.id, {
      outcome: 'merged',
      durationMs: 5000,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/receipts',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // Should still have 1 PR from previous test (the one WITH PR URL)
    expect(body.prs.length).toBe(1)
    expect(body.prs[0].prUrl).toBeTruthy()
  })
})
