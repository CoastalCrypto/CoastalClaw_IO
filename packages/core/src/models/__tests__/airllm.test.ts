import { describe, it, expect, vi } from 'vitest'
import { AirLLMClient } from '../airllm.js'

describe('AirLLMClient', () => {
  it('isAvailable returns false when endpoint unreachable', async () => {
    const client = new AirLLMClient('http://127.0.0.1:19998')
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health endpoint 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const client = new AirLLMClient('http://localhost:8002')
    expect(await client.isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('chat sends OpenAI format and returns content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello from airllm' } }] }),
    }))
    const client = new AirLLMClient('http://localhost:8002')
    const result = await client.chat('llama3:70b', [{ role: 'user', content: 'hi' }])
    expect(result).toBe('hello from airllm')
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.model).toBe('llama3:70b')
    vi.unstubAllGlobals()
  })

  it('chat throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'model loading',
    }))
    const client = new AirLLMClient('http://localhost:8002')
    await expect(client.chat('llama3:70b', [])).rejects.toThrow('AirLLM error 503')
    vi.unstubAllGlobals()
  })
})
