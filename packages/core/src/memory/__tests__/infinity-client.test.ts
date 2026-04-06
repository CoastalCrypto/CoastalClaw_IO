import { describe, it, expect, vi } from 'vitest'
import { InfinityClient } from '../infinity-client.js'

const MOCK_RESULTS = [
  { id: 'doc1', text: 'hello world', score: 0.95, meta: {} },
]

describe('InfinityClient', () => {
  it('isAvailable returns false when unreachable', async () => {
    const client = new InfinityClient('http://127.0.0.1:19997')
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect(await new InfinityClient().isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('upsert posts to correct endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)
    const client = new InfinityClient()
    await client.upsert('memories', 'id1', 'test text', [0.1, 0.2], { sessionId: 'abc' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/memories/upsert'),
      expect.objectContaining({ method: 'POST' })
    )
    vi.unstubAllGlobals()
  })

  it('hybridSearch returns ranked results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: MOCK_RESULTS }),
    }))
    const client = new InfinityClient()
    const results = await client.hybridSearch('memories', 'hello', [0.1, 0.2], 5)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('doc1')
    vi.unstubAllGlobals()
  })

  it('hybridSearch throws on error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'internal error',
    }))
    await expect(new InfinityClient().hybridSearch('memories', 'q', [], 5))
      .rejects.toThrow('Infinity error 500')
    vi.unstubAllGlobals()
  })
})
