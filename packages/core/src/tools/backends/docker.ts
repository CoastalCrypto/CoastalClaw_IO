// packages/core/src/tools/backends/docker.ts
import { spawn, execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ShellBackend, ShellResult } from './types.js'

const DOCKER_IMAGE = 'alpine:3.21'

export class DockerBackend implements ShellBackend {
  readonly name = 'docker'

  async isAvailable(): Promise<boolean> {
    try {
      execSync('docker info', { stdio: 'ignore', timeout: 5_000 })
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
    // Ensure host workdir exists before bind-mounting
    const hostWorkdir = resolve(workdir)
    mkdirSync(hostWorkdir, { recursive: true })

    const containerName = `coastal-sandbox-${sessionId.slice(0, 12)}-${Date.now()}`

    return new Promise((resolve_) => {
      const proc = spawn('docker', [
        'run', '--rm',
        '--name', containerName,
        '--network', 'none',
        '--memory', '256m',
        '--cpus', '0.5',
        '--read-only',
        '--tmpfs', '/tmp:size=64m',
        '-v', `${hostWorkdir}:/workspace:rw`,
        '-w', '/workspace',
        DOCKER_IMAGE,
        'sh', '-c', cmd,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      const timer = setTimeout(() => {
        proc.kill()
        try { execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' }) } catch {}
        resolve_({
          stdout: `${stdout}${stderr}\n(container timed out after ${timeoutMs}ms)`,
          exitCode: 124,
          timedOut: true,
        })
      }, timeoutMs)

      proc.on('close', (code) => {
        clearTimeout(timer)
        resolve_({
          stdout: stdout + stderr,
          exitCode: code ?? 0,
          timedOut: false,
        })
      })
    })
  }
}
