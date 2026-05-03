import { describe, it, expect, vi } from 'vitest'
import { runPRCreationStage } from '../pr-creation.js'

const baseInput = {
  workItem: {
    id: 'w1', title: 'Add retry logic', body: 'b',
    source: 'ui' as const, sourceRef: null,
    approvalPolicy: 'pr-only' as const,
  } as any,
  cycle: { id: 'c1', iteration: 1 } as any,
  branchName: 'feature/architect/w1-add-retry',
  planText: 'Wrap in retry',
  diffText: '--- a/x.ts\n+++ b/x.ts\n@@\n+retry\n',
  testSummary: '4 passed',
  modelUsed: 'vllm:llama3',
  commitAndPush: vi.fn().mockResolvedValue(undefined),
  createPR: vi.fn().mockResolvedValue({ prUrl: 'https://github.com/x/pulls/1', prNumber: 1 }),
  commentOnIssue: vi.fn().mockResolvedValue(undefined),
}

describe('runPRCreationStage', () => {
  it('returns ok with prUrl on success', async () => {
    const result = await runPRCreationStage(baseInput)
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      expect(result.prUrl).toBe('https://github.com/x/pulls/1')
      expect(result.prNumber).toBe(1)
    }
  })

  it('calls commitAndPush with formatted message', async () => {
    await runPRCreationStage(baseInput)
    expect(baseInput.commitAndPush).toHaveBeenCalledWith(
      expect.stringContaining('chore(architect): Add retry logic'),
      'feature/architect/w1-add-retry',
    )
  })

  it('generates PR body with plan, test summary, and attribution', async () => {
    await runPRCreationStage(baseInput)
    const call = baseInput.createPR.mock.calls[0]
    expect(call[0]).toEqual(expect.objectContaining({
      title: '[architect] Add retry logic',
      draft: false,
    }))
    expect(call[0].body).toContain('Wrap in retry')
    expect(call[0].body).toContain('4 passed')
    expect(call[0].body).toContain('vllm:llama3')
  })

  it('opens as draft when approval_policy=full', async () => {
    const input = {
      ...baseInput,
      workItem: { ...baseInput.workItem, approvalPolicy: 'full' as const },
      createPR: vi.fn().mockResolvedValue({ prUrl: 'https://github.com/x/pulls/2', prNumber: 2 }),
    }
    await runPRCreationStage(input)
    expect(input.createPR.mock.calls[0][0].draft).toBe(true)
  })

  it('returns hard_fail with env_push on push failure', async () => {
    const input = {
      ...baseInput,
      commitAndPush: vi.fn().mockRejectedValue(new Error('network timeout')),
    }
    const result = await runPRCreationStage(input)
    expect(result.kind).toBe('hard_fail')
    if (result.kind === 'hard_fail') expect(result.failureKind).toBe('env_push')
  })

  it('returns hard_fail with env_gh on gh failure', async () => {
    const input = {
      ...baseInput,
      createPR: vi.fn().mockRejectedValue(new Error('gh: not authenticated')),
    }
    const result = await runPRCreationStage(input)
    expect(result.kind).toBe('hard_fail')
    if (result.kind === 'hard_fail') expect(result.failureKind).toBe('env_gh')
  })
})
