import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '../../../architect/db.js'
import { WorkItemStore } from '../../../architect/store.js'
import { CycleStore } from '../../../architect/cycle-store.js'
import { architectCycleRoutes } from '../architect-cycles.js'

let app: FastifyInstance
let db: Database.Database
let tempDir: string
let workStore: WorkItemStore
let cycleStore: CycleStore

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-cycle-route-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  workStore = new WorkItemStore(db)
  cycleStore = new CycleStore(db)
  app = Fastify({ logger: false })
  await app.register(architectCycleRoutes, { cycleStore, workStore })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  // Close db before rmSync to avoid Windows EPERM on SQLite files.
  if (db && db.open) db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('GET /api/admin/architect/activity', () => {
  it('returns empty array when no cycles exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/activity' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('returns cycles after creating one', async () => {
    const item = workStore.insert({ source: 'ui', title: 'test item', body: '', targetHints: [] })
    cycleStore.start(item.id)
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/activity' })
    expect(res.statusCode).toBe(200)
    const cycles = JSON.parse(res.body)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].workItemId).toBe(item.id)
    expect(cycles[0].stage).toBe('planning')
  })

  it('filters by stage via ?status= query param', async () => {
    const item = workStore.insert({ source: 'ui', title: 'filter test', body: '', targetHints: [] })
    const cycle = cycleStore.start(item.id)
    cycleStore.terminate(cycle.id, { outcome: 'merged' })
    cycleStore.start(item.id) // second cycle, still in planning

    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/activity?status=done' })
    expect(res.statusCode).toBe(200)
    const cycles = JSON.parse(res.body)
    expect(cycles).toHaveLength(1)
    expect(cycles[0].stage).toBe('done')
  })

  it('returns all cycles when ?status=all', async () => {
    const item = workStore.insert({ source: 'ui', title: 'all test', body: '', targetHints: [] })
    const c1 = cycleStore.start(item.id)
    cycleStore.terminate(c1.id, { outcome: 'merged' })
    cycleStore.start(item.id)
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/activity?status=all' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toHaveLength(2)
  })
})

describe('GET /api/admin/architect/cycles/:id', () => {
  it('returns 404 for nonexistent cycle id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/cycles/01ABCDEFGHJKMNPQRSTVWXYZ00',
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).error).toBe('not_found')
  })

  it('returns the full cycle by id', async () => {
    const item = workStore.insert({ source: 'ui', title: 'get by id', body: '', targetHints: [] })
    const cycle = cycleStore.start(item.id)
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/architect/cycles/${cycle.id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.id).toBe(cycle.id)
    expect(body.workItemId).toBe(item.id)
  })
})

describe('POST /api/admin/architect/cycles/:id/approval', () => {
  it('records approval and returns { ok: true }', async () => {
    const item = workStore.insert({ source: 'ui', title: 'approve me', body: '', targetHints: [] })
    const cycle = cycleStore.start(item.id)
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/architect/cycles/${cycle.id}/approval`,
      payload: { gate: 'plan', decision: 'approved', comment: 'looks good' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })

  it('returns 404 when cycle does not exist', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/cycles/01ABCDEFGHJKMNPQRSTVWXYZ00/approval',
      payload: { gate: 'plan', decision: 'approved' },
    })
    expect(res.statusCode).toBe(404)
    expect(JSON.parse(res.body).error).toBe('not_found')
  })

  it('returns 400 for invalid payload — bad gate value', async () => {
    const item = workStore.insert({ source: 'ui', title: 'bad gate', body: '', targetHints: [] })
    const cycle = cycleStore.start(item.id)
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/architect/cycles/${cycle.id}/approval`,
      payload: { gate: 'invalid_gate', decision: 'approved' },
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('invalid_payload')
  })

  it('returns 400 for invalid payload — missing required fields', async () => {
    const item = workStore.insert({ source: 'ui', title: 'missing fields', body: '', targetHints: [] })
    const cycle = cycleStore.start(item.id)
    const res = await app.inject({
      method: 'POST',
      url: `/api/admin/architect/cycles/${cycle.id}/approval`,
      payload: { gate: 'plan' }, // missing decision
    })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBe('invalid_payload')
  })
})
