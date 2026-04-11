// packages/core/src/tools/backends/namespace.ts
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { NativeBackend } from './native.js'
import type { ShellBackend, ShellResult } from './types.js'

/**
 * Linux namespace-based sandbox. Uses unshare(1) for mount/pid/net/ipc/uts isolation.
 * Each session gets an isolated workdir under CC_SANDBOX_DIR.
 *
 * Set MOCK_NAMESPACE=1 to run on non-Linux (dev/CI on Windows/Mac).
 * Set CC_SANDBOX_DIR to override workspace root (defaults to /var/lib/coastal-ai/workspace).
 */
export class NamespaceBackend implements ShellBackend {
  readonly name = 'namespace'

  async isAvailable(): Promise<boolean> {
    if (process.env.MOCK_NAMESPACE === '1') return true
    if (process.platform !== 'linux') return false
    try {
      execSync('which unshare', { stdio: 'ignore' })
      // Probe with the same flags used in execute — requires CAP_SYS_ADMIN
      // (granted via AmbientCapabilities in coastal-server.service)
      execSync('unshare --mount --pid --net --ipc --uts --fork --map-root-user true', {
        stdio: 'ignore',
        timeout: 2_000,
      })
      return true
    } catch {
      return false
    }
  }

  async execute(
    cmd: string,
    workdir: string,
    sessionId: string,
    timeoutMs = 30_000,
  ): Promise<ShellResult> {
    // Mock path: delegate to NativeBackend for dev/CI on non-Linux
    if (process.env.MOCK_NAMESPACE === '1') {
      return new NativeBackend().execute(cmd, workdir, sessionId, timeoutMs)
    }

    const sandboxBase = process.env.CC_SANDBOX_DIR ?? '/var/lib/coastal-ai/workspace'
    const sessionDir = join(sandboxBase, `ns-${sessionId.slice(0, 12)}-${Date.now()}`)
    mkdirSync(sessionDir, { recursive: true })

    return new Promise((resolve_) => {
      const proc = spawn('unshare', [
        '--mount', '--pid', '--net', '--ipc', '--uts',
        '--fork', '--map-root-user',
        'sh', '-c', cmd,
      ], {
        cwd: sessionDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: sessionDir },
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      const timer = setTimeout(() => {
        proc.kill('SIGKILL')
        this.cleanup(sessionDir)
        resolve_({
          stdout: `${stdout}${stderr}\n(namespace sandbox timed out after ${timeoutMs}ms)`,
          exitCode: 124,
          timedOut: true,
        })
      }, timeoutMs)

      proc.on('close', (code) => {
        clearTimeout(timer)
        this.cleanup(sessionDir)
        resolve_({
          stdout: stdout + stderr,
          exitCode: code ?? 0,
          timedOut: false,
        })
      })
    })
  }

  private cleanup(sessionDir: string): void {
    try { rmSync(sessionDir, { recursive: true, force: true }) } catch {}
  }
}
