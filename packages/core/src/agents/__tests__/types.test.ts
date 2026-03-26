import { describe, it, expect } from 'vitest'
import type { ToolDefinition, ToolCall, ToolResult, AgentConfig, GateDecision, ActionSummary, LoopResult } from '../types.js'

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

  it('ActionSummary has required fields including args and output', () => {
    const action: ActionSummary = {
      tool: 'git_commit',
      args: { message: 'fix: critical bug' },
      output: 'commit abc123 created',
      decision: 'approved',
      durationMs: 245,
    }
    expect(action.tool).toBe('git_commit')
    expect(action.args).toEqual({ message: 'fix: critical bug' })
    expect(action.output).toBe('commit abc123 created')
    expect(action.decision).toBe('approved')
    expect(action.durationMs).toBe(245)
  })

  it('LoopResult has required fields including status and optional error', () => {
    const result: LoopResult = {
      reply: 'Task completed successfully',
      actions: [
        {
          tool: 'read_file',
          args: { path: '/src/index.ts' },
          output: 'file contents',
          decision: 'allow',
          durationMs: 120,
        },
      ],
      domain: 'code_review',
      status: 'complete',
    }
    expect(result.reply).toBe('Task completed successfully')
    expect(result.domain).toBe('code_review')
    expect(result.status).toBe('complete')
    expect(result.error).toBeUndefined()
    expect(result.actions).toHaveLength(1)
  })

  it('LoopResult status can be error with error message', () => {
    const result: LoopResult = {
      reply: 'Operation failed',
      actions: [],
      domain: 'deployment',
      status: 'error',
      error: 'Deploy timeout after 60s',
    }
    expect(result.status).toBe('error')
    expect(result.error).toBe('Deploy timeout after 60s')
  })
})
