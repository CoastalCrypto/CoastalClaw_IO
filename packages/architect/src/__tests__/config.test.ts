// packages/architect/src/__tests__/config.test.ts
import { describe, it, expect } from 'vitest'
import { SKILL_GAPS_THRESHOLD, VETO_TIMEOUT_MS, isLockedPath } from '../config.js'

describe('config', () => {
  it('marks security-critical files as locked', () => {
    expect(isLockedPath('packages/architect/src/patcher.ts')).toBeTruthy()
    expect(isLockedPath('packages/architect/src/validator.ts')).toBeTruthy()
    expect(isLockedPath('packages/core/src/agents/permission-gate.ts')).toBeTruthy()
    expect(isLockedPath('packages/core/src/agents/action-log.ts')).toBeTruthy()
    expect(isLockedPath('packages/core/src/api/routes/admin.ts')).toBeTruthy()
    expect(isLockedPath('packages/architect/src/index.ts')).toBeTruthy()
    expect(isLockedPath('packages/architect/src/config.ts')).toBeTruthy()
  })

  it('allows non-locked files', () => {
    expect(isLockedPath('packages/core/src/tools/registry.ts')).toBeNull()
    expect(isLockedPath('packages/daemon/src/scheduler.ts')).toBeNull()
    expect(isLockedPath('agents/cfo/SYSTEM.md')).toBeNull()
  })

  it('exports numeric constants', () => {
    expect(SKILL_GAPS_THRESHOLD).toBe(10)
    expect(VETO_TIMEOUT_MS).toBe(60_000)
  })

  it('normalizes leading ./ prefix', () => {
    expect(isLockedPath('./packages/architect/src/config.ts')).toBeTruthy()
  })

  it('normalizes Windows backslashes', () => {
    expect(isLockedPath('packages\\architect\\src\\config.ts')).toBeTruthy()
  })

  it('normalizes mixed backslash and leading .\\', () => {
    expect(isLockedPath('.\\packages\\architect\\src\\config.ts')).toBeTruthy()
  })

  it('normalizes double leading ./ prefix', () => {
    expect(isLockedPath('././packages/architect/src/config.ts')).toBeTruthy()
  })
})

describe('isLockedPath — v1.5 expanded defaults', () => {
  it('blocks data/, .git/, node_modules/, .env*', () => {
    expect(isLockedPath('data/secrets.json')).toBeTruthy()
    expect(isLockedPath('.git/config')).toBeTruthy()
    expect(isLockedPath('node_modules/foo/index.js')).toBeTruthy()
    expect(isLockedPath('.env')).toBeTruthy()
    expect(isLockedPath('.env.production')).toBeTruthy()
  })

  it('blocks packaging/ and coastalos/build/', () => {
    expect(isLockedPath('packaging/deb/control')).toBeTruthy()
    expect(isLockedPath('coastalos/build/config.yaml')).toBeTruthy()
  })

  it('blocks packages/architect/** (self-modify guard)', () => {
    expect(isLockedPath('packages/architect/src/index.ts')).toBeTruthy()
  })

  it('does not block packages/core/src/**', () => {
    expect(isLockedPath('packages/core/src/x.ts')).toBeNull()
  })
})
