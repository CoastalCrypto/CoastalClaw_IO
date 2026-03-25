import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildServer } from '../../src/server.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

vi.mock('../../src/models/quantizer.js', () => ({
  QuantizationPipeline: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('Admin API', () => {
  let server: FastifyInstance
  let tmpDir: string
  const token = 'test-admin-token'

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-admin-'))
    process.env.CC_DATA_DIR = tmpDir
    process.env.CC_ADMIN_TOKEN = token
    server = await buildServer()
    await server.listen({ port: 0 })
  })

  afterEach(async () => {
    await server.close()
    delete process.env.CC_DATA_DIR
    delete process.env.CC_ADMIN_TOKEN
    rmSync(tmpDir, { recursive: true })
  })

  it('GET /api/admin/models returns 401 without token', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/models' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/models returns 200 with valid token', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/models',
      headers: { 'x-admin-token': token },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('PATCH /api/admin/registry returns 422 for unknown model', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/admin/registry',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ cfo: { high: 'nonexistent-model', medium: 'llama3.2:3b', low: 'llama3.2:1b' } }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('POST /api/admin/models/add returns 401 without token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/models/add',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hfModelId: 'owner/repo', quants: ['Q4_K_M'], sessionId: 'sess-1' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/models/add returns 202 and starts pipeline', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/models/add',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ hfModelId: 'owner/mymodel', quants: ['Q4_K_M'], sessionId: 'sess-1' }),
    })
    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.body)).toMatchObject({ hfModelId: 'owner/mymodel' })
  })

  it('DELETE /api/admin/models/:quantId returns 401 without token', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/models/mymodel:q4_k_m',
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/admin/models/:quantId returns 204', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/models/mymodel:q4_k_m',
      headers: { 'x-admin-token': token },
    })
    expect(res.statusCode).toBe(204)
  })

  it('GET /api/admin/registry returns empty object when no registry file', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/registry',
      headers: { 'x-admin-token': token },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({})
  })

  it('PATCH /api/admin/registry returns ok:true when models are valid', async () => {
    // First register a model in the registry so isActive() returns true
    const { ModelRegistry } = await import('../../src/models/registry.js')
    const registry = new ModelRegistry(tmpDir)
    registry.register({
      id: 'llama3.2:1b',
      hfSource: 'meta/llama3.2',
      baseName: 'llama3.2',
      quantLevel: '1b',
      sizeGb: 1.0,
    })
    registry.close()

    const res = await server.inject({
      method: 'PATCH',
      url: '/api/admin/registry',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ general: { high: 'llama3.2:1b', medium: 'llama3.2:1b', low: 'llama3.2:1b' } }),
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true })
  })
})
