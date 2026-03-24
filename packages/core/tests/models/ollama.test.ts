import { describe, it, expect, vi } from 'vitest'
import { OllamaClient } from '../../src/models/ollama.js'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OllamaClient', () => {
  const client = new OllamaClient({ baseUrl: 'http://127.0.0.1:11434' })

  it('lists available models', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }, { name: 'mistral' }] }),
    })
    const models = await client.listModels()
    expect(models).toEqual(['llama3.2', 'mistral'])
  })

  it('sends a chat message and returns content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: { role: 'assistant', content: 'Hello from llama!' },
        done: true,
      }),
    })
    const result = await client.chat('llama3.2', [
      { role: 'user', content: 'say hello' }
    ])
    expect(result).toBe('Hello from llama!')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'error' })
    await expect(client.listModels()).rejects.toThrow('Ollama error 500')
  })
})
