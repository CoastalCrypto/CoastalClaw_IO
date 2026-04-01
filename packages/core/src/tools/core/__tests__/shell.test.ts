// packages/core/src/tools/core/__tests__/shell.test.ts
import { describe, it, expect } from 'vitest'
import { createShellTools } from '../shell.js'
import type { ShellBackend } from '../../backends/types.js'

function mockBackend(stdout: string, exitCode = 0): ShellBackend {
  return {
    name: 'mock',
    isAvailable: async () => true,
    execute: async () => ({ stdout, exitCode, timedOut: false }),
  }
}

const agentWorkdir = process.cwd()

describe('run_command via ShellBackend', () => {
  it('delegates to the backend and returns stdout', async () => {
    const exec = createShellTools(mockBackend('hello\n'), agentWorkdir)[0].execute
    const result = await exec({ cmd: 'echo hello', workdir: agentWorkdir })
    expect(result).toContain('hello')
  })

  it('blocks workdir escape attempts', async () => {
    const exec = createShellTools(mockBackend(''), agentWorkdir)[0].execute
    const result = await exec({ cmd: 'ls', workdir: '/etc' })
    expect(result).toContain('Error: cwd escape')
  })

  it('returns error when backend is unavailable', async () => {
    const unavailableBackend: ShellBackend = {
      name: 'docker',
      isAvailable: async () => false,
      execute: async () => ({ stdout: '', exitCode: 0, timedOut: false }),
    }
    const exec = createShellTools(unavailableBackend, agentWorkdir)[0].execute
    const result = await exec({ cmd: 'echo hi', workdir: agentWorkdir })
    expect(result).toContain('Error: shell backend')
  })

  it('returns (no output) for empty stdout', async () => {
    const exec = createShellTools(mockBackend(''), agentWorkdir)[0].execute
    const result = await exec({ cmd: 'true', workdir: agentWorkdir })
    expect(result).toBe('(no output)')
  })
})
