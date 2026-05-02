export interface GateOutput { ok: boolean; output: string }

export interface BuildingInput {
  branchName: string
  diff: string
  applyDiff: (diff: string) => Promise<void>
  runLint: () => Promise<GateOutput>
  runTypecheck: () => Promise<GateOutput>
  runBuild: () => Promise<GateOutput>
  runTests: () => Promise<GateOutput>
}

export type BuildingResult =
  | { kind: 'ok'; testSummary: string }
  | { kind: 'soft_fail'; failureKind: 'apply' | 'lint' | 'type' | 'build' | 'test'; message: string }

const TRUNC = 4000

export async function runBuildingStage(input: BuildingInput): Promise<BuildingResult> {
  try {
    await input.applyDiff(input.diff)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { kind: 'soft_fail', failureKind: 'apply', message: trunc(message) }
  }

  const lint = await input.runLint()
  if (!lint.ok) return { kind: 'soft_fail', failureKind: 'lint', message: trunc(lint.output) }

  const types = await input.runTypecheck()
  if (!types.ok) return { kind: 'soft_fail', failureKind: 'type', message: trunc(types.output) }

  const build = await input.runBuild()
  if (!build.ok) return { kind: 'soft_fail', failureKind: 'build', message: trunc(build.output) }

  const tests = await input.runTests()
  if (!tests.ok) return { kind: 'soft_fail', failureKind: 'test', message: trunc(tests.output) }

  return { kind: 'ok', testSummary: tests.output.slice(0, 500) }
}

function trunc(s: string): string {
  return s.length > TRUNC ? s.slice(0, TRUNC) : s
}
