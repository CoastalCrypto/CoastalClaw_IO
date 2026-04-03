// packages/architect/src/validator.ts
import { spawnSync } from 'node:child_process'

export interface ValidatorResult {
  passed: boolean
  summary: string
  output: string
}

export function parseTestOutput(output: string, exitCode: number): ValidatorResult {
  const passed = exitCode === 0
  // Extract the summary line (Tests N passed / N failed)
  const summaryLine = output
    .split('\n')
    .find(l => l.includes('Tests') && (l.includes('passed') || l.includes('failed'))) ?? ''
  return { passed, summary: summaryLine.trim(), output }
}

export function runTests(repoRoot: string, timeoutMs = 120_000): ValidatorResult {
  const cmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(cmd, ['test', '--reporter=verbose'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    env: { ...process.env, CI: '1' },
  })
  const output = (result.stdout ?? '') + (result.stderr ?? '')
  const exitCode = result.status ?? 1
  return parseTestOutput(output, exitCode)
}
