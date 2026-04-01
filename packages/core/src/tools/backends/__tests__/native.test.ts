// packages/core/src/tools/backends/__tests__/native.test.ts
import { describe, it, expect } from 'vitest'
import { NativeBackend } from '../native.js'

const isWin = process.platform === 'win32'

describe('NativeBackend', () => {
  const backend = new NativeBackend()

  it('isAvailable returns true', async () => {
    expect(await backend.isAvailable()).toBe(true)
  })

  it('executes a simple command', async () => {
    const result = await backend.execute('echo hello', process.cwd(), 'test-session')
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('captures output for failing commands', async () => {
    // `exit 1` propagates non-zero exit through cmd.exe on Windows;
    // `sh -c "exit 1"` works on Unix.
    const cmd = isWin ? 'exit 1' : 'exit 1'
    const result = await backend.execute(cmd, process.cwd(), 'test-session')
    expect(result.exitCode).not.toBe(0)
    expect(result.timedOut).toBe(false)
  }, 15_000)

  it('times out long-running commands', async () => {
    // ping loops ~100 seconds on Windows; `sleep 10` on Unix
    const cmd = isWin ? 'ping -n 100 127.0.0.1 > nul' : 'sleep 10'
    const result = await backend.execute(cmd, process.cwd(), 'test-session', 500)
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
  }, 10_000)
})
