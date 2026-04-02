// packages/architect/src/__tests__/config.test.ts
import { describe, it, expect } from 'vitest'
import { LOCKED_PATHS, SKILL_GAPS_THRESHOLD, VETO_TIMEOUT_MS, isLockedPath } from '../config.js'

describe('config', () => {
  it('marks security-critical files as locked', () => {
    expect(isLockedPath('packages/architect/src/patcher.ts')).toBe(true)
    expect(isLockedPath('packages/architect/src/validator.ts')).toBe(true)
    expect(isLockedPath('packages/core/src/agents/permission-gate.ts')).toBe(true)
    expect(isLockedPath('packages/core/src/agents/action-log.ts')).toBe(true)
    expect(isLockedPath('packages/core/src/api/routes/admin.ts')).toBe(true)
    expect(isLockedPath('packages/architect/src/index.ts')).toBe(true)
    expect(isLockedPath('packages/architect/src/config.ts')).toBe(true)
  })

  it('allows non-locked files', () => {
    expect(isLockedPath('packages/core/src/tools/registry.ts')).toBe(false)
    expect(isLockedPath('packages/daemon/src/scheduler.ts')).toBe(false)
    expect(isLockedPath('agents/cfo/SYSTEM.md')).toBe(false)
  })

  it('exports numeric constants', () => {
    expect(SKILL_GAPS_THRESHOLD).toBe(10)
    expect(VETO_TIMEOUT_MS).toBe(60_000)
  })
})
