import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Mem0Adapter } from '../../src/memory/mem0.js'

// Mock the mem0ai SDK to avoid needing a real API key in tests
vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ results: [{ id: 'mem-1' }] }),
    search: vi.fn().mockResolvedValue([
      { id: 'mem-1', memory: 'user prefers dark mode', score: 0.9 }
    ]),
  })),
}))

describe('Mem0Adapter', () => {
  let adapter: Mem0Adapter

  beforeEach(() => {
    adapter = new Mem0Adapter({ apiKey: 'test-key' })
  })

  it('stores a user preference', async () => {
    await expect(
      adapter.remember('user-123', 'I prefer concise responses')
    ).resolves.not.toThrow()
  })

  it('searches memory for a user', async () => {
    const results = await adapter.search('user-123', 'display preferences')
    expect(results).toHaveLength(1)
    expect(results[0].content).toContain('dark mode')
  })
})
