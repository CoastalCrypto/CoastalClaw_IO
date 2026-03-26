import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AgentRegistry } from '../registry.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let tmpDir: string
let registry: AgentRegistry

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'cc-agents-'))
  registry = new AgentRegistry(join(tmpDir, 'test.db'))
})

afterEach(() => {
  registry.close()
  rmSync(tmpDir, { recursive: true })
})

describe('AgentRegistry', () => {
  it('seeds four built-in agents on init', () => {
    const agents = registry.list()
    expect(agents).toHaveLength(4)
    const ids = agents.map(a => a.id)
    expect(ids).toContain('coo')
    expect(ids).toContain('cfo')
    expect(ids).toContain('cto')
    expect(ids).toContain('general')
  })

  it('get returns agent by id', () => {
    const cto = registry.get('cto')
    expect(cto).not.toBeNull()
    expect(cto!.name).toBe('Chief Technology Officer')
    expect(cto!.builtIn).toBe(true)
  })

  it('create adds a custom agent', () => {
    const id = registry.create({
      name: 'Legal Officer',
      role: 'Legal',
      soulPath: '/data/souls/legal.md',
      tools: ['read_file'],
    })
    expect(id).toBeTruthy()
    const agent = registry.get(id)
    expect(agent!.name).toBe('Legal Officer')
    expect(agent!.builtIn).toBe(false)
  })

  it('update changes agent fields', () => {
    const id = registry.create({ name: 'X', role: 'Y', soulPath: '/p', tools: [] })
    registry.update(id, { name: 'Z' })
    expect(registry.get(id)!.name).toBe('Z')
  })

  it('delete removes custom agent', () => {
    const id = registry.create({ name: 'X', role: 'Y', soulPath: '/p', tools: [] })
    registry.delete(id)
    expect(registry.get(id)).toBeNull()
  })

  it('delete throws on built-in agent', () => {
    expect(() => registry.delete('cto')).toThrow('Cannot delete built-in agent')
  })

  it('getByDomain returns matching agent or general fallback', () => {
    const agent = registry.getByDomain('cto')
    expect(agent!.id).toBe('cto')
    const fallback = registry.getByDomain('unknown-domain')
    expect(fallback!.id).toBe('general')
  })
})
