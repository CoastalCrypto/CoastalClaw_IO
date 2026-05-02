export interface GateExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface GateOpts {
  cwd: string
  exec: (cmd: string, opts: { cwd: string }) => Promise<GateExecResult>
}

function buildFilterFlags(packages: string[]): string {
  return packages.map(p => `--filter ${p}`).join(' ')
}

async function runScripted(scriptName: string, packages: string[], opts: GateOpts) {
  if (packages.length === 0) return { ok: true, output: 'no packages touched' }
  const cmd = `pnpm ${buildFilterFlags(packages)} ${scriptName}`
  const r = await opts.exec(cmd, { cwd: opts.cwd })
  return {
    ok: r.exitCode === 0,
    output: (r.stdout + '\n' + r.stderr).trim(),
  }
}

export const runLintGate = (pkgs: string[], opts: GateOpts) =>
  runScripted('lint', pkgs, opts)
export const runTypeGate = (pkgs: string[], opts: GateOpts) =>
  runScripted('exec tsc --noEmit', pkgs, opts)
export const runBuildGate = (pkgs: string[], opts: GateOpts) =>
  runScripted('build', pkgs, opts)
export const runTestGate = (pkgs: string[], opts: GateOpts) =>
  runScripted('test', pkgs, opts)
