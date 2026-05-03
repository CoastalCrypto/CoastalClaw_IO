import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import { architectControlRoutes } from '../architect-controls.js'

let app: FastifyInstance
let tempDir: string

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'arch-controls-route-'))
  app = Fastify({ logger: false })
  await app.register(architectControlRoutes, { dataDir: tempDir })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('GET /api/admin/architect/status', () => {
  it('returns power:off when no pid file exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/status' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.power).toBe('off')
    expect(body.mode).toBe('hands-on')
  })

  it('returns power:on when pid file exists', async () => {
    writeFileSync(join(tempDir, '.architect-pid'), '12345')
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/status' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.power).toBe('on')
  })

  it('returns default mode when no mode file exists', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/status' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.mode).toBe('hands-on')
  })
})

describe('POST /api/admin/architect/mode', () => {
  it('writes mode to file and returns ok:true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/mode',
      payload: { mode: 'autopilot' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true, mode: 'autopilot' })
  })

  it('reflects the mode after POST', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/admin/architect/mode',
      payload: { mode: 'hands-off' },
    })
    const res = await app.inject({ method: 'GET', url: '/api/admin/architect/status' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.mode).toBe('hands-off')
  })

  it('rejects invalid mode values', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/mode',
      payload: { mode: 'invalid-mode' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('accepts all valid mode values', async () => {
    const modes = ['hands-on', 'hands-off', 'autopilot', 'custom']
    for (const mode of modes) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/architect/mode',
        payload: { mode },
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.mode).toBe(mode)
    }
  })
})

describe('POST /api/admin/architect/power', () => {
  it('returns ok:true with power state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/power',
      payload: { state: 'on' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ ok: true, power: 'on' })
  })

  it('creates shutdown signal file when power is off and pid exists', async () => {
    writeFileSync(join(tempDir, '.architect-pid'), '12345')
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/power',
      payload: { state: 'off' },
    })
    expect(res.statusCode).toBe(200)
    // Check that shutdown signal file was created
    const shutdownFile = join(tempDir, '.architect-shutdown')
    expect(require('node:fs').existsSync(shutdownFile)).toBe(true)
  })

  it('does not create shutdown signal when power off but no pid file', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/power',
      payload: { state: 'off' },
    })
    expect(res.statusCode).toBe(200)
    // Shutdown file should not be created when pid doesn't exist
    const shutdownFile = join(tempDir, '.architect-shutdown')
    expect(require('node:fs').existsSync(shutdownFile)).toBe(false)
  })

  it('rejects invalid state values', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/power',
      payload: { state: 'invalid' },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/admin/architect/run-now', () => {
  it('creates run-now signal file and returns ok:true', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/run-now',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.ok).toBe(true)
    expect(body.message).toBe('Tick requested')
    // Check that run-now signal file was created
    const runNowFile = join(tempDir, '.architect-run-now')
    expect(require('node:fs').existsSync(runNowFile)).toBe(true)
  })
})
