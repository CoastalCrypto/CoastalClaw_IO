import { describe, it, expect, vi } from 'vitest'
import { CoreClient } from './client'

globalThis.fetch = vi.fn()

describe('CoreClient', () => {
  const client = new CoreClient('http://localhost:4747')

  it('sendMessage returns reply and sessionId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ reply: 'hi there', sessionId: 'sess-123' }),
    } as Response)
    const result = await client.sendMessage({ message: 'hello' })
    expect(result.reply).toBe('hi there')
    expect(result.sessionId).toBe('sess-123')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'server error',
    } as Response)
    await expect(client.sendMessage({ message: 'hello' })).rejects.toThrow()
  })
})
