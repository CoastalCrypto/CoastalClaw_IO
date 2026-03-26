import { describe, it, expect } from 'vitest'
import { shellTools } from '../shell.js'

const exec = shellTools.find(t => t.definition.name === 'run_command')!.execute

describe('run_command', () => {
  it('runs a simple command and returns stdout', async () => {
    const result = await exec({ cmd: 'echo hello', workdir: process.cwd() })
    expect(result).toContain('hello')
  })

  it('returns stderr on error', async () => {
    const result = await exec({ cmd: 'cat /nonexistent_file_xyz', workdir: process.cwd() })
    expect(result).toMatch(/error|no such|Error/i)
  })

  it('blocks commands that escape the workdir via cd', async () => {
    const result = await exec({ cmd: 'cd /etc && cat passwd', workdir: '/tmp' })
    expect(result).toContain('Error: cwd escape')
  })
})
