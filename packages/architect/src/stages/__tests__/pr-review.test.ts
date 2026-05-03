import { describe, it, expect, vi } from 'vitest'
import { pollPRStatus, triggerAutoMerge } from '../pr-review.js'

describe('pollPRStatus', () => {
  it('returns merged when PR is merged', async () => {
    const ghView = vi.fn().mockResolvedValue({ state: 'MERGED', mergedAt: '2026-05-03T10:00:00Z' })
    const result = await pollPRStatus({ prUrl: 'https://github.com/x/pulls/1', ghView })
    expect(result).toEqual({ status: 'merged' })
  })

  it('returns closed when PR is closed without merge', async () => {
    const ghView = vi.fn().mockResolvedValue({ state: 'CLOSED', mergedAt: null })
    const result = await pollPRStatus({ prUrl: 'https://github.com/x/pulls/1', ghView })
    expect(result).toEqual({ status: 'closed' })
  })

  it('returns open when PR is still open', async () => {
    const ghView = vi.fn().mockResolvedValue({ state: 'OPEN', mergedAt: null })
    const result = await pollPRStatus({ prUrl: 'https://github.com/x/pulls/1', ghView })
    expect(result).toEqual({ status: 'open' })
  })

  it('returns error on gh failure', async () => {
    const ghView = vi.fn().mockRejectedValue(new Error('gh: not authenticated'))
    const result = await pollPRStatus({ prUrl: 'https://github.com/x/pulls/1', ghView })
    expect(result).toEqual({ status: 'error', message: 'gh: not authenticated' })
  })
})

describe('triggerAutoMerge', () => {
  it('returns ok on success', async () => {
    const ghMerge = vi.fn().mockResolvedValue(undefined)
    const result = await triggerAutoMerge({ prUrl: 'url', ghMerge })
    expect(result.kind).toBe('ok')
  })

  it('returns error on failure', async () => {
    const ghMerge = vi.fn().mockRejectedValue(new Error('merge conflict'))
    const result = await triggerAutoMerge({ prUrl: 'url', ghMerge })
    expect(result.kind).toBe('error')
  })
})
