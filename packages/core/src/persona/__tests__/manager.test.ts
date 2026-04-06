import { describe, it, expect } from 'vitest'
import { PersonaManager, DEFAULT_PERSONA } from '../manager.js'

describe('PersonaManager', () => {
  it('returns defaults when not configured', () => {
    const mgr = new PersonaManager(':memory:')
    const persona = mgr.get()
    expect(persona.agentName).toBe('Assistant')
    expect(persona.orgName).toBe('Your Organization')
    mgr.close()
  })

  it('isConfigured returns false until agentName is set', () => {
    const mgr = new PersonaManager(':memory:')
    expect(mgr.isConfigured()).toBe(false)
    mgr.set({ agentName: 'JARVIS' })
    expect(mgr.isConfigured()).toBe(true)
    mgr.close()
  })

  it('set persists partial updates', () => {
    const mgr = new PersonaManager(':memory:')
    mgr.set({ agentName: 'JARVIS', orgName: 'Stark Industries' })
    const persona = mgr.get()
    expect(persona.agentName).toBe('JARVIS')
    expect(persona.orgName).toBe('Stark Industries')
    expect(persona.personality).toBe(DEFAULT_PERSONA.personality)
    mgr.close()
  })

  it('set overwrites individual fields without affecting others', () => {
    const mgr = new PersonaManager(':memory:')
    mgr.set({ agentName: 'JARVIS', orgName: 'Stark Industries' })
    mgr.set({ orgName: 'Stark Enterprises' })
    const persona = mgr.get()
    expect(persona.agentName).toBe('JARVIS')
    expect(persona.orgName).toBe('Stark Enterprises')
    mgr.close()
  })

  it('interpolate replaces all persona tokens', () => {
    const persona = {
      agentName: 'JARVIS',
      agentRole: 'AI Butler',
      personality: 'Dry wit, efficient.',
      orgName: 'Stark Industries',
      orgContext: 'Builds Iron Man suits.',
      ownerName: 'Tony',
    }
    const template = '# {{persona.agentName}}\nYou are {{persona.agentRole}} for {{persona.orgName}}.\n{{persona.orgContext}}\nAddress {{persona.ownerName}} by name.'
    const result = PersonaManager.interpolate(template, persona)
    expect(result).toContain('JARVIS')
    expect(result).toContain('AI Butler')
    expect(result).toContain('Stark Industries')
    expect(result).toContain('Builds Iron Man suits.')
    expect(result).toContain('Tony')
  })

  it('interpolate uses fallback for empty ownerName and orgContext', () => {
    const persona = { ...DEFAULT_PERSONA, agentName: 'Alex' }
    const template = '{{persona.orgContext}} — {{persona.ownerName}}'
    const result = PersonaManager.interpolate(template, persona)
    expect(result).toContain('(No additional context provided.)')
    expect(result).toContain('the operator')
  })
})
