import { describe, it, expect, vi } from 'vitest'
import { MetaAgent } from '../meta-agent.js'

const mockPlanner = { propose: vi.fn().mockResolvedValue({ diff: 'diff content', targetFile: 'src/foo.ts' }) }
const mockPatcher = { apply: vi.fn().mockResolvedValue({ branch: 'meta/fix-1', merged: true }) }
const mockValidator = { run: vi.fn().mockResolvedValue({ passed: true, summary: '10 passed' }) }

describe('MetaAgent', () => {
  it('runs improve cycle and returns MetaResult', async () => {
    const agent = new MetaAgent(mockPlanner as any, mockPatcher as any, mockValidator as any, ':memory:')
    const result = await agent.improve({ id: 'gap-1', description: 'missing retry logic', file: 'src/foo.ts' })
    expect(result.merged).toBe(true)
    expect(result.iterationId).toBeDefined()
    expect(mockPlanner.propose).toHaveBeenCalledOnce()
    expect(mockValidator.run).toHaveBeenCalledOnce()
    agent.close()
  })

  it('does not merge when tests fail', async () => {
    mockValidator.run.mockResolvedValueOnce({ passed: false, summary: '1 failed' })
    mockPatcher.apply.mockResolvedValueOnce({ branch: 'meta/fix-2', merged: false })
    const agent = new MetaAgent(mockPlanner as any, mockPatcher as any, mockValidator as any, ':memory:')
    const result = await agent.improve({ id: 'gap-2', description: 'bad gap', file: 'src/bar.ts' })
    expect(result.merged).toBe(false)
    agent.close()
  })
})
