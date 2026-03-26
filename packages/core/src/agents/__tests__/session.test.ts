import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AgentSession } from '../session.js'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ToolDefinition, AgentConfig } from '../types.js'

let tmpDir: string

beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'cc-session-')) })
afterEach(() => rmSync(tmpDir, { recursive: true }))

const mockTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read a file',
  parameters: { type: 'object', properties: { path: { type: 'string', description: 'path' } }, required: ['path'] },
  reversible: true,
}

const makeAgent = (soulPath: string): AgentConfig => ({
  id: 'cto',
  name: 'CTO',
  role: 'Engineering',
  soulPath,
  tools: ['read_file'],
  builtIn: true,
  active: true,
  createdAt: Date.now(),
})

describe('AgentSession', () => {
  it('builds system prompt with soul + tool descriptions', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# CTO\nYou are the CTO.')
    const agent = makeAgent(soulPath)
    const session = new AgentSession(agent, [mockTool])
    const prompt = session.systemPrompt
    expect(prompt).toContain('You are the CTO.')
    expect(prompt).toContain('read_file')
    expect(prompt).toContain('Read a file')
  })

  it('toolSchemas returns Ollama-format tool objects', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# test')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    const schemas = session.toolSchemas
    expect(schemas).toHaveLength(1)
    expect(schemas[0].type).toBe('function')
    expect(schemas[0].function.name).toBe('read_file')
  })

  it('buildMessages includes system prompt as first message', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# test')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    const msgs = session.buildMessages('hello', [])
    expect(msgs[0].role).toBe('system')
    expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: 'hello' })
  })

  it('actionSummary returns compact string', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# test')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    session.recordAction({ tool: 'read_file', args: { path: '/tmp/x' }, output: 'file contents', decision: 'allow', durationMs: 12 })
    session.recordAction({ tool: 'run_command', args: { cmd: 'ls' }, output: 'dir listing', decision: 'approved', durationMs: 300 })
    expect(session.actionSummary()).toContain('read_file')
  })

  it('reloads soul from disk on next access after file changes', () => {
    const soulPath = join(tmpDir, 'SOUL.md')
    writeFileSync(soulPath, '# original')
    const session = new AgentSession(makeAgent(soulPath), [mockTool])
    expect(session.systemPrompt).toContain('original')
    writeFileSync(soulPath, '# updated')
    session.invalidateSoulCache()
    expect(session.systemPrompt).toContain('updated')
  })
})
