// packages/core/src/tools/backends/__tests__/restricted-local.test.ts
import { describe, it, expect } from 'vitest'
import { RestrictedLocalBackend } from '../restricted-local.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('RestrictedLocalBackend', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'coastal-test-'))
  const backend = new RestrictedLocalBackend([tmpDir])

  it('executes commands within allowed path', async () => {
    const result = await backend.execute('echo hi', tmpDir, 'session-1')
    expect(result.stdout.trim()).toBe('hi')
    expect(result.exitCode).toBe(0)
  }, 15_000)

  it('blocks commands with workdir outside allowed paths', async () => {
    // Use a path that definitely exists but is not in the allowed list
    const result = await backend.execute('echo hi', process.env.SYSTEMROOT ?? '/etc', 'session-1')
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain('Error: workdir')
  }, 15_000)

  it('isAvailable returns true', async () => {
    expect(await backend.isAvailable()).toBe(true)
  })
})
