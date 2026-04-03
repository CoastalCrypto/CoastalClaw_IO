// packages/core/src/api/routes/__tests__/admin.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { adminRoutes, getOrCreateAdminToken } from '../admin.js'

let app: ReturnType<typeof Fastify>
let adminToken: string
let tmpDir: string

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-admin-test-'))
  process.env.CC_DATA_DIR = tmpDir

  adminToken = getOrCreateAdminToken(tmpDir)
  process.env.CC_ADMIN_TOKEN = adminToken

  app = Fastify({ logger: false })
  await app.register(websocket)
  await app.register(adminRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
  delete process.env.CC_DATA_DIR
  delete process.env.CC_ADMIN_TOKEN
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('POST /api/admin/architect/propose', () => {
  it('stores proposal and returns proposalId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/propose',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Fix shell timeout', diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('proposalId')
    expect(typeof body.proposalId).toBe('string')
  })
})

describe('GET /api/admin/architect/proposal/:id', () => {
  it('returns pending for a fresh proposal', async () => {
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/propose',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Test', diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new' },
    })
    const { proposalId } = propRes.json()
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/architect/proposal/${proposalId}`,
      headers: { 'x-admin-token': adminToken },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('pending')
  })

  it('returns 404 for unknown proposal', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/proposal/nonexistent',
      headers: { 'x-admin-token': adminToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/admin/architect/veto', () => {
  it('marks proposal as vetoed', async () => {
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/propose',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Test', diff: '--- a/x\n+++ b/x' },
    })
    const { proposalId } = propRes.json()
    await app.inject({
      method: 'POST',
      url: '/api/admin/architect/veto',
      headers: { 'x-admin-token': adminToken },
      payload: { proposalId },
    })
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/admin/architect/proposal/${proposalId}`,
      headers: { 'x-admin-token': adminToken },
    })
    expect(statusRes.json().status).toBe('vetoed')
  })
})

describe('POST /api/admin/architect/applied', () => {
  it('returns 200 and broadcasts applied event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/applied',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Fix shell timeout', testsDelta: 'Tests  140 passed (140)' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})
