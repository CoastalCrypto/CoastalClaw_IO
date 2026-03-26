import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AgenticLoop } from '../loop.js'
import type { AgentSession } from '../session.js'
import type { ToolRegistry } from '../../tools/registry.js'
import type { PermissionGate } from '../permission-gate.js'
import type { ActionLog } from '../action-log.js'

const mockSession = (tools: string[] = ['read_file']) => ({
  agent: { id: 'cto', tools, builtIn: true, active: true, createdAt: 0, name: 'CTO', role: 'Eng', soulPath: '' },
  systemPrompt: '# CTO',
  toolSchemas: [],
  buildMessages: (msg: string, hist: any[]) => [{ role: 'system', content: '# CTO' }, ...hist, { role: 'user', content: msg }],
  recordAction: vi.fn(),
  actionSummary: () => '',
  invalidateSoulCache: vi.fn(),
}) as unknown as AgentSession

const mockRegistry = (executor?: (name: string, args: any) => Promise<string>) => ({
  get: vi.fn(),
  isReversible: (name: string) => name === 'read_file',
  execute: executor ?? (async () => 'file contents'),
  getDefinition: vi.fn(),
  getDefinitionsFor: () => [],
}) as unknown as ToolRegistry

const mockGate = (decision = 'allow') => ({
  evaluate: vi.fn().mockReturnValue(decision),
  setAlwaysAllow: vi.fn(),
  createPendingApproval: vi.fn().mockReturnValue({
    approvalId: 'test-id',
    promise: Promise.resolve('approved'),
  }),
  resolveApproval: vi.fn(),
}) as unknown as PermissionGate

const mockLog = () => ({
  record: vi.fn(),
  getForSession: vi.fn().mockReturnValue([]),
}) as unknown as ActionLog

describe('AgenticLoop', () => {
  it('returns reply when no tool calls', async () => {
    const ollama = { chatWithTools: vi.fn().mockResolvedValue({ content: 'hello', toolCalls: [] }) } as any
    const loop = new AgenticLoop(ollama, mockRegistry(), mockGate(), mockLog())
    const result = await loop.run(mockSession(), 'hi', 'sess-1', [])
    expect(result.reply).toBe('hello')
    expect(result.actions).toHaveLength(0)
  })

  it('executes one tool call and loops', async () => {
    const ollama = {
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'tc1', name: 'read_file', args: { path: '/x' } }] })
        .mockResolvedValueOnce({ content: 'done', toolCalls: [] }),
    } as any
    const loop = new AgenticLoop(ollama, mockRegistry(), mockGate('allow'), mockLog())
    const result = await loop.run(mockSession(['read_file']), 'check file', 'sess-1', [])
    expect(result.reply).toBe('done')
    expect(ollama.chatWithTools).toHaveBeenCalledTimes(2)
  })

  it('stops at CC_AGENT_MAX_TURNS', async () => {
    process.env.CC_AGENT_MAX_TURNS = '2'
    const ollama = {
      chatWithTools: vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'tc1', name: 'read_file', args: {} }],
      }),
    } as any
    const loop = new AgenticLoop(ollama, mockRegistry(), mockGate('allow'), mockLog())
    const result = await loop.run(mockSession(['read_file']), 'loop', 'sess-1', [])
    expect(result.reply).toContain('maximum turns')
    delete process.env.CC_AGENT_MAX_TURNS
  })

  it('returns BLOCK result to LLM without executing', async () => {
    const executor = vi.fn()
    const ollama = {
      chatWithTools: vi.fn()
        .mockResolvedValueOnce({ content: '', toolCalls: [{ id: 'tc1', name: 'forbidden_tool', args: {} }] })
        .mockResolvedValueOnce({ content: 'understood', toolCalls: [] }),
    } as any
    const registry = mockRegistry(executor as any)
    const loop = new AgenticLoop(ollama, registry, mockGate('block'), mockLog())
    const result = await loop.run(mockSession([]), 'try forbidden', 'sess-1', [])
    expect(executor).not.toHaveBeenCalled()
    expect(result.reply).toBe('understood')
  })
})
