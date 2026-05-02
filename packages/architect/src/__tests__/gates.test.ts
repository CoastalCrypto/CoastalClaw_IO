import { describe, it, expect, vi } from 'vitest'
import { runLintGate, runTestGate } from '../gates.js'

describe('gates', () => {
  it('runLintGate filters by touched packages', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })
    const r = await runLintGate(['core', 'web'], { cwd: '/repo', exec: exec as any })
    expect(exec).toHaveBeenCalledWith(
      expect.stringContaining('--filter core --filter web lint'),
      expect.any(Object),
    )
    expect(r.ok).toBe(true)
  })

  it('runTestGate returns ok=false on non-zero exit', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: '', stderr: 'fail', exitCode: 1 })
    const r = await runTestGate(['core'], { cwd: '/repo', exec: exec as any })
    expect(r.ok).toBe(false)
    expect(r.output).toContain('fail')
  })

  it('runLintGate is a no-op when no packages touched', async () => {
    const exec = vi.fn()
    const r = await runLintGate([], { cwd: '/repo', exec: exec as any })
    expect(exec).not.toHaveBeenCalled()
    expect(r.ok).toBe(true)
  })
})
