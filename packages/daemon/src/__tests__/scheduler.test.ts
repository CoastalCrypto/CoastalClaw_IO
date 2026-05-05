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

  it('matches step patterns (*/5)', () => {
    const now = new Date('2026-03-31T08:15:00')
    expect(shouldRunNow('*/5 * * * *', now)).toBe(true) // 15 % 5 === 0
    expect(shouldRunNow('*/7 * * * *', now)).toBe(false) // 15 % 7 !== 0
  })

  it('matches day-of-week', () => {
    // 2026-03-31 is a Tuesday (day 2)
    const now = new Date('2026-03-31T08:00:00')
    expect(shouldRunNow('0 8 * * 2', now)).toBe(true)
    expect(shouldRunNow('0 8 * * 5', now)).toBe(false)
  })

  it('rejects invalid cron (wrong number of parts)', () => {
    expect(shouldRunNow('0 8', new Date())).toBe(false)
  })
})

describe('parseCronExpression edge cases', () => {
  it('parses "every 30m"', () => {
    expect(parseCronExpression('every 30m')).toBe('*/30 * * * *')
  })

  it('defaults unknown format to hourly', () => {
    expect(parseCronExpression('whenever')).toBe('0 * * * *')
  })
})
