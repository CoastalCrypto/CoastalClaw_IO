import { execSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Restart the server process after an in-place update.
 *
 * Windows: writes a detached .cmd that waits 2s then re-launches node.
 *          cmd.exe is always available; no external service manager needed.
 * Linux/Mac: tries systemctl first (systemd installations), falls back to
 *            process.exit(0) so a supervisor (systemd Restart=always, pm2, etc.) restarts us.
 */
export function restartServer(installDir: string): void {
  if (process.platform === 'win32') {
    const script = join(tmpdir(), 'coastal-ai-restart.cmd')
    writeFileSync(script, [
      '@echo off',
      'timeout /t 2 /nobreak > nul',
      `cd /d "${installDir}"`,
      'node packages/core/dist/main.js',
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
    process.exit(0)
  } else {
    try {
      execSync('systemctl restart coastal-ai-server', { timeout: 10_000 })
    } catch {
      process.exit(0)
    }
  }
}
