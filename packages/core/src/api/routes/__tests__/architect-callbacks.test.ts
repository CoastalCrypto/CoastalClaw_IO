import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openArchitectDb } from '../../../architect/db.js'
import { CycleStore } from '../../../architect/cycle-store.js'
import { WorkItemStore } from '../../../architect/store.js'
import { architectCallbackRoutes } from '../architect-callbacks.js'
import type Database from 'better-sqlite3'

let app: ReturnType<typeof Fastify>
let architectDb: Database.Database
let cycleStore: CycleStore
let workStore: WorkItemStore
let tmpDir: string

const makeToken = (payload: object) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url')

const verifyToken = (token: string) => {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    if (decoded.cycleId && decoded.gate && decoded.decision) return decoded
    return null
  } catch {
    return null
  }
}

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-callbacks-test-'))
  architectDb = openArchitectDb(join(tmpDir, 'architect.db'))
  cycleStore = new CycleStore(architectDb)
  workStore = new WorkItemStore(architectDb)

  // maxParamLength raised to 500 to support long base64url callback tokens.
  app = Fastify({ logger: false, maxParamLength: 500 })
  await app.register(architectCallbackRoutes, { cycleStore, verifyToken })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  architectDb.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('POST /api/admin/architect/callbacks/:token', () => {
  it('valid token returns ok and decision', async () => {
    const workItem = workStore.insert({ source: 'ui', title: 'CB Test', body: 'body' })
    const cycle = cycleStore.start(workItem.id)
    const token = makeToken({ cycleId: cycle.id, gate: 'plan', decision: 'approved', expiresAt: Date.now() + 60_000 })

    const res = await app.inject({ method: 'POST', url: `/api/admin/architect/callbacks/${token}` })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.decision).toBe('approved')
  })

  it('invalid token returns 410', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/admin/architect/callbacks/not-valid-base64url!!!' })

    expect(res.statusCode).toBe(410)
    const body = res.json()
    expect(body.error).toBe('expired_or_invalid')
  })

  it('token missing required fields returns 410', async () => {
    const token = makeToken({ cycleId: 'x' }) // missing gate + decision
    const res = await app.inject({ method: 'POST', url: `/api/admin/architect/callbacks/${token}` })

    expect(res.statusCode).toBe(410)
  })
})

describe('GET /api/admin/architect/callbacks/:token', () => {
  it('valid token returns HTML with decision', async () => {
    const workItem = workStore.insert({ source: 'ui', title: 'CB GET Test', body: 'body' })
    const cycle = cycleStore.start(workItem.id)
    const token = makeToken({ cycleId: cycle.id, gate: 'plan', decision: 'rejected', expiresAt: Date.now() + 60_000 })

    const res = await app.inject({ method: 'GET', url: `/api/admin/architect/callbacks/${token}` })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('rejected')
    expect(res.body).toContain('Back to dashboard')
  })

  it('invalid token returns 410 HTML', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/callbacks/garbage' })

    expect(res.statusCode).toBe(410)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('Link Expired')
  })
})
