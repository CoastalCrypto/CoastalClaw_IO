import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CLI', () => {
  it('exports runCLI function', async () => {
    const { runCLI } = await import('../cli.js')
    expect(typeof runCLI).toBe('function')
  })

  it('unknown command prints help without throwing', async () => {
    const { runCLI } = await import('../cli.js')
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runCLI(['unknown-command'])
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Available commands'))
    log.mockRestore()
  })
})
