import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { openArchitectDb } from '../../../architect/db.js'
import { architectSSERoutes } from '../architect-events-sse.js'

let db: Database.Database
let tmpDir: string

function insertEvent(db: Database.Database, eventType: string) {
  const id = `evt-${Math.random().toString(36).slice(2, 10)}`
  db.prepare(
    'INSERT INTO architect_events (id, event_type, work_item_id, cycle_id, payload, created_at) VALUES (?, ?, NULL, NULL, ?, ?)'
  ).run(id, eventType, '{}', Date.now())
}

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-sse-test-'))
  db = openArchitectDb(join(tmpDir, 'architect.db'))
})

afterAll(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /api/admin/architect/events (SSE)', () => {
  it('sets correct SSE headers', async () => {
    const app = Fastify({ logger: false })
    await app.register(architectSSERoutes, { db })
    await app.ready()

    const url = await app.listen({ port: 0, host: '127.0.0.1' })
    const port = (app.server.address() as any).port

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 500)

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/architect/events`, {
        signal: controller.signal,
      })
      expect(res.headers.get('content-type')).toBe('text/event-stream')
      expect(res.headers.get('cache-control')).toBe('no-cache')
    } catch (e: any) {
      if (e.name !== 'AbortError') throw e
    } finally {
      clearTimeout(timeout)
      controller.abort()
      await app.close()
    }
  })

  it('streams initial events when since=0', async () => {
    // Insert events directly
    insertEvent(db, 'plan_ok')
    insertEvent(db, 'build_ok')

    const app = Fastify({ logger: false })
    await app.register(architectSSERoutes, { db })
    await app.ready()
    const url = await app.listen({ port: 0, host: '127.0.0.1' })
    const port = (app.server.address() as any).port

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    let body = ''
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/architect/events?since=0`, {
        signal: controller.signal,
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        body += decoder.decode(value, { stream: true })
        if (body.includes('build_ok')) break
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') throw e
    } finally {
      clearTimeout(timeout)
      controller.abort()
      await app.close()
    }

    expect(body).toContain('data: ')
    expect(body).toContain('plan_ok')
    expect(body).toContain('build_ok')

    const events = body.split('\n\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.replace('data: ', '')))
    expect(events.length).toBeGreaterThanOrEqual(2)
  })

  it('filters events by since timestamp', async () => {
    const beforeTimestamp = Date.now()
    // Small delay to ensure timestamp ordering
    await new Promise(r => setTimeout(r, 10))
    insertEvent(db, 'pr_created')

    const app = Fastify({ logger: false })
    await app.register(architectSSERoutes, { db })
    await app.ready()
    const url = await app.listen({ port: 0, host: '127.0.0.1' })
    const port = (app.server.address() as any).port

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    let body = ''
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/admin/architect/events?since=${beforeTimestamp}`, {
        signal: controller.signal,
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        body += decoder.decode(value, { stream: true })
        if (body.includes('pr_created')) break
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') throw e
    } finally {
      clearTimeout(timeout)
      controller.abort()
      await app.close()
    }

    // Should only contain the new event, not the old plan_ok/build_ok
    const events = body.split('\n\n')
      .filter(line => line.startsWith('data: '))
      .map(line => JSON.parse(line.replace('data: ', '')))
    const types = events.map((e: any) => e.event_type)
    expect(types).toContain('pr_created')
    // The old events should be filtered out
    expect(types).not.toContain('plan_ok')
  })
})
