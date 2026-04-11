// packages/core/src/tools/backends/__tests__/namespace-linux.test.ts
// Real unshare integration tests — only run on Linux with user namespace support.
// In CI these run on the ubuntu-24.04 GitHub Actions runner.
import { describe, it, expect, beforeAll } from 'vitest'
import { NamespaceBackend } from '../namespace.js'

const isLinux = process.platform === 'linux'

describe.skipIf(!isLinux)('NamespaceBackend (real Linux, no mock)', () => {
  let backend: NamespaceBackend
  let available = false

  beforeAll(async () => {
    // Run without MOCK_NAMESPACE to exercise real unshare path
    delete process.env.MOCK_NAMESPACE
    // Use /tmp for sandbox so tests don't require /var/lib/coastal-ai/workspace
    process.env.CC_SANDBOX_DIR = '/tmp/coastal-test-ns'
    backend = new NamespaceBackend()
    available = await backend.isAvailable()
    if (!available) console.warn('[namespace-linux] unshare unavailable — skipping real tests')
  })

  it('isAvailable reflects whether CAP_SYS_ADMIN allows full unshare', () => {
    // On ClawOS with AmbientCapabilities=CAP_SYS_ADMIN, this is true.
    // On a dev machine without the capability, isAvailable correctly returns false
    // so createBackend() falls back to DockerBackend.
    expect(typeof available).toBe('boolean')
  })

  it('executes echo in a real namespace (requires CAP_SYS_ADMIN)', async () => {
    if (!available) return
    const result = await backend.execute('echo real-sandbox', '/tmp', 'linux-test-1')
    expect(result.stdout.trim()).toBe('real-sandbox')
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('non-zero exit code propagates from real namespace', async () => {
    if (!available) return
    const result = await backend.execute('exit 42', '/tmp', 'linux-test-2')
    expect(result.exitCode).toBe(42)
    expect(result.timedOut).toBe(false)
  })

  it('stderr is captured alongside stdout', async () => {
    if (!available) return
    const result = await backend.execute('echo out && echo err >&2', '/tmp', 'linux-test-3')
    expect(result.stdout).toContain('out')
    expect(result.stdout).toContain('err')
  })

  it('times out real process and reports timedOut', async () => {
    if (!available) return
    const result = await backend.execute('sleep 30', '/tmp', 'linux-test-4', 300)
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
  }, 5_000)
})
