import { describe, it, expect, vi } from 'vitest'
import { BossAgent } from '../boss-agent.js'
import { TeamChannel } from '../team-channel.js'

const mockRouter = {
  chat: vi.fn(),
  ollama: { chat: vi.fn() },
  cascade: { route: vi.fn() },
}
const mockRegistry = {
  getByDomain: vi.fn().mockReturnValue(null),
  get: vi.fn().mockReturnValue({ id: 'general', name: 'General', tools: [], soul: '' }),
}
const mockToolRegistry = { getDefinitionsFor: vi.fn().mockReturnValue([]) }

describe('BossAgent', () => {
  it('decomposes task and returns synthesized result', async () => {
    mockRouter.chat
      .mockResolvedValueOnce({ reply: JSON.stringify([
        { id: 'sub1', description: 'step one', domain: 'general' },
      ]), decision: {} })
      .mockResolvedValueOnce({ reply: 'step one done', decision: {} })
      .mockResolvedValueOnce({ reply: 'final answer', decision: {} })

    const boss = new BossAgent(mockRouter as any, mockRegistry as any, new TeamChannel(), mockToolRegistry as any)
    const result = await boss.run('do a complex task', 'session-1')
    expect(result.reply).toBe('final answer')
    expect(result.subtaskCount).toBe(1)
  })

  it('handles decomposition returning empty subtask list', async () => {
    mockRouter.chat
      .mockResolvedValueOnce({ reply: '[]', decision: {} })
      .mockResolvedValueOnce({ reply: 'direct answer', decision: {} })

    const boss = new BossAgent(mockRouter as any, mockRegistry as any, new TeamChannel(), mockToolRegistry as any)
    const result = await boss.run('simple task', 'session-2')
    expect(result.reply).toBeDefined()
  })
})
