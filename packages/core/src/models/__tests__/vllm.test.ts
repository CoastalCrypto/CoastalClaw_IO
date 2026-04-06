// packages/core/src/models/__tests__/vllm.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VllmClient } from '../vllm.js'

describe('VllmClient', () => {
  it('isAvailable returns false when endpoint unreachable', async () => {
    const client = new VllmClient('http://127.0.0.1:19999')  // nothing there
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health endpoint responds 200', async () => {
    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const client = new VllmClient('http://localhost:8000')
    expect(await client.isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('chat sends correct OpenAI format and returns content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello from vllm' } }],
      }),
    }))
    const client = new VllmClient('http://localhost:8000')
    const result = await client.chat('llama3', [{ role: 'user', content: 'hi' }])
    expect(result).toBe('hello from vllm')

    const calls = vi.mocked(fetch).mock.calls
    const body = JSON.parse(calls[0][1]!.body as string)
    expect(body.model).toBe('llama3')
    expect(body.messages[0].role).toBe('user')
    vi.unstubAllGlobals()
  })

  it('chat throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    }))
    const client = new VllmClient('http://localhost:8000')
    await expect(client.chat('llama3', [])).rejects.toThrow('vLLM error 500')
    vi.unstubAllGlobals()
  })
})
