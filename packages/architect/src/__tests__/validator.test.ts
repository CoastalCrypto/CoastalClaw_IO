// packages/architect/src/__tests__/validator.test.ts
import { describe, it, expect } from 'vitest'
import { parseTestOutput } from '../validator.js'

describe('parseTestOutput', () => {
  it('detects passing test run', () => {
    const output = `
 ✓ packages/core (134 tests)
 ✓ packages/daemon (6 tests)

Test Files  2 passed (2)
Tests  140 passed (140)
`
    const result = parseTestOutput(output, 0)
    expect(result.passed).toBe(true)
    expect(result.summary).toContain('140')
  })

  it('detects failing test run', () => {
    const output = `
 ✗ packages/core (1 failed)

Test Files  1 failed (2)
Tests  2 failed | 138 passed (140)
`
    const result = parseTestOutput(output, 1)
    expect(result.passed).toBe(false)
    expect(result.summary).toContain('failed')
  })

  it('uses exit code as primary signal', () => {
    // Non-zero exit code = failure regardless of output
    expect(parseTestOutput('Tests  5 passed (5)', 1).passed).toBe(false)
    expect(parseTestOutput('Tests  0 passed (0)', 0).passed).toBe(true)
  })
})
