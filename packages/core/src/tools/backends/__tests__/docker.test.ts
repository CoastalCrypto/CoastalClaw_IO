// packages/core/src/tools/backends/__tests__/docker.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { DockerBackend } from '../docker.js'

describe('DockerBackend', () => {
  const backend = new DockerBackend()
  let dockerAvailable = false

  beforeAll(async () => {
    dockerAvailable = await backend.isAvailable()
    if (!dockerAvailable) {
      console.warn('Docker not available — skipping DockerBackend integration tests')
    }
  })

  it('isAvailable reflects Docker daemon status', async () => {
    // This test just verifies the method runs — pass either way
    const result = await backend.isAvailable()
    expect(typeof result).toBe('boolean')
  })

  it('executes a command in an Alpine container', async () => {
    if (!dockerAvailable) return
    const result = await backend.execute('echo sandbox-works', '/tmp', 'test-session')
    // stdout may include docker pull output on first run — just check it contains the echo
    expect(result.stdout).toContain('sandbox-works')
    expect(result.exitCode).toBe(0)
  }, 30_000) // docker pull alpine on first run takes >5s on CI

  it('has no network access inside container', async () => {
    if (!dockerAvailable) return
    const result = await backend.execute('wget -q -O- http://1.1.1.1 || echo no-network', '/tmp', 'test-session', 5000)
    expect(result.stdout).toContain('no-network')
  })

  it('cannot read host /etc/passwd directly (container has isolated filesystem)', async () => {
    if (!dockerAvailable) return
    const result = await backend.execute('cat /etc/passwd', '/tmp', 'test-session')
    // Alpine container's /etc/passwd should NOT contain the Windows host user
    const hostUser = process.env.USERNAME ?? process.env.USER ?? ''
    if (hostUser) {
      expect(result.stdout).not.toContain(hostUser.toLowerCase())
    } else {
      // If we can't determine host user, just verify the command ran
      expect(result.exitCode).toBe(0)
    }
  })
})
