import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { openArchitectDb } from '../../../architect/db.js'
import { WorkItemStore } from '../../../architect/store.js'
import { CycleStore } from '../../../architect/cycle-store.js'
import { architectInsightRoutes } from '../architect-insights.js'

let app: ReturnType<typeof Fastify>
let architectDb: Database.Database
let workStore: WorkItemStore
let cycleStore: CycleStore
let tmpDir: string

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-insights-test-'))
  architectDb = openArchitectDb(join(tmpDir, 'architect.db'))
  workStore = new WorkItemStore(architectDb)
  cycleStore = new CycleStore(architectDb)

  app = Fastify({ logger: false })
  await app.register(architectInsightRoutes, { cycleStore, workStore })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  architectDb.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/admin/architect/insights', () => {
  it('returns zeroed insights when no cycles exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/insights',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.successRate).toBe(0)
    expect(body.avgIterations).toBe(0)
    expect(body.totalDurationMs).toBe(0)
    expect(body.topFailureKind).toBeNull()
    expect(body.openQueueDepth).toBe(0)
    expect(body.errorCount).toBe(0)
  })

  it('returns correct successRate after inserting cycles', async () => {
    // Insert a work item
    const workItem = workStore.insert({
      source: 'ui',
      title: 'Test Task',
      body: 'Test body',
    })

    // Start two cycles
    const cycle1 = cycleStore.start(workItem.id)
    const cycle2 = cycleStore.start(workItem.id)

    // Terminate one as merged, one as failed
    cycleStore.terminate(cycle1.id, { outcome: 'merged', durationMs: 5000 })
    cycleStore.terminate(cycle2.id, { outcome: 'failed', failureKind: 'test' })

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/insights',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.successRate).toBe(0.5) // 1 merged out of 2 total
    expect(body.totalDurationMs).toBe(5000)
    expect(body.topFailureKind).toBe('test')
  })

  it('respects range parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/insights?range=1',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('successRate')
  })
})
