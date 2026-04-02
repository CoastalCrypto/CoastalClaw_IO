// packages/core/src/tools/backends/native.ts
import { spawn, execSync } from 'node:child_process'
import type { ShellBackend, ShellResult } from './types.js'

export class NativeBackend implements ShellBackend {
  readonly name = 'native'

  async isAvailable(): Promise<boolean> {
    return true
  }

  async execute(
    cmd: string,
    workdir: string,
    _sessionId: string,
    timeoutMs = 30_000,
  ): Promise<ShellResult> {
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32'
      const proc = spawn(
        isWin ? 'cmd.exe' : 'sh',
        isWin ? ['/c', cmd] : ['-c', cmd],
        { cwd: workdir, stdio: ['ignore', 'pipe', 'pipe'] },
      )

      let stdout = ''
      let stderr = ''
      let resolved = false

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      const timer = setTimeout(() => {
        // Mark resolved BEFORE killing so the close handler ignores the
        // post-kill close event (important on Windows where close fires
        // synchronously during the same tick as the kill call).
        resolved = true
        if (isWin) {
          try {
            execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' })
          } catch {
            proc.kill()
          }
        } else {
          proc.kill('SIGKILL')
        }
        resolve({
          stdout: `${stdout}${stderr}\n(command timed out after ${timeoutMs}ms)`,
          exitCode: 124,
          timedOut: true,
        })
      }, timeoutMs)

      proc.on('close', (code) => {
        if (resolved) return
        clearTimeout(timer)
        resolved = true
        resolve({
          stdout: stdout + stderr,
          exitCode: code ?? 0,
          timedOut: false,
        })
      })
    })
  }
}
