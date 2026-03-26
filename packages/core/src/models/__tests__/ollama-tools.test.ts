import { describe, it, expect, vi } from 'vitest'
import { OllamaClient } from '../ollama.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('OllamaClient.chatWithTools', () => {
  const client = new OllamaClient({ baseUrl: 'http://localhost:11434' })

  it('returns text reply when no tool calls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: 'hello', tool_calls: [] } }),
    })
    const result = await client.chatWithTools('llama3.1', [], [])
    expect(result.content).toBe('hello')
    expect(result.toolCalls).toHaveLength(0)
  })

  it('returns tool calls when model requests them', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ function: { name: 'read_file', arguments: { path: '/tmp/x' } } }],
        },
      }),
    })
    const result = await client.chatWithTools('llama3.1', [], [])
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].name).toBe('read_file')
    expect(result.toolCalls[0].args).toEqual({ path: '/tmp/x' })
    expect(result.toolCalls[0].id).toBeTruthy()  // id is generated if missing
  })
})
