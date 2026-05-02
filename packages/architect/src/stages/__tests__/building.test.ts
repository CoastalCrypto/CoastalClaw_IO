import { describe, it, expect, vi } from 'vitest'
import { runBuildingStage } from '../building.js'

const baseDeps = {
  branchName: 'feature/architect/test-w1',
  diff: '--- a/x.ts\n+++ b/x.ts\n@@\n+x\n',
  applyDiff: vi.fn(),
  runLint: vi.fn(),
  runTypecheck: vi.fn(),
  runBuild: vi.fn(),
  runTests: vi.fn(),
}

describe('runBuildingStage', () => {
  it('returns ok when all gates pass', async () => {
    const deps = {
      ...baseDeps,
      applyDiff: vi.fn().mockResolvedValue(undefined),
      runLint: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runTypecheck: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runBuild: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runTests: vi.fn().mockResolvedValue({ ok: true, output: '4 passed' }),
    }
    const result = await runBuildingStage(deps as any)
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.testSummary).toContain('4 passed')
  })

  it('stops at apply failure with kind=apply', async () => {
    const deps = {
      ...baseDeps,
      applyDiff: vi.fn().mockRejectedValue(new Error('hunk #1 failed')),
    }
    const result = await runBuildingStage(deps as any)
    expect(result.kind).toBe('soft_fail')
    if (result.kind === 'soft_fail') expect(result.failureKind).toBe('apply')
  })

  it('stops at lint failure with kind=lint', async () => {
    const deps = {
      ...baseDeps,
      applyDiff: vi.fn().mockResolvedValue(undefined),
      runLint: vi.fn().mockResolvedValue({ ok: false, output: 'eslint error: ...' }),
    }
    const result = await runBuildingStage(deps as any)
    expect(result.kind).toBe('soft_fail')
    if (result.kind === 'soft_fail') expect(result.failureKind).toBe('lint')
  })

  it('stops at type failure with kind=type', async () => {
    const deps = {
      ...baseDeps,
      applyDiff: vi.fn().mockResolvedValue(undefined),
      runLint: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runTypecheck: vi.fn().mockResolvedValue({ ok: false, output: 'TS2304: cannot find name foo' }),
    }
    const result = await runBuildingStage(deps as any)
    expect(result.kind).toBe('soft_fail')
    if (result.kind === 'soft_fail') expect(result.failureKind).toBe('type')
  })

  it('stops at test failure with kind=test', async () => {
    const deps = {
      ...baseDeps,
      applyDiff: vi.fn().mockResolvedValue(undefined),
      runLint: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runTypecheck: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runBuild: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      runTests: vi.fn().mockResolvedValue({ ok: false, output: '1 failed' }),
    }
    const result = await runBuildingStage(deps as any)
    expect(result.kind).toBe('soft_fail')
    if (result.kind === 'soft_fail') expect(result.failureKind).toBe('test')
  })

  it('truncates failure output to 4000 chars in revise context', async () => {
    const longOutput = 'x'.repeat(10000)
    const deps = {
      ...baseDeps,
      applyDiff: vi.fn().mockResolvedValue(undefined),
      runLint: vi.fn().mockResolvedValue({ ok: false, output: longOutput }),
    }
    const result = await runBuildingStage(deps as any)
    if (result.kind === 'soft_fail') {
      expect(result.message.length).toBeLessThanOrEqual(4000)
    }
  })
})
