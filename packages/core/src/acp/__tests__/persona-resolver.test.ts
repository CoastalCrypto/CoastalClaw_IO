import { describe, it, expect } from 'vitest'
import { classifyPrompt, readEnvPin, resolveDomain } from '../persona-resolver.js'

describe('classifyPrompt', () => {
  it('routes finance keywords to cfo', () => {
    expect(classifyPrompt('whats our cash runway and forecast')).toBe('cfo')
    expect(classifyPrompt('audit the latest invoice')).toBe('cfo')
  })

  it('routes engineering keywords to cto', () => {
    expect(classifyPrompt('refactor the API and add tests')).toBe('cto')
    expect(classifyPrompt('debug this docker build')).toBe('cto')
  })

  it('routes operations keywords to coo', () => {
    expect(classifyPrompt('schedule a hiring meeting with the team')).toBe('coo')
    expect(classifyPrompt('our onboarding workflow needs work')).toBe('coo')
  })

  it('falls back to general for ambiguous prompts', () => {
    expect(classifyPrompt('hello there')).toBe('general')
    expect(classifyPrompt('what is the meaning of life')).toBe('general')
  })

  it('prefers cfo over cto when both keywords present', () => {
    expect(classifyPrompt('audit our cloud spend')).toBe('cfo')
  })
})

describe('readEnvPin', () => {
  it('returns null when unset', () => {
    expect(readEnvPin({})).toBeNull()
  })

  it('accepts valid domain values case-insensitively', () => {
    expect(readEnvPin({ COASTAL_ACP_PERSONA: 'CFO' })).toBe('cfo')
    expect(readEnvPin({ COASTAL_ACP_PERSONA: '  cto  ' })).toBe('cto')
  })

  it('rejects invalid values', () => {
    expect(readEnvPin({ COASTAL_ACP_PERSONA: 'ceo' })).toBeNull()
    expect(readEnvPin({ COASTAL_ACP_PERSONA: '' })).toBeNull()
  })
})

describe('resolveDomain', () => {
  it('env pin overrides classification', () => {
    expect(resolveDomain('refactor this code', { COASTAL_ACP_PERSONA: 'cfo' })).toBe('cfo')
  })

  it('falls through to classification when no pin', () => {
    expect(resolveDomain('refactor this code', {})).toBe('cto')
  })

  it('returns general when no pin and no keyword match', () => {
    expect(resolveDomain('hi', {})).toBe('general')
  })
})
