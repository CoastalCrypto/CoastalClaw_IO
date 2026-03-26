import { describe, it, expect } from 'vitest'
import type { ToolDefinition, ToolCall, ToolResult, AgentConfig, GateDecision } from '../types.js'

describe('agent types', () => {
  it('ToolDefinition has required shape', () => {
    const t: ToolDefinition = {
      name: 'read_file',
      description: 'Read a file',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path' } },
        required: ['path'],
      },
      reversible: true,
    }
    expect(t.name).toBe('read_file')
    expect(t.reversible).toBe(true)
  })

  it('AgentConfig has required shape', () => {
    const a: AgentConfig = {
      id: 'cto',
      name: 'Chief Technology Officer',
      role: 'Engineering',
      soulPath: '/data/souls/SOUL_CTO.md',
      tools: ['read_file', 'run_command'],
      builtIn: true,
      active: true,
      createdAt: Date.now(),
    }
    expect(a.builtIn).toBe(true)
    expect(a.tools).toContain('read_file')
  })

  it('GateDecision is a valid union string', () => {
    const d: GateDecision = 'allow'
    expect(['allow','block','queued','approved','denied','timeout']).toContain(d)
  })
})
