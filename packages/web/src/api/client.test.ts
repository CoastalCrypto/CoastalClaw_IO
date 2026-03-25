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

describe('CoreClient admin methods', () => {
  const client = new CoreClient('http://localhost:4747', 'test-token')

  it('listModels returns grouped model array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ baseName: 'codestral:22b', variants: [] }],
    } as Response)
    const result = await client.listModels()
    expect(result).toHaveLength(1)
    expect(result[0].baseName).toBe('codestral:22b')
  })

  it('removeModel sends DELETE request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
    await client.removeModel('codestral:22b-Q4_K_M')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/models/'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('updateRegistry sends PATCH request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ ok: true }),
    } as Response)
    await client.updateRegistry({ cfo: { high: 'model-a', medium: 'model-b', low: 'model-c' } })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/registry'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('addModel sends POST request with hfModelId and quants', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ message: 'Pipeline started' }),
    } as Response)
    await client.addModel('owner/mymodel', ['Q4_K_M'], 'sess-1')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/models/add'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('owner/mymodel'),
      })
    )
  })

  it('getRegistry returns current registry assignments', async () => {
    const mockRegistry = { cfo: { high: 'model-a', medium: 'model-b', low: 'model-c' } }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => mockRegistry,
    } as Response)
    const result = await client.getRegistry()
    expect(result).toEqual(mockRegistry)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/registry'),
      expect.objectContaining({ method: 'GET' })
    )
  })
})
