// packages/architect/src/__tests__/planner.test.ts
import { describe, it, expect } from 'vitest'
import { parseDiffFromResponse, buildPlannerPrompt } from '../planner.js'

describe('parseDiffFromResponse', () => {
  it('extracts unified diff from Ollama response', () => {
    const response = `
Here is the fix:
\`\`\`diff
--- a/packages/core/src/tools/core/shell.ts
+++ b/packages/core/src/tools/core/shell.ts
@@ -10,3 +10,4 @@
 export function run(cmd: string) {
+  if (!cmd.trim()) return { stdout: '', exitCode: 0, timedOut: false }
   return backend.execute(cmd, workdir, sessionId)
 }
\`\`\`
`
    const diff = parseDiffFromResponse(response)
    expect(diff).toContain('--- a/packages/core')
    expect(diff).toContain('+++ b/packages/core')
  })

  it('returns null when no diff found', () => {
    expect(parseDiffFromResponse('No diff here, just text.')).toBeNull()
  })

  it('returns null for empty response', () => {
    expect(parseDiffFromResponse('')).toBeNull()
  })

  it('handles CRLF line endings in diff block', () => {
    const response = '```diff\r\n--- a/file.ts\r\n+++ b/file.ts\r\n```'
    const diff = parseDiffFromResponse(response)
    expect(diff).not.toBeNull()
    expect(diff).toContain('--- a/file.ts')
  })
})

describe('buildPlannerPrompt', () => {
  it('includes failure pattern and source snippet in prompt', () => {
    const prompt = buildPlannerPrompt(
      [{ toolName: 'run_command', failurePattern: 'Error: cwd escape' }],
      'function run(cmd) { return exec(cmd) }',
      'packages/core/src/tools/core/shell.ts'
    )
    expect(prompt).toContain('run_command')
    expect(prompt).toContain('cwd escape')
    expect(prompt).toContain('function run')
    expect(prompt).toContain('ONE unified diff')
  })
})
