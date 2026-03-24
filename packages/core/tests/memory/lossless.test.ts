import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LosslessAdapter } from '../../src/memory/lossless.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('LosslessAdapter', () => {
  let adapter: LosslessAdapter
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-lossless-'))
    adapter = new LosslessAdapter({ dataDir: tmpDir })
  })

  afterEach(async () => {
    await adapter.close()
    rmSync(tmpDir, { recursive: true })
  })

  it('writes and retrieves a message', async () => {
    const entry = {
      id: 'msg-1',
      sessionId: 'session-abc',
      role: 'user' as const,
      content: 'hello from the test',
      timestamp: Date.now(),
    }
    await adapter.write(entry)
    const results = await adapter.query({ sessionId: 'session-abc' })
    expect(results).toHaveLength(1)
    expect(results[0].content).toBe('hello from the test')
  })

  it('returns empty array for unknown session', async () => {
    const results = await adapter.query({ sessionId: 'nonexistent' })
    expect(results).toHaveLength(0)
  })
})
