// packages/core/src/tools/backends/__tests__/namespace.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NamespaceBackend } from '../namespace.js'

// All tests run with MOCK_NAMESPACE=1 so they pass on Windows/Mac
// Real unshare tests run in GitHub Actions (ubuntu-24.04 runner)

describe('NamespaceBackend', () => {
  let backend: NamespaceBackend
  const origEnv = process.env.MOCK_NAMESPACE

  beforeEach(() => {
    process.env.MOCK_NAMESPACE = '1'
    backend = new NamespaceBackend()
  })

  afterEach(() => {
    if (origEnv === undefined) delete process.env.MOCK_NAMESPACE
    else process.env.MOCK_NAMESPACE = origEnv
  })

  it('name is "namespace"', () => {
    expect(backend.name).toBe('namespace')
  })

  it('isAvailable returns true in mock mode', async () => {
    expect(await backend.isAvailable()).toBe(true)
  })

  it('isAvailable returns false on non-Linux without mock', async () => {
    delete process.env.MOCK_NAMESPACE
    if (process.platform !== 'linux') {
      expect(await backend.isAvailable()).toBe(false)
    }
  })

  it('execute returns stdout in mock mode', async () => {
    const result = await backend.execute('echo hello', process.cwd(), 'test-session')
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('execute returns non-zero exit code on failure', async () => {
    const result = await backend.execute('exit 1', process.cwd(), 'test-session')
    expect(result.exitCode).not.toBe(0)
  })

  it('execute times out', async () => {
    const result = await backend.execute('sleep 10', process.cwd(), 'test-session', 200)
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
  }, 5_000)
})
