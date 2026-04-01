// packages/daemon/src/__tests__/scheduler.test.ts
import { describe, it, expect } from 'vitest'
import { parseCronExpression, shouldRunNow } from '../scheduler.js'

describe('parseCronExpression', () => {
  it('parses "daily at 08:00"', () => {
    const cron = parseCronExpression('daily at 08:00')
    expect(cron).toBe('0 8 * * *')
  })

  it('parses "every 2h"', () => {
    const cron = parseCronExpression('every 2h')
    expect(cron).toBe('0 */2 * * *')
  })

  it('parses "weekly on monday"', () => {
    const cron = parseCronExpression('weekly on monday')
    expect(cron).toBe('0 8 * * 1')
  })

  it('returns raw cron string unchanged', () => {
    const cron = parseCronExpression('0 9 * * 1-5')
    expect(cron).toBe('0 9 * * 1-5')
  })
})

describe('shouldRunNow', () => {
  it('returns true when cron matches current minute', () => {
    const now = new Date('2026-03-31T08:00:00')
    expect(shouldRunNow('0 8 * * *', now)).toBe(true)
  })

  it('returns false when cron does not match', () => {
    const now = new Date('2026-03-31T09:15:00')
    expect(shouldRunNow('0 8 * * *', now)).toBe(false)
  })
})
