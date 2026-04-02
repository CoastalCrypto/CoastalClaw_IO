// packages/architect/src/__tests__/announcer.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitForVeto } from '../announcer.js'

describe('waitForVeto', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns proceed when no veto arrives before timeout', async () => {
    // Mock fetch: propose returns proposalId, poll always returns pending
    let callCount = 0
    vi.stubGlobal('fetch', async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/propose')) {
        return { ok: true, json: async () => ({ proposalId: 'test-id' }) }
      }
      callCount++
      return { ok: true, json: async () => ({ status: 'pending' }) }
    })
    const result = await waitForVeto({
      serverUrl: 'http://localhost:4747',
      adminToken: 'tok',
      summary: 'Fix shell tool',
      diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new',
      vetoTimeoutMs: 100,
      pollIntervalMs: 20,
    })
    expect(result).toBe('proceed')
    expect(callCount).toBeGreaterThan(0)
  })

  it('returns vetoed when server signals veto', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (typeof url === 'string' && url.includes('/propose')) {
        return { ok: true, json: async () => ({ proposalId: 'veto-id' }) }
      }
      return { ok: true, json: async () => ({ status: 'vetoed' }) }
    })
    const result = await waitForVeto({
      serverUrl: 'http://localhost:4747',
      adminToken: 'tok',
      summary: 'Fix',
      diff: '--- a/x\n+++ b/x',
      vetoTimeoutMs: 200,
      pollIntervalMs: 20,
    })
    expect(result).toBe('vetoed')
  })

  it('returns proceed when server is unreachable (fail open)', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNREFUSED') })
    const result = await waitForVeto({
      serverUrl: 'http://localhost:4747',
      adminToken: 'tok',
      summary: 'Fix',
      diff: '--- a/x\n+++ b/x',
      vetoTimeoutMs: 100,
      pollIntervalMs: 20,
    })
    expect(result).toBe('proceed')
  })
})
