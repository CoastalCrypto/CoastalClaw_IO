import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UnifiedMemory } from '../../src/memory/index.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('mem0ai', () => ({
  MemoryClient: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({}),
    search: vi.fn().mockResolvedValue([]),
  })),
}))

describe('UnifiedMemory', () => {
  let memory: UnifiedMemory
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-unified-'))
    memory = new UnifiedMemory({ dataDir: tmpDir, mem0ApiKey: 'test' })
  })

  afterEach(async () => {
    await memory.close()
    rmSync(tmpDir, { recursive: true })
  })

  it('writes message to lossless store', async () => {
    await memory.write({
      id: 'msg-1',
      sessionId: 'sess-1',
      role: 'user',
      content: 'test message',
      timestamp: Date.now(),
    })
    const results = await memory.queryHistory({ sessionId: 'sess-1' })
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('test message')
  })
})
