// packages/core/src/api/routes/__tests__/architect.test.ts
//
// Per Chunk 3 Step 1 research: this codebase enforces admin auth via a
// global onRequest hook in server.ts (NOT a per-route preHandler/decorator),
// so the route plugin itself adds no auth. The tests therefore exercise the
// routes directly without needing to mock a verifyAdmin decorator. We still
// register a no-op verifyAdmin decorator to keep the surface compatible with
// the plan's stub spec.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import type Database from 'better-sqlite3'
import { openArchitectDb } from '../../../architect/db.js'
import { WorkItemStore } from '../../../architect/store.js'
import { architectRoutes } from '../architect.js'

let app: FastifyInstance
let db: Database.Database
let tempDir: string

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'architect-route-'))
  db = openArchitectDb(join(tempDir, 'architect.db'))
  const store = new WorkItemStore(db)
  app = Fastify({ logger: false })
  // No-op stub — auth is enforced at the server-level onRequest hook in
  // production (see packages/core/src/server.ts). Tests exercise routes
  // directly without that hook.
  app.decorate('verifyAdmin', async () => { /* test stub: always allow */ })
  await app.register(architectRoutes, { store })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  db.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('POST /api/admin/architect/work-items', () => {
  it('creates a work item and returns it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/work-items',
      payload: {
        title: 'Add retry',
        body: 'Wrap http_get in retry',
        targetHints: ['packages/core/src/tools/core/web.ts'],
      },
    })
    expect(res.statusCode).toBe(201)
    const json = JSON.parse(res.body)
    expect(json.id).toMatch(/^[0-9a-z]{26}$/i)
    expect(json.source).toBe('ui')
    expect(json.status).toBe('pending')
  })

  it('rejects missing title with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/work-items',
      payload: { body: 'no title' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 on dedup conflict', async () => {
    const payload = { title: 'X', body: 'b', targetHints: ['a.ts'] }
    await app.inject({ method: 'POST', url: '/api/admin/architect/work-items', payload })
    const res = await app.inject({ method: 'POST', url: '/api/admin/architect/work-items', payload })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).existingId).toMatch(/^[0-9a-z]{26}$/i)
  })
})

describe('GET /api/admin/architect/work-items', () => {
  it('lists pending work items with priority ordering', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/admin/architect/work-items',
      payload: { title: 'a', body: '', targetHints: [] },
    })
    await app.inject({
      method: 'POST',
      url: '/api/admin/architect/work-items',
      payload: { title: 'b', body: '', priority: 'high', targetHints: [] },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/work-items?status=pending',
    })
    expect(res.statusCode).toBe(200)
    const items = JSON.parse(res.body)
    expect(items.map((i: any) => i.title)).toEqual(['b', 'a'])
  })
})

describe('GET /api/admin/architect/work-items/:id', () => {
  it('returns the item by id', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/work-items',
      payload: { title: 'find me', body: '', targetHints: [] },
    })
    const { id } = JSON.parse(create.body)
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/architect/work-items/${id}`,
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).id).toBe(id)
  })

  it('returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/work-items/01ABCDEFGHJKMNPQRSTVWXYZ00',
    })
    expect(res.statusCode).toBe(404)
  })
})
