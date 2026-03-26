// packages/core/src/tools/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest'
import { ToolRegistry } from '../registry.js'

describe('ToolRegistry', () => {
  const registry = new ToolRegistry()

  it('resolves known core tools', () => {
    expect(registry.get('read_file')).toBeDefined()
    expect(registry.get('run_command')).toBeDefined()
    expect(registry.get('git_status')).toBeDefined()
    expect(registry.get('query_db')).toBeDefined()
    expect(registry.get('http_get')).toBeDefined()
  })

  it('returns undefined for unknown tool', () => {
    expect(registry.get('nonexistent_tool')).toBeUndefined()
  })

  it('execute returns error string for unknown tool', async () => {
    const result = await registry.execute('nonexistent', {})
    expect(result).toContain('unknown tool')
  })

  it('getDefinitionsFor returns definitions for listed tool names', () => {
    const defs = registry.getDefinitionsFor(['read_file', 'git_status'])
    expect(defs).toHaveLength(2)
    expect(defs.map(d => d.name)).toContain('read_file')
    expect(defs.map(d => d.name)).toContain('git_status')
  })

  it('isReversible returns true for read-only tools', () => {
    expect(registry.isReversible('read_file', {})).toBe(true)
    expect(registry.isReversible('list_dir', {})).toBe(true)
    expect(registry.isReversible('git_status', {})).toBe(true)
    expect(registry.isReversible('http_get', {})).toBe(true)
  })

  it('isReversible returns false for write tools', () => {
    expect(registry.isReversible('write_file', {})).toBe(false)
    expect(registry.isReversible('run_command', {})).toBe(false)
    expect(registry.isReversible('git_commit', {})).toBe(false)
  })

  it('isReversible handles query_db by mode', () => {
    expect(registry.isReversible('query_db', { mode: 'read' })).toBe(true)
    expect(registry.isReversible('query_db', { mode: 'write' })).toBe(false)
  })
})
