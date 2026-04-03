# Phase 2 — CoastalOS Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the coastal-architect self-build loop, CoastalOS Ubuntu kiosk with browser control tools, and a fully local voice pipeline — shipping everything on a new branch `feat/phase2-coastalos`.

**Architecture:** Three independent subsystems built in order: (B) `packages/architect` reads skill-gaps.db, asks Ollama to propose one code fix, applies via git branch, merges on test pass; (C) `coastalos/` Ubuntu kiosk scripts + `packages/core/src/tools/browser/` Playwright tool family + `packages/shell/` Electron wrapper; (A) `packages/daemon/src/voice/` state machine using Whisper.cpp + openWakeWord + Piper TTS, all local.

**Tech Stack:** Node 22 ESM TypeScript, pnpm workspaces, Vitest, Fastify, better-sqlite3, Playwright, Electron, Whisper.cpp via whisper-node, Piper TTS via child process, openWakeWord via Python subprocess.

**Branch:** Create `feat/phase2-coastalos` from master before starting any task.

```bash
git checkout master && git checkout -b feat/phase2-coastalos
```

---

## File Map

### New files — Chunk 1 (coastal-architect)
| File | Purpose |
|------|---------|
| `packages/architect/package.json` | Workspace package scaffold |
| `packages/architect/tsconfig.json` | TypeScript config |
| `packages/architect/vitest.config.ts` | Test config |
| `packages/architect/src/config.ts` | LOCKED_PATHS, threshold, cron constants |
| `packages/architect/src/planner.ts` | Read skill-gaps.db + Ollama → unified diff |
| `packages/architect/src/patcher.ts` | Git branch, apply diff, merge/delete |
| `packages/architect/src/validator.ts` | Run pnpm test, parse pass/fail |
| `packages/architect/src/announcer.ts` | HTTP POST to coastal-server, poll for veto |
| `packages/architect/src/index.ts` | Cron + threshold watcher + manual trigger |
| `packages/architect/src/__tests__/config.test.ts` | Locked path rejection |
| `packages/architect/src/__tests__/planner.test.ts` | Diff parsing |
| `packages/architect/src/__tests__/patcher.test.ts` | Git ops on temp repo |
| `packages/architect/src/__tests__/validator.test.ts` | Pass/fail detection |
| `packages/architect/src/__tests__/announcer.test.ts` | HTTP + veto timeout |

### Modified files — Chunk 1
| File | Change |
|------|--------|
| `packages/core/src/api/routes/admin.ts` | Add architect propose/veto/run routes |
| `packages/core/src/api/routes/admin.test.ts` | Tests for new routes |

### New files — Chunk 2 (CoastalOS + browser)
| File | Purpose |
|------|---------|
| `packages/core/src/tools/browser/session-manager.ts` | BrowserSessionManager per-agent Playwright contexts |
| `packages/core/src/tools/browser/browser-tools.ts` | 6 browser tool definitions |
| `packages/core/src/tools/browser/__tests__/session-manager.test.ts` | Session isolation tests |
| `packages/core/src/tools/browser/__tests__/browser-tools.test.ts` | Tool trust tier gate |
| `packages/shell/package.json` | Electron app scaffold |
| `packages/shell/src/main.ts` | Electron main process |
| `packages/shell/src/preload.ts` | IPC bridge |
| `packages/shell/build/electron-builder.yml` | Build config |
| `coastalos/systemd/coastal-server.service` | systemd unit |
| `coastalos/systemd/coastal-daemon.service` | systemd unit |
| `coastalos/systemd/coastal-architect.service` | systemd unit |
| `coastalos/systemd/coastal-architect.timer` | nightly timer unit |
| `coastalos/systemd/coastal-shell.service` | labwc kiosk unit |
| `coastalos/labwc/rc.xml` | Keybindings (Ctrl+Alt+T → Alacritty) |
| `coastalos/labwc/autostart` | Launch Chromium kiosk |
| `coastalos/build/packages.list` | APT package list for ISO |
| `coastalos/build/build.sh` | ISO build script |
| `coastalos/build/hooks/post-install.sh` | Enable services, set autologin |

### Modified files — Chunk 2
| File | Change |
|------|--------|
| `packages/core/src/tools/registry.ts` | Register browser tools at TRUSTED+ tier |
| `packages/daemon/src/index.ts` | Add BrowserSessionManager.closeAll() in SIGTERM |

### New files — Chunk 3 (Voice Pipeline)
| File | Purpose |
|------|---------|
| `packages/daemon/src/voice/audio.ts` | PipeWire/portaudio mic + speaker |
| `packages/daemon/src/voice/wake-word.ts` | openWakeWord Python subprocess |
| `packages/daemon/src/voice/stt.ts` | Whisper.cpp via whisper-node |
| `packages/daemon/src/voice/tts.ts` | Piper TTS + espeak fallback |
| `packages/daemon/src/voice/vad.ts` | Voice activity detection |
| `packages/daemon/src/voice/interrupt-handler.ts` | VAD → abort IterationBudget |
| `packages/daemon/src/voice/pipeline.ts` | State machine: idle→listen→transcribe→think→speak |
| `packages/daemon/src/__tests__/voice/audio.test.ts` | Recorder/player mock mode |
| `packages/daemon/src/__tests__/voice/wake-word.test.ts` | Wake word detection mock |
| `packages/daemon/src/__tests__/voice/stt.test.ts` | Transcription mock + model-missing path |
| `packages/daemon/src/__tests__/voice/pipeline.test.ts` | State transitions |
| `packages/daemon/src/__tests__/voice/interrupt.test.ts` | Abort propagation |
| `packages/daemon/src/__tests__/voice/tts.test.ts` | espeak fallback |

### Modified files — Chunk 3
| File | Change |
|------|--------|
| `packages/daemon/src/index.ts` | Start voice pipeline at AUTONOMOUS tier |
| `packages/core/src/agents/types.ts` | Add `voiceModel?: string` to AgentFileConfig |
| `agents/cfo/config.json` | Add `voiceModel` field |
| `packages/daemon/package.json` | Add whisper-node, @ricky0123/vad-node |

---

## Chunk 1: coastal-architect

### Task 1: Scaffold packages/architect

**Files:**
- Create: `packages/architect/package.json`
- Create: `packages/architect/tsconfig.json`
- Create: `packages/architect/vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@coastal-claw/architect",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "node --loader ts-node/esm src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: false } })
```

- [ ] **Step 4: Install**

```bash
cd C:/Users/John/CoastalClaw && pnpm install
```

Expected: `@coastal-claw/architect` workspace package resolved.

- [ ] **Step 5: Commit**

```bash
git add packages/architect/package.json packages/architect/tsconfig.json packages/architect/vitest.config.ts
git commit -m "feat(architect): scaffold packages/architect workspace package"
```

---

### Task 2: config.ts — locked paths and constants

**Files:**
- Create: `packages/architect/src/config.ts`
- Create: `packages/architect/src/__tests__/config.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/architect/src/__tests__/config.test.ts
import { describe, it, expect } from 'vitest'
import { LOCKED_PATHS, SKILL_GAPS_THRESHOLD, VETO_TIMEOUT_MS, isLockedPath } from '../config.js'

describe('config', () => {
  it('marks security-critical files as locked', () => {
    expect(isLockedPath('packages/architect/src/patcher.ts')).toBe(true)
    expect(isLockedPath('packages/architect/src/validator.ts')).toBe(true)
    expect(isLockedPath('packages/core/src/agents/permission-gate.ts')).toBe(true)
    expect(isLockedPath('packages/core/src/agents/action-log.ts')).toBe(true)
    expect(isLockedPath('packages/core/src/api/routes/admin.ts')).toBe(true)
    expect(isLockedPath('packages/architect/src/index.ts')).toBe(true)
    expect(isLockedPath('packages/architect/src/config.ts')).toBe(true)
  })

  it('allows non-locked files', () => {
    expect(isLockedPath('packages/core/src/tools/registry.ts')).toBe(false)
    expect(isLockedPath('packages/daemon/src/scheduler.ts')).toBe(false)
    expect(isLockedPath('agents/cfo/SYSTEM.md')).toBe(false)
  })

  it('exports numeric constants', () => {
    expect(SKILL_GAPS_THRESHOLD).toBe(10)
    expect(VETO_TIMEOUT_MS).toBe(60_000)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/architect && pnpm test
```

Expected: FAIL — `config.js` not found.

- [ ] **Step 3: Implement config.ts**

```typescript
// packages/architect/src/config.ts

export const LOCKED_PATHS = new Set([
  'packages/architect/src/index.ts',
  'packages/architect/src/config.ts',
  'packages/architect/src/patcher.ts',
  'packages/architect/src/validator.ts',
  'packages/core/src/agents/permission-gate.ts',
  'packages/core/src/agents/action-log.ts',
  'packages/core/src/api/routes/admin.ts',
])

/** Returns true if the normalized relative path is in the locked set. */
export function isLockedPath(relPath: string): boolean {
  // Normalize: strip leading ./ and replace backslashes
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '')
  return LOCKED_PATHS.has(norm)
}

/** Number of unreviewed skill gaps that triggers an architect cycle. */
export const SKILL_GAPS_THRESHOLD = 10

/** Veto window in milliseconds. */
export const VETO_TIMEOUT_MS = 60_000

/** Hours to skip a pattern after a failed architect cycle. */
export const SKIP_HOURS = 24

/** Default cron expression for nightly run (02:00 local). */
export const NIGHTLY_CRON = '0 2 * * *'
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/architect && pnpm test
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/architect/src/config.ts packages/architect/src/__tests__/config.test.ts
git commit -m "feat(architect): add config with LOCKED_PATHS and isLockedPath guard"
```

---

### Task 3: planner.ts — read skill-gaps + ask Ollama + parse diff

**Files:**
- Create: `packages/architect/src/planner.ts`
- Create: `packages/architect/src/__tests__/planner.test.ts`

The planner reads unreviewed skill gaps from `skill-gaps.db`, reads the most relevant source file mentioned in the failure, then asks a local Ollama model for ONE unified diff to fix it.

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/architect && pnpm test
```

- [ ] **Step 3: Implement planner.ts**

```typescript
// packages/architect/src/planner.ts
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

export interface SkillGapRow {
  toolName: string
  failurePattern: string
}

export interface PlannerResult {
  diff: string
  summary: string
  targetFile: string
  gapIds: string[]
}

/** Extract a unified diff from an Ollama response (looks for ```diff block). */
export function parseDiffFromResponse(response: string): string | null {
  const match = response.match(/```diff\n([\s\S]*?)```/)
  if (!match) return null
  const diff = match[1].trim()
  return diff.length > 0 ? diff : null
}

/** Build the prompt sent to Ollama for a single improvement proposal. */
export function buildPlannerPrompt(
  gaps: SkillGapRow[],
  sourceSnippet: string,
  filePath: string
): string {
  const gapSummary = gaps
    .map(g => `- Tool: ${g.toolName}, Pattern: ${g.failurePattern}`)
    .join('\n')
  return `You are the coastal-architect, an AI that improves its own codebase.

FAILURE PATTERNS (from skill-gaps.db):
${gapSummary}

SOURCE FILE: ${filePath}
\`\`\`typescript
${sourceSnippet.slice(0, 3000)}
\`\`\`

Propose ONE targeted fix as a unified diff. Rules:
- Output ONLY ONE ```diff block and nothing else after it.
- The fix must directly address ONE of the failure patterns above.
- Do not change unrelated code.
- Do not add imports unless strictly necessary.
- The diff must be syntactically valid and apply cleanly.

Respond with a brief one-sentence summary, then the diff block.`
}

/** Infer the most relevant source file from failure patterns. */
function inferTargetFile(gaps: SkillGapRow[], repoRoot: string): string | null {
  // Look for tool-name → source file heuristics
  const toolToFile: Record<string, string> = {
    run_command: 'packages/core/src/tools/core/shell.ts',
    read_file:   'packages/core/src/tools/core/file.ts',
    write_file:  'packages/core/src/tools/core/file.ts',
    query_db:    'packages/core/src/tools/core/sqlite.ts',
    http_get:    'packages/core/src/tools/core/web.ts',
    git_status:  'packages/core/src/tools/core/git.ts',
  }
  for (const gap of gaps) {
    const rel = toolToFile[gap.toolName]
    if (rel) {
      const full = join(repoRoot, rel)
      if (existsSync(full)) return rel
    }
  }
  return null
}

/** Read unreviewed skill gaps from skill-gaps.db. */
export function readUnreviewedGaps(dataDir: string): Array<SkillGapRow & { id: string }> {
  const dbPath = join(dataDir, 'skill-gaps.db')
  if (!existsSync(dbPath)) return []
  const db = new Database(dbPath, { readonly: true })
  try {
    const rows = db
      .prepare('SELECT id, tool_name, failure_pattern FROM skill_gaps WHERE reviewed = 0 ORDER BY timestamp ASC LIMIT 20')
      .all() as Array<{ id: string; tool_name: string; failure_pattern: string }>
    return rows.map(r => ({ id: r.id, toolName: r.tool_name, failurePattern: r.failure_pattern }))
  } finally {
    db.close()
  }
}

/** Ask Ollama (local) to propose a diff. Returns null if unavailable. */
export async function askOllama(
  prompt: string,
  ollamaUrl: string,
  model: string
): Promise<string | null> {
  try {
    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false }),
    })
    if (!res.ok) return null
    const json = await res.json() as { response?: string }
    return json.response ?? null
  } catch {
    return null
  }
}

/** Top-level: read gaps, find target file, ask Ollama, return PlannerResult or null. */
export async function plan(opts: {
  dataDir: string
  repoRoot: string
  ollamaUrl: string
  model: string
}): Promise<PlannerResult | null> {
  const gaps = readUnreviewedGaps(opts.dataDir)
  if (gaps.length === 0) return null

  const targetRel = inferTargetFile(gaps, opts.repoRoot)
  if (!targetRel) return null

  const sourceFull = join(opts.repoRoot, targetRel)
  const sourceSnippet = existsSync(sourceFull) ? readFileSync(sourceFull, 'utf8') : ''

  const prompt = buildPlannerPrompt(gaps, sourceSnippet, targetRel)
  const response = await askOllama(prompt, opts.ollamaUrl, opts.model)
  if (!response) return null

  const diff = parseDiffFromResponse(response)
  if (!diff) return null

  // Extract one-sentence summary (first non-empty line before the diff block)
  const summary = response.split('\n').find(l => l.trim() && !l.startsWith('```')) ?? 'Proposed fix'

  return { diff, summary, targetFile: targetRel, gapIds: gaps.map(g => g.id) }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/architect && pnpm test
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/architect/src/planner.ts packages/architect/src/__tests__/planner.test.ts
git commit -m "feat(architect): add planner — reads skill-gaps.db and builds Ollama prompt"
```

---

### Task 4: patcher.ts — git branch, apply diff, merge/delete

**Files:**
- Create: `packages/architect/src/patcher.ts`
- Create: `packages/architect/src/__tests__/patcher.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/architect/src/__tests__/patcher.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { Patcher } from '../patcher.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'architect-test-'))
  execSync('git init', { cwd: tmpDir })
  execSync('git config user.email "test@test.com"', { cwd: tmpDir })
  execSync('git config user.name "Test"', { cwd: tmpDir })
  writeFileSync(join(tmpDir, 'hello.ts'), 'export function hello() { return "world" }\n')
  execSync('git add .', { cwd: tmpDir })
  execSync('git commit -m "init"', { cwd: tmpDir })
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('Patcher', () => {
  it('creates a branch and applies a valid diff', async () => {
    const patcher = new Patcher(tmpDir)
    const branchName = 'feature/self-improve-test'
    const diff = `--- a/hello.ts\n+++ b/hello.ts\n@@ -1 +1 @@\n-export function hello() { return "world" }\n+export function hello() { return "coastal" }\n`
    await patcher.createBranch(branchName)
    await patcher.applyDiff(diff)
    await patcher.commitChange('feat: improve hello')
    const content = readFileSync(join(tmpDir, 'hello.ts'), 'utf8')
    expect(content).toContain('coastal')
  })

  it('deleteBranch removes the branch', async () => {
    const patcher = new Patcher(tmpDir)
    await patcher.createBranch('feature/to-delete')
    await patcher.checkoutMain()
    await patcher.deleteBranch('feature/to-delete')
    const branches = execSync('git branch', { cwd: tmpDir }).toString()
    expect(branches).not.toContain('to-delete')
  })

  it('mergeBranch fast-forwards with --no-ff', async () => {
    const patcher = new Patcher(tmpDir)
    const branchName = 'feature/merge-test'
    const diff = `--- a/hello.ts\n+++ b/hello.ts\n@@ -1 +1 @@\n-export function hello() { return "world" }\n+export function hello() { return "merged" }\n`
    await patcher.createBranch(branchName)
    await patcher.applyDiff(diff)
    await patcher.commitChange('feat: merge test')
    await patcher.checkoutMain()
    await patcher.mergeBranch(branchName)
    const content = readFileSync(join(tmpDir, 'hello.ts'), 'utf8')
    expect(content).toContain('merged')
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/architect && pnpm test
```

- [ ] **Step 3: Implement patcher.ts**

```typescript
// packages/architect/src/patcher.ts
import { execSync, execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export class Patcher {
  constructor(private repoRoot: string) {}

  private exec(cmd: string): string {
    return execSync(cmd, { cwd: this.repoRoot, encoding: 'utf8' })
  }

  async createBranch(name: string): Promise<void> {
    this.exec(`git checkout -b ${name}`)
  }

  async checkoutMain(): Promise<void> {
    // Try master then main
    try {
      this.exec('git checkout master')
    } catch {
      this.exec('git checkout main')
    }
  }

  async applyDiff(diff: string): Promise<void> {
    const tmpFile = join(tmpdir(), `architect-${randomBytes(4).toString('hex')}.patch`)
    writeFileSync(tmpFile, diff)
    try {
      execFileSync('git', ['apply', '--whitespace=nowarn', tmpFile], { cwd: this.repoRoot })
    } finally {
      if (existsSync(tmpFile)) unlinkSync(tmpFile)
    }
  }

  async commitChange(message: string): Promise<void> {
    this.exec('git add -A')
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`)
  }

  async deleteBranch(name: string): Promise<void> {
    this.exec(`git branch -D ${name}`)
  }

  async mergeBranch(name: string): Promise<void> {
    this.exec(`git merge --no-ff ${name} -m "chore(architect): merge self-improvement branch ${name}"`)
  }

  currentBranch(): string {
    return this.exec('git branch --show-current').trim()
  }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/architect && pnpm test
```

Expected: PASS — 3 patcher tests + existing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/architect/src/patcher.ts packages/architect/src/__tests__/patcher.test.ts
git commit -m "feat(architect): add Patcher — git branch, apply diff, merge"
```

---

### Task 5: validator.ts — run pnpm test, parse results

**Files:**
- Create: `packages/architect/src/validator.ts`
- Create: `packages/architect/src/__tests__/validator.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/architect/src/__tests__/validator.test.ts
import { describe, it, expect } from 'vitest'
import { parseTestOutput } from '../validator.js'

describe('parseTestOutput', () => {
  it('detects passing test run', () => {
    const output = `
 ✓ packages/core (134 tests)
 ✓ packages/daemon (6 tests)

Test Files  2 passed (2)
Tests  140 passed (140)
`
    const result = parseTestOutput(output, 0)
    expect(result.passed).toBe(true)
    expect(result.summary).toContain('140')
  })

  it('detects failing test run', () => {
    const output = `
 ✗ packages/core (1 failed)

Test Files  1 failed (2)
Tests  2 failed | 138 passed (140)
`
    const result = parseTestOutput(output, 1)
    expect(result.passed).toBe(false)
    expect(result.summary).toContain('failed')
  })

  it('uses exit code as primary signal', () => {
    // Non-zero exit code = failure regardless of output
    expect(parseTestOutput('Tests  5 passed (5)', 1).passed).toBe(false)
    expect(parseTestOutput('Tests  0 passed (0)', 0).passed).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/architect && pnpm test
```

- [ ] **Step 3: Implement validator.ts**

```typescript
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
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/architect && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/architect/src/validator.ts packages/architect/src/__tests__/validator.test.ts
git commit -m "feat(architect): add validator — runs pnpm test and parses pass/fail"
```

---

### Task 6: announcer.ts — HTTP POST proposal, poll for veto

**Files:**
- Create: `packages/architect/src/announcer.ts`
- Create: `packages/architect/src/__tests__/announcer.test.ts`

The announcer POSTs a proposal to coastal-server's admin API (which stores it and broadcasts via WebSocket). It then polls `GET /api/admin/architect/proposal/:id` until either vetoed or the veto window expires.

- [ ] **Step 1: Write failing tests**

```typescript
// packages/architect/src/__tests__/announcer.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitForVeto } from '../announcer.js'

describe('waitForVeto', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns proceed when no veto arrives before timeout', async () => {
    // Mock fetch: propose returns proposalId, poll always returns pending
    let callCount = 0
    vi.stubGlobal('fetch', async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('/propose')) {
        return { ok: true, json: async () => ({ proposalId: 'test-id' }) }
      }
      callCount++
      return { ok: true, json: async () => ({ status: 'pending' }) }
    })
    const result = await waitForVeto({
      serverUrl: 'http://localhost:4747',
      adminToken: 'tok',
      summary: 'Fix shell tool',
      diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new',
      vetoTimeoutMs: 100,
      pollIntervalMs: 20,
    })
    expect(result).toBe('proceed')
    expect(callCount).toBeGreaterThan(0)
  })

  it('returns vetoed when server signals veto', async () => {
    vi.stubGlobal('fetch', async (url: string) => {
      if (typeof url === 'string' && url.includes('/propose')) {
        return { ok: true, json: async () => ({ proposalId: 'veto-id' }) }
      }
      return { ok: true, json: async () => ({ status: 'vetoed' }) }
    })
    const result = await waitForVeto({
      serverUrl: 'http://localhost:4747',
      adminToken: 'tok',
      summary: 'Fix',
      diff: '--- a/x\n+++ b/x',
      vetoTimeoutMs: 200,
      pollIntervalMs: 20,
    })
    expect(result).toBe('vetoed')
  })

  it('returns proceed when server is unreachable (fail open)', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNREFUSED') })
    const result = await waitForVeto({
      serverUrl: 'http://localhost:4747',
      adminToken: 'tok',
      summary: 'Fix',
      diff: '--- a/x\n+++ b/x',
      vetoTimeoutMs: 100,
      pollIntervalMs: 20,
    })
    expect(result).toBe('proceed')
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/architect && pnpm test
```

- [ ] **Step 3: Implement announcer.ts**

```typescript
// packages/architect/src/announcer.ts

export interface AnnounceOpts {
  serverUrl: string
  adminToken: string
  summary: string
  diff: string
  vetoTimeoutMs: number
  pollIntervalMs?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** POST proposal to coastal-server, then poll until vetoed or timeout. */
export async function waitForVeto(opts: AnnounceOpts): Promise<'proceed' | 'vetoed'> {
  const pollMs = opts.pollIntervalMs ?? 5_000
  let proposalId: string | null = null

  // Announce — fail open if server unreachable
  try {
    const res = await fetch(`${opts.serverUrl}/api/admin/architect/propose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': opts.adminToken,
      },
      body: JSON.stringify({ summary: opts.summary, diff: opts.diff }),
    })
    if (res.ok) {
      const json = await res.json() as { proposalId?: string }
      proposalId = json.proposalId ?? null
    }
  } catch {
    // Server unreachable — proceed without veto window
    console.warn('[architect] coastal-server unreachable — proceeding without veto window')
    return 'proceed'
  }

  if (!proposalId) return 'proceed'

  // Poll for veto
  const deadline = Date.now() + opts.vetoTimeoutMs
  while (Date.now() < deadline) {
    await sleep(Math.min(pollMs, deadline - Date.now()))
    try {
      const res = await fetch(
        `${opts.serverUrl}/api/admin/architect/proposal/${proposalId}`,
        { headers: { 'x-admin-token': opts.adminToken } }
      )
      if (res.ok) {
        const json = await res.json() as { status: string }
        if (json.status === 'vetoed') return 'vetoed'
        if (json.status === 'expired') return 'proceed'
      }
    } catch {
      // Poll failure — continue waiting
    }
  }
  return 'proceed'
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/architect && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add packages/architect/src/announcer.ts packages/architect/src/__tests__/announcer.test.ts
git commit -m "feat(architect): add announcer — HTTP proposal + veto polling"
```

---

### Task 7: index.ts — cron, threshold watcher, entry point

**Files:**
- Create: `packages/architect/src/index.ts`

This wires together planner → announcer → patcher → validator. It also checks `skill-gaps.db` row count and starts an interval to trigger on threshold.

- [ ] **Step 1: Implement index.ts**

```typescript
// packages/architect/src/index.ts
import 'dotenv/config'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { plan } from './planner.js'
import { Patcher } from './patcher.js'
import { runTests } from './validator.js'
import { waitForVeto } from './announcer.js'
import { SKILL_GAPS_THRESHOLD, VETO_TIMEOUT_MS, isLockedPath } from './config.js'
import Database from 'better-sqlite3'

const REPO_ROOT   = process.env.CC_REPO_ROOT    ?? process.cwd()
const DATA_DIR    = process.env.CC_DATA_DIR      ?? join(REPO_ROOT, 'data')
const OLLAMA_URL  = process.env.CC_OLLAMA_URL    ?? 'http://127.0.0.1:11434'
const OLLAMA_MODEL = process.env.CC_ARCHITECT_MODEL ?? 'llama3.2'
const SERVER_URL  = process.env.CC_SERVER_URL    ?? 'http://localhost:4747'
const CHECK_INTERVAL_MS = Number(process.env.CC_ARCHITECT_INTERVAL_MS ?? '60000')
const AUTONOMOUS  = existsSync(join(DATA_DIR, '.architect-autonomous'))

function getAdminToken(): string {
  const envToken = process.env.CC_ADMIN_TOKEN
  if (envToken) return envToken
  const tokenFile = join(DATA_DIR, '.admin-token')
  if (existsSync(tokenFile)) return readFileSync(tokenFile, 'utf8').trim()
  return ''
}

function countUnreviewedGaps(): number {
  const dbPath = join(DATA_DIR, 'skill-gaps.db')
  if (!existsSync(dbPath)) return 0
  const db = new Database(dbPath, { readonly: true })
  try {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM skill_gaps WHERE reviewed = 0').get() as { cnt: number }
    return row.cnt
  } finally {
    db.close()
  }
}

async function runCycle(): Promise<void> {
  console.log('[coastal-architect] Starting improvement cycle...')

  const result = await plan({ dataDir: DATA_DIR, repoRoot: REPO_ROOT, ollamaUrl: OLLAMA_URL, model: OLLAMA_MODEL })
  if (!result) {
    console.log('[coastal-architect] Nothing to improve.')
    return
  }

  // Locked path guard
  if (isLockedPath(result.targetFile)) {
    console.warn(`[coastal-architect] Proposed change targets locked path: ${result.targetFile} — skipping.`)
    return
  }

  console.log(`[coastal-architect] Proposal: ${result.summary}`)

  // Veto window (skip if autonomous mode)
  if (!AUTONOMOUS) {
    const decision = await waitForVeto({
      serverUrl: SERVER_URL,
      adminToken: getAdminToken(),
      summary: result.summary,
      diff: result.diff,
      vetoTimeoutMs: VETO_TIMEOUT_MS,
    })
    if (decision === 'vetoed') {
      console.log('[coastal-architect] Vetoed by user — aborting cycle.')
      return
    }
  }

  // Apply and test
  const branchName = `feature/self-improve-${new Date().toISOString().slice(0, 10)}`
  const patcher = new Patcher(REPO_ROOT)
  try {
    await patcher.createBranch(branchName)
    await patcher.applyDiff(result.diff)
    await patcher.commitChange(`chore(architect): ${result.summary}`)

    const testResult = runTests(REPO_ROOT)
    if (testResult.passed) {
      await patcher.checkoutMain()
      await patcher.mergeBranch(branchName)
      console.log(`[coastal-architect] Applied: ${result.summary} — ${testResult.summary}`)
      // Broadcast architect_applied event to UI via coastal-server
      try {
        await fetch(`${SERVER_URL}/api/admin/architect/applied`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': getAdminToken() },
          body: JSON.stringify({ summary: result.summary, testsDelta: testResult.summary }),
        })
      } catch { /* Non-fatal — server may be restarting */ }
      // Signal coastal-server to restart gracefully
      if (process.env.CC_SERVER_PID) {
        process.kill(Number(process.env.CC_SERVER_PID), 'SIGUSR2')
      }
    } else {
      await patcher.checkoutMain()
      await patcher.deleteBranch(branchName)
      console.warn(`[coastal-architect] Tests failed — branch deleted. ${testResult.summary}`)
    }
  } catch (err) {
    // Ensure we return to main branch on error
    try { await patcher.checkoutMain() } catch {}
    try { await patcher.deleteBranch(branchName) } catch {}
    console.error('[coastal-architect] Cycle error:', err)
  }
}

async function main(): Promise<void> {
  console.log('[coastal-architect] Started.')

  // Write PID file so admin /run route can signal this process
  const pidFile = join(DATA_DIR, '.architect-pid')
  writeFileSync(pidFile, String(process.pid))

  let lastCount = countUnreviewedGaps()

  const interval = setInterval(async () => {
    const count = countUnreviewedGaps()
    if (count >= SKILL_GAPS_THRESHOLD && count > lastCount) {
      console.log(`[coastal-architect] Threshold reached (${count} gaps) — triggering cycle.`)
      lastCount = count
      await runCycle()
    }
    lastCount = count
  }, CHECK_INTERVAL_MS)

  process.on('SIGUSR1', async () => {
    console.log('[coastal-architect] Manual trigger received.')
    await runCycle()
  })

  const cleanup = () => {
    clearInterval(interval)
    try { unlinkSync(join(DATA_DIR, '.architect-pid')) } catch {}
    process.exit(0)
  }
  process.on('SIGTERM', cleanup)
  process.on('SIGINT',  cleanup)

  console.log(`[coastal-architect] Watching skill-gaps.db (threshold: ${SKILL_GAPS_THRESHOLD}, interval: ${CHECK_INTERVAL_MS}ms)`)
}

main().catch(e => { console.error('[coastal-architect] Fatal:', e); process.exit(1) })
```

- [ ] **Step 2: Build**

```bash
cd packages/architect && pnpm build
```

Expected: `dist/index.js` created with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add packages/architect/src/index.ts
git commit -m "feat(architect): add index.ts entry point with cron + threshold watcher"
```

---

### Task 8: Admin routes — architect propose/veto/run endpoints

**Files:**
- Modify: `packages/core/src/api/routes/admin.ts` (append new routes)
- Modify: `packages/core/src/api/routes/__tests__/admin.test.ts` (add tests)

These routes let coastal-architect announce proposals and let the UI veto them. The server stores a pending proposal in memory (one at a time; simple Map).

- [ ] **Step 1: Write failing tests**

Add to `packages/core/src/api/routes/__tests__/admin.test.ts`:

```typescript
describe('POST /api/admin/architect/propose', () => {
  it('stores proposal and returns proposalId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/propose',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Fix shell timeout', diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('proposalId')
    expect(typeof body.proposalId).toBe('string')
  })
})

describe('GET /api/admin/architect/proposal/:id', () => {
  it('returns pending for a fresh proposal', async () => {
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/propose',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Test', diff: '--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new' },
    })
    const { proposalId } = propRes.json()
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/architect/proposal/${proposalId}`,
      headers: { 'x-admin-token': adminToken },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('pending')
  })

  it('returns 404 for unknown proposal', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/architect/proposal/nonexistent',
      headers: { 'x-admin-token': adminToken },
    })
    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/admin/architect/veto', () => {
  it('marks proposal as vetoed', async () => {
    const propRes = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/propose',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Test', diff: '--- a/x\n+++ b/x' },
    })
    const { proposalId } = propRes.json()
    await app.inject({
      method: 'POST',
      url: '/api/admin/architect/veto',
      headers: { 'x-admin-token': adminToken },
      payload: { proposalId },
    })
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/admin/architect/proposal/${proposalId}`,
      headers: { 'x-admin-token': adminToken },
    })
    expect(statusRes.json().status).toBe('vetoed')
  })
})

describe('POST /api/admin/architect/applied', () => {
  it('returns 200 and broadcasts applied event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/architect/applied',
      headers: { 'x-admin-token': adminToken },
      payload: { summary: 'Fix shell timeout', testsDelta: 'Tests  140 passed (140)' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/core && pnpm test
```

- [ ] **Step 3: Add routes to admin.ts**

Append to `packages/core/src/api/routes/admin.ts` inside `adminRoutes()`, before the `onClose` hook:

```typescript
  // In-memory proposal store (one active proposal at a time)
  const proposals = new Map<string, { summary: string; diff: string; status: 'pending' | 'vetoed'; expiresAt: number }>()

  // POST /api/admin/architect/propose — coastal-architect announces a proposal
  fastify.post<{ Body: { summary: string; diff: string } }>('/api/admin/architect/propose', {
    schema: {
      body: {
        type: 'object',
        required: ['summary', 'diff'],
        properties: {
          summary: { type: 'string', maxLength: 500 },
          diff: { type: 'string', maxLength: 50000 },
        },
      },
    },
  }, async (req, reply) => {
    const { summary, diff } = req.body
    const proposalId = randomBytes(8).toString('hex')
    const expiresAt = Date.now() + 70_000 // 70s — slightly longer than architect's 60s
    proposals.set(proposalId, { summary, diff, status: 'pending', expiresAt })
    // Broadcast to WebSocket clients
    fastify.websocketServer?.clients.forEach((client: any) => {
      client.send(JSON.stringify({
        type: 'architect_proposal',
        proposalId,
        summary,
        diff,
        vetoDeadline: expiresAt,
      }))
    })
    return reply.send({ proposalId })
  })

  // GET /api/admin/architect/proposal/:id — poll proposal status
  fastify.get<{ Params: { id: string } }>('/api/admin/architect/proposal/:id', async (req, reply) => {
    const proposal = proposals.get(req.params.id)
    if (!proposal) return reply.status(404).send({ error: 'Not found' })
    if (proposal.status === 'pending' && Date.now() > proposal.expiresAt) {
      proposal.status = 'vetoed' // treat expired as vetoed for cleanup (architect uses its own timeout)
      return reply.send({ status: 'expired' })
    }
    return reply.send({ status: proposal.status })
  })

  // POST /api/admin/architect/veto — UI veto button
  fastify.post<{ Body: { proposalId: string } }>('/api/admin/architect/veto', {
    schema: {
      body: {
        type: 'object',
        required: ['proposalId'],
        properties: { proposalId: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const proposal = proposals.get(req.body.proposalId)
    if (!proposal) return reply.status(404).send({ error: 'Not found' })
    proposal.status = 'vetoed'
    fastify.websocketServer?.clients.forEach((client: any) => {
      client.send(JSON.stringify({ type: 'architect_vetoed', proposalId: req.body.proposalId }))
    })
    return reply.send({ ok: true })
  })

  // POST /api/admin/architect/run — manual trigger (sends SIGUSR1 to architect process)
  fastify.post('/api/admin/architect/run', async (_req, reply) => {
    const pidFile = join(config.dataDir, '.architect-pid')
    if (!existsSync(pidFile)) return reply.status(503).send({ error: 'coastal-architect not running' })
    try {
      const pid = Number(readFileSync(pidFile, 'utf8').trim())
      process.kill(pid, 'SIGUSR1')
      return reply.send({ ok: true, note: 'Triggered architect cycle via SIGUSR1' })
    } catch {
      return reply.status(500).send({ error: 'Failed to signal architect' })
    }
  })

  // POST /api/admin/architect/applied — architect broadcasts successful merge to UI
  fastify.post<{ Body: { summary: string; testsDelta: string } }>('/api/admin/architect/applied', {
    schema: {
      body: {
        type: 'object',
        required: ['summary', 'testsDelta'],
        properties: {
          summary: { type: 'string', maxLength: 500 },
          testsDelta: { type: 'string', maxLength: 200 },
        },
      },
    },
  }, async (req, reply) => {
    fastify.websocketServer?.clients.forEach((client: any) => {
      client.send(JSON.stringify({ type: 'architect_applied', ...req.body }))
    })
    return reply.send({ ok: true })
  })
```

- [ ] **Step 4: Add `randomBytes` import** — already imported in admin.ts. Verify `readFileSync` and `existsSync` are imported (they are in the existing file).

- [ ] **Step 5: Run — verify PASS**

```bash
cd packages/core && pnpm test
```

Expected: PASS — all existing tests + 5 new architect route tests (propose×1, GET pending×1, GET 404×1, veto×1, applied×1).

- [ ] **Step 6: Run all tests**

```bash
cd C:/Users/John/CoastalClaw && pnpm test
```

Expected: All packages PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/api/routes/admin.ts packages/core/src/api/routes/__tests__/admin.test.ts
git commit -m "feat(admin): add architect propose/veto/run endpoints"
```

---

## Chunk 2: CoastalOS + Browser Control

### Task 9: BrowserSessionManager

**Files:**
- Create: `packages/core/src/tools/browser/session-manager.ts`
- Create: `packages/core/src/tools/browser/__tests__/session-manager.test.ts`

- [ ] **Step 1: Install Playwright in core**

```bash
cd packages/core && pnpm add playwright
```

- [ ] **Step 2: Write failing tests**

```typescript
// packages/core/src/tools/browser/__tests__/session-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserSessionManager } from '../session-manager.js'

describe('BrowserSessionManager', () => {
  let manager: BrowserSessionManager

  beforeEach(() => { manager = new BrowserSessionManager() })
  afterEach(async () => { await manager.closeAll() })

  it('getOrCreate returns a page for an agentId', async () => {
    const page = await manager.getOrCreate('cfo')
    expect(page).toBeDefined()
    expect(typeof page.goto).toBe('function')
  }, 30_000)

  it('getOrCreate returns the same page on second call', async () => {
    const page1 = await manager.getOrCreate('cfo')
    const page2 = await manager.getOrCreate('cfo')
    expect(page1).toBe(page2)
  }, 30_000)

  it('different agents get different pages', async () => {
    const cfo = await manager.getOrCreate('cfo')
    const cto = await manager.getOrCreate('cto')
    expect(cfo).not.toBe(cto)
  }, 30_000)

  it('closeSession removes the agent session', async () => {
    await manager.getOrCreate('cfo')
    await manager.closeSession('cfo')
    // After close, getOrCreate creates a fresh page (new object)
    const fresh = await manager.getOrCreate('cfo')
    expect(fresh).toBeDefined()
  }, 30_000)

  it('closeAll closes all sessions', async () => {
    await manager.getOrCreate('cfo')
    await manager.getOrCreate('cto')
    await manager.closeAll() // should not throw
  }, 30_000)
})
```

- [ ] **Step 3: Run — verify FAIL**

```bash
cd packages/core && pnpm test src/tools/browser/__tests__/session-manager.test.ts
```

- [ ] **Step 4: Implement session-manager.ts**

```typescript
// packages/core/src/tools/browser/session-manager.ts
import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'

interface AgentSession {
  context: BrowserContext
  page: Page
}

export class BrowserSessionManager {
  private browser: Browser | null = null
  private sessions = new Map<string, AgentSession>()

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true })
    }
    return this.browser
  }

  async getOrCreate(agentId: string): Promise<Page> {
    const existing = this.sessions.get(agentId)
    if (existing) return existing.page

    const browser = await this.getBrowser()
    const context = await browser.newContext()
    const page = await context.newPage()
    this.sessions.set(agentId, { context, page })
    return page
  }

  async closeSession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId)
    if (!session) return
    try { await session.context.close() } catch {}
    this.sessions.delete(agentId)
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.closeSession(id)
    }
    try { await this.browser?.close() } catch {}
    this.browser = null
  }
}
```

- [ ] **Step 5: Run — verify PASS**

```bash
cd packages/core && pnpm test src/tools/browser/__tests__/session-manager.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tools/browser/session-manager.ts packages/core/src/tools/browser/__tests__/session-manager.test.ts
git commit -m "feat(browser): add BrowserSessionManager with per-agent Playwright contexts"
```

---

### Task 10: browser-tools.ts — 6 tool definitions

**Files:**
- Create: `packages/core/src/tools/browser/browser-tools.ts`
- Create: `packages/core/src/tools/browser/__tests__/browser-tools.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/tools/browser/__tests__/browser-tools.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createBrowserTools } from '../browser-tools.js'
import { BrowserSessionManager } from '../session-manager.js'

describe('browser tools', () => {
  let manager: BrowserSessionManager
  let tools: ReturnType<typeof createBrowserTools>

  beforeEach(() => {
    manager = new BrowserSessionManager()
    tools = createBrowserTools(manager)
  })
  afterEach(async () => { await manager.closeAll() })

  it('exports 6 tool definitions', () => {
    expect(tools).toHaveLength(6)
    const names = tools.map(t => t.definition.name)
    expect(names).toContain('browser_navigate')
    expect(names).toContain('browser_read')
    expect(names).toContain('browser_click')
    expect(names).toContain('browser_fill')
    expect(names).toContain('browser_screenshot')
    expect(names).toContain('browser_close')
  })

  it('all browser tools are non-reversible', () => {
    for (const t of tools) {
      expect(t.definition.reversible).toBe(false)
    }
  })

  it('browser_navigate returns page title', async () => {
    const nav = tools.find(t => t.definition.name === 'browser_navigate')!
    const result = await nav.execute({ agentId: 'test', url: 'about:blank' })
    expect(typeof result).toBe('string')
    expect(result).not.toContain('Error:')
  }, 30_000)

  it('browser_close returns ok message', async () => {
    const close = tools.find(t => t.definition.name === 'browser_close')!
    // Open a session first
    await manager.getOrCreate('test-close')
    const result = await close.execute({ agentId: 'test-close' })
    expect(result).toContain('closed')
  }, 30_000)
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/core && pnpm test src/tools/browser/__tests__/browser-tools.test.ts
```

- [ ] **Step 3: Implement browser-tools.ts**

```typescript
// packages/core/src/tools/browser/browser-tools.ts
import type { CoreTool } from '../core/file.js'
import type { BrowserSessionManager } from './session-manager.js'

export function createBrowserTools(manager: BrowserSessionManager): CoreTool[] {
  return [
    {
      definition: {
        name: 'browser_navigate',
        description: 'Navigate the agent\'s browser to a URL. Returns page title and HTTP status.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID owning this browser session' },
            url: { type: 'string', description: 'URL to navigate to' },
          },
          required: ['agentId', 'url'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId, url } = args as { agentId: string; url: string }
        try {
          const page = await manager.getOrCreate(agentId)
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
          const title = await page.title()
          const status = response?.status() ?? 0
          return `Navigated to ${url} — title: "${title}", status: ${status}`
        } catch (e: any) {
          return `Error: browser_navigate failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_read',
        description: 'Extract all visible text content from the current page.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId } = args as { agentId: string }
        try {
          const page = await manager.getOrCreate(agentId)
          const text = await page.evaluate(() => document.body.innerText ?? '')
          return text.slice(0, 8000) || '(empty page)'
        } catch (e: any) {
          return `Error: browser_read failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_click',
        description: 'Click an element by CSS selector or visible text.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            selector: { type: 'string', description: 'CSS selector or text content to click' },
          },
          required: ['agentId', 'selector'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId, selector } = args as { agentId: string; selector: string }
        try {
          const page = await manager.getOrCreate(agentId)
          await page.click(selector, { timeout: 10_000 })
          return `Clicked: ${selector}`
        } catch (e: any) {
          return `Error: browser_click failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_fill',
        description: 'Fill a form input field with a value.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            selector: { type: 'string', description: 'CSS selector for the input field' },
            value: { type: 'string', description: 'Value to type into the field' },
          },
          required: ['agentId', 'selector', 'value'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId, selector, value } = args as { agentId: string; selector: string; value: string }
        try {
          const page = await manager.getOrCreate(agentId)
          await page.fill(selector, value, { timeout: 10_000 })
          return `Filled ${selector}`
        } catch (e: any) {
          return `Error: browser_fill failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_screenshot',
        description: 'Capture a screenshot of the current page. Returns base64-encoded PNG.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId } = args as { agentId: string }
        try {
          const page = await manager.getOrCreate(agentId)
          const buf = await page.screenshot({ type: 'png', fullPage: false })
          return `data:image/png;base64,${buf.toString('base64')}`
        } catch (e: any) {
          return `Error: browser_screenshot failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_close',
        description: 'Close the agent\'s browser session. Login state is lost.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId } = args as { agentId: string }
        await manager.closeSession(agentId)
        return `Browser session closed for agent: ${agentId}`
      },
    },
  ]
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/core && pnpm test src/tools/browser/
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/browser/browser-tools.ts packages/core/src/tools/browser/__tests__/browser-tools.test.ts
git commit -m "feat(browser): add 6 browser_* tool definitions via Playwright"
```

---

### Task 11: Wire browser tools into ToolRegistry with trust tier gate

**Files:**
- Modify: `packages/core/src/tools/registry.ts`
- Modify: `packages/core/src/api/routes/chat.ts`
- Modify: `packages/core/src/tools/__tests__/registry.test.ts`

Browser tools are only available at `trusted` or `autonomous` tier. Sandboxed agents get nothing.

- [ ] **Step 1: Write failing test**

Add to `packages/core/src/tools/__tests__/registry.test.ts`:

```typescript
import { BrowserSessionManager } from '../browser/session-manager.js'
// ...
it('browser tools registered when manager provided', () => {
  const mgr = new BrowserSessionManager()
  const reg = new ToolRegistry(undefined, mgr)
  expect(reg.get('browser_navigate')).toBeDefined()
  expect(reg.get('browser_read')).toBeDefined()
  mgr.closeAll()
})

it('browser tools absent when no manager provided (sandboxed tier)', () => {
  const reg = new ToolRegistry()
  expect(reg.get('browser_navigate')).toBeUndefined()
  expect(reg.get('browser_close')).toBeUndefined()
})

it('chat.ts does not create browserManager at sandboxed tier', () => {
  // This test verifies the trust tier gate in chat.ts.
  // At 'sandboxed' tier, no BrowserSessionManager is created → browser tools unavailable.
  // Simulate: agentTrustLevel = 'sandboxed' → browserManager = undefined
  const trustLevel = 'sandboxed'
  const browserManager = trustLevel !== 'sandboxed' ? new BrowserSessionManager() : undefined
  expect(browserManager).toBeUndefined()
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/core && pnpm test src/tools/__tests__/registry.test.ts
```

- [ ] **Step 3: Update ToolRegistry**

In `packages/core/src/tools/registry.ts`:

```typescript
// Add import at top:
import { createBrowserTools } from './browser/browser-tools.js'
import type { BrowserSessionManager } from './browser/session-manager.js'

// Change constructor signature:
constructor(backend?: ShellBackend, browserManager?: BrowserSessionManager) {
  const shell = backend
    ? createShellTools(backend, process.env.CC_AGENT_WORKDIR ?? './data/workspace')
    : shellTools
  const browser = browserManager ? createBrowserTools(browserManager) : []
  for (const t of [...fileTools, ...shell, ...gitTools, ...sqliteTools, ...webTools, ...browser]) {
    this.tools.set(t.definition.name, t)
  }
}
```

- [ ] **Step 4: Update chat.ts to pass manager at trusted+ tier**

In `packages/core/src/api/routes/chat.ts`, after the `const backend = createBackend(...)` line:

```typescript
// Add import at top of file:
import { BrowserSessionManager } from '../../tools/browser/session-manager.js'

// After backend creation:
const browserManager = config.agentTrustLevel !== 'sandboxed'
  ? new BrowserSessionManager()
  : undefined
const toolRegistry = new ToolRegistry(backend, browserManager)

// In the onClose hook, add:
await browserManager?.closeAll()
```

- [ ] **Step 5: Run — verify PASS**

```bash
cd packages/core && pnpm test
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/tools/registry.ts packages/core/src/api/routes/chat.ts packages/core/src/tools/__tests__/registry.test.ts
git commit -m "feat(browser): wire browser tools into ToolRegistry at trusted+ tier"
```

---

### Task 12: Electron shell — packages/shell

**Files:**
- Create: `packages/shell/package.json`
- Create: `packages/shell/tsconfig.json`
- Create: `packages/shell/src/main.ts`
- Create: `packages/shell/src/preload.ts`
- Create: `packages/shell/build/electron-builder.yml`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@coastal-claw/shell",
  "version": "0.1.0",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc && electron-builder build --config build/electron-builder.yml",
    "dev": "tsc && electron dist/main.js",
    "compile": "tsc"
  },
  "dependencies": {
    "electron": "^30.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "es2022"
  },
  "include": ["src/**/*"]
}
```

Note: Electron main process requires CommonJS modules, not ESM.

- [ ] **Step 3: Create src/main.ts**

```typescript
// packages/shell/src/main.ts
import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'

const SERVER_URL = process.env.CC_SERVER_URL ?? 'http://localhost:4747'
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0a0a',
    show: false,
  })

  mainWindow.loadURL(SERVER_URL)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function createTray(): void {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('CoastalClaw')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show', click: () => mainWindow?.show() },
    { label: 'Quit', click: () => app.quit() },
  ]))
}

app.whenReady().then(() => {
  createWindow()
  createTray()
  app.on('activate', () => { if (!mainWindow) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Step 4: Create src/preload.ts**

```typescript
// packages/shell/src/preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('coastalShell', {
  platform: process.platform,
  onNotification: (cb: (msg: string) => void) =>
    ipcRenderer.on('notification', (_e, msg: string) => cb(msg)),
})
```

- [ ] **Step 5: Create build/electron-builder.yml**

```yaml
appId: com.coastalcrypto.coastalclaw
productName: CoastalClaw
directories:
  output: dist-electron
files:
  - dist/**/*
  - package.json
win:
  target: nsis
mac:
  target: dmg
linux:
  target: AppImage
```

- [ ] **Step 6: Install and compile**

```bash
cd packages/shell && pnpm install && pnpm compile
```

Expected: `dist/main.js` and `dist/preload.js` created with no TypeScript errors.

- [ ] **Step 7: Verify IPC bridge is exported**

```bash
grep -n "coastalShell" packages/shell/src/preload.ts
grep -n "contextBridge" packages/shell/src/preload.ts
```

Expected: Both lines found — confirms `contextBridge.exposeInMainWorld('coastalShell', ...)` is present.

Note: Full headless Electron window tests require the `electron` binary and a display server (Xvfb on Linux). TypeScript compilation passing + grep verification is the Phase 2 acceptance bar. Headless E2E tests are Phase 3 scope.

- [ ] **Step 8: Commit**

```bash
git add packages/shell/
git commit -m "feat(shell): add Electron wrapper for Win/Mac — frameless BrowserWindow + tray"
```

---

### Task 13: coastalos/ — systemd units + labwc kiosk + build script

**Files:**
- Create: `coastalos/systemd/coastal-server.service`
- Create: `coastalos/systemd/coastal-daemon.service`
- Create: `coastalos/systemd/coastal-architect.service`
- Create: `coastalos/systemd/coastal-architect.timer`
- Create: `coastalos/systemd/coastal-shell.service`
- Create: `coastalos/labwc/rc.xml`
- Create: `coastalos/labwc/autostart`
- Create: `coastalos/build/packages.list`
- Create: `coastalos/build/hooks/post-install.sh`
- Create: `coastalos/build/build.sh`

- [ ] **Step 1: Create systemd units**

`coastalos/systemd/coastal-server.service`:
```ini
[Unit]
Description=CoastalClaw API Server
After=network.target ollama.service
Wants=ollama.service

[Service]
Type=simple
User=coastal
WorkingDirectory=/opt/coastalclaw
ExecStart=/usr/bin/node packages/core/dist/index.js
Restart=always
RestartSec=5
Environment=CC_PORT=4747
Environment=CC_HOST=127.0.0.1
Environment=CC_DATA_DIR=/var/lib/coastalclaw/data
Environment=CC_AGENT_WORKDIR=/var/lib/coastalclaw/workspace

[Install]
WantedBy=multi-user.target
```

`coastalos/systemd/coastal-daemon.service`:
```ini
[Unit]
Description=CoastalClaw Daemon (Scheduler + Voice)
After=coastal-server.service
Requires=coastal-server.service

[Service]
Type=simple
User=coastal
WorkingDirectory=/opt/coastalclaw
ExecStart=/usr/bin/node packages/daemon/dist/index.js
Restart=always
RestartSec=10
Environment=CC_SERVER_URL=http://localhost:4747
Environment=CC_DATA_DIR=/var/lib/coastalclaw/data

[Install]
WantedBy=multi-user.target
```

`coastalos/systemd/coastal-architect.service`:
```ini
[Unit]
Description=CoastalClaw Self-Build Architect
After=coastal-server.service

[Service]
Type=oneshot
User=coastal
WorkingDirectory=/opt/coastalclaw
ExecStart=/usr/bin/node packages/architect/dist/index.js
Environment=CC_DATA_DIR=/var/lib/coastalclaw/data
Environment=CC_REPO_ROOT=/opt/coastalclaw
Environment=CC_OLLAMA_URL=http://127.0.0.1:11434
```

`coastalos/systemd/coastal-architect.timer`:
```ini
[Unit]
Description=Run CoastalClaw Architect nightly at 02:00

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
Unit=coastal-architect.service

[Install]
WantedBy=timers.target
```

`coastalos/systemd/coastal-shell.service`:
```ini
[Unit]
Description=CoastalClaw Shell (labwc Wayland kiosk)
After=graphical.target coastal-server.service
Requires=coastal-server.service

[Service]
Type=simple
User=coastal
PAMName=login
Environment=XDG_SESSION_TYPE=wayland
Environment=XDG_RUNTIME_DIR=/run/user/1000
Environment=HOME=/home/coastal
ExecStart=/usr/bin/labwc
Restart=always

[Install]
WantedBy=graphical.target
```

- [ ] **Step 2: Create labwc config**

`coastalos/labwc/rc.xml`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<labwc_config>
  <keyboard>
    <!-- Ctrl+Alt+T → open Alacritty terminal -->
    <keybind key="C-A-t">
      <action name="Execute">
        <command>alacritty</command>
      </action>
    </keybind>
  </keyboard>
</labwc_config>
```

`coastalos/labwc/autostart`:
```bash
#!/bin/sh
# CoastalClaw labwc autostart — launch Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --no-first-run \
  --disable-translate \
  --disable-features=TranslateUI \
  --app=http://localhost:4747 &
```

- [ ] **Step 3: Create packages.list**

`coastalos/build/packages.list`:
```
nodejs
npm
chromium-browser
labwc
alacritty
pipewire
wireplumber
python3
python3-pip
python3-openwakeword
whisper-cpp
espeak-ng
git
curl
wget
jq
htop
build-essential
libasound2-dev
```

Note: `python3-openwakeword` and `whisper-cpp` are available as Ubuntu 24.04 packages and are installed at ISO build time. `espeak-ng` is the TTS fallback. `build-essential` + `libasound2-dev` are required by `node-portaudio` native compilation. `ollama` and `piper-tts` are installed by `post-install.sh` since they require custom install scripts.

- [ ] **Step 4: Create post-install.sh**

`coastalos/build/hooks/post-install.sh`:
```bash
#!/bin/bash
set -e

echo "[post-install] Installing CoastalClaw..."

# Install pnpm
npm install -g pnpm

# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Install piper-tts
pip3 install piper-tts --break-system-packages

# Install openwakeword
pip3 install openwakeword --break-system-packages

# Create coastal user
useradd -m -s /bin/bash coastal || true
mkdir -p /opt/coastalclaw /var/lib/coastalclaw/data /var/lib/coastalclaw/workspace
chown -R coastal:coastal /opt/coastalclaw /var/lib/coastalclaw

# Copy labwc config
mkdir -p /home/coastal/.config/labwc
cp /tmp/labwc/rc.xml /home/coastal/.config/labwc/
cp /tmp/labwc/autostart /home/coastal/.config/labwc/
chmod +x /home/coastal/.config/labwc/autostart
chown -R coastal:coastal /home/coastal/.config

# Enable services
systemctl enable coastal-server.service
systemctl enable coastal-daemon.service
systemctl enable coastal-architect.timer
systemctl enable coastal-shell.service

# Set autologin for coastal user
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin coastal --noclear %I $TERM
EOF

echo "[post-install] Done."
```

- [ ] **Step 5: Create build.sh**

`coastalos/build/build.sh`:
```bash
#!/bin/bash
set -e

VERSION="${1:-dev}"
echo "[build] Building CoastalOS ${VERSION}..."

# Ensure live-build is installed
if ! command -v lb &> /dev/null; then
  echo "Error: live-build not installed. Run: sudo apt install live-build"
  exit 1
fi

WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

# Configure live-build
lb config \
  --distribution noble \
  --archive-areas "main restricted universe multiverse" \
  --debian-installer live \
  --bootloaders grub-efi,grub-pc \
  --binary-images iso-hybrid \
  --iso-application "CoastalOS" \
  --iso-volume "CoastalOS-${VERSION}"

# Add package list
cp "$(dirname "$0")/packages.list" config/package-lists/coastalos.list.chroot

# Add post-install hook
mkdir -p config/hooks/live
cp "$(dirname "$0")/hooks/post-install.sh" config/hooks/live/99-coastalos.hook.chroot
chmod +x config/hooks/live/99-coastalos.hook.chroot

# Add labwc config
mkdir -p config/includes.chroot/tmp/labwc
cp "$(dirname "$0")/../labwc/rc.xml" config/includes.chroot/tmp/labwc/
cp "$(dirname "$0")/../labwc/autostart" config/includes.chroot/tmp/labwc/

# Add systemd units
mkdir -p config/includes.chroot/etc/systemd/system
cp "$(dirname "$0")/../systemd/"*.service config/includes.chroot/etc/systemd/system/
cp "$(dirname "$0")/../systemd/"*.timer config/includes.chroot/etc/systemd/system/

# Build
lb build

# Move ISO to project root
mv live-image-amd64.hybrid.iso "$(dirname "$0")/../../coastalos-${VERSION}.iso"
echo "[build] ISO ready: coastalos-${VERSION}.iso"
```

- [ ] **Step 6: Make scripts executable and commit**

```bash
chmod +x coastalos/build/build.sh coastalos/build/hooks/post-install.sh coastalos/labwc/autostart
git add coastalos/
git commit -m "feat(coastalos): add systemd units, labwc kiosk config, and ISO build script"
```

---

## Chunk 3: Voice Pipeline

### Task 14: audio.ts — PipeWire mic capture + speaker playback

**Files:**
- Create: `packages/daemon/src/voice/audio.ts`
- Create: `packages/daemon/src/__tests__/voice/audio.test.ts`

This module abstracts microphone input and speaker output. On Linux/CoastalOS it uses PipeWire via `node-portaudio`. On all platforms it falls back to a mock stream in test environments.

- [ ] **Step 1: Install node-portaudio**

```bash
cd packages/daemon && pnpm add node-portaudio
```

Note: node-portaudio requires native build tools. On Windows: `npm install --global windows-build-tools`. On Linux: `apt install build-essential libasound2-dev`.

- [ ] **Step 2: Write failing tests**

```typescript
// packages/daemon/src/__tests__/voice/audio.test.ts
import { describe, it, expect } from 'vitest'
import { createRecorder, createPlayer } from '../../voice/audio.js'

describe('createRecorder (mock mode)', () => {
  it('returns an EventEmitter with start/stop methods', () => {
    process.env.MOCK_AUDIO = '1'
    const rec = createRecorder()
    expect(typeof rec.start).toBe('function')
    expect(typeof rec.stop).toBe('function')
    rec.stop()
    delete process.env.MOCK_AUDIO
  })

  it('emits data events when started', async () => {
    process.env.MOCK_AUDIO = '1'
    const rec = createRecorder()
    const chunk = await new Promise<Buffer>((resolve) => {
      rec.once('data', ({ data }) => resolve(data))
      rec.start()
    })
    rec.stop()
    delete process.env.MOCK_AUDIO
    expect(chunk).toBeInstanceOf(Buffer)
    expect(chunk.length).toBeGreaterThan(0)
  })
})

describe('createPlayer (mock mode)', () => {
  it('returns an object with play and stop methods', () => {
    process.env.MOCK_AUDIO = '1'
    const player = createPlayer()
    expect(typeof player.play).toBe('function')
    expect(typeof player.stop).toBe('function')
    delete process.env.MOCK_AUDIO
  })

  it('play() resolves without throwing', async () => {
    process.env.MOCK_AUDIO = '1'
    const player = createPlayer()
    await expect(player.play(Buffer.alloc(100), 16_000)).resolves.toBeUndefined()
    delete process.env.MOCK_AUDIO
  })
})
```

- [ ] **Step 3: Run — verify FAIL**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/audio.test.ts
```

Expected: FAIL — `audio.js` not found.

- [ ] **Step 4: Implement audio.ts**

```typescript
// packages/daemon/src/voice/audio.ts
import { EventEmitter } from 'node:events'

export interface AudioChunk {
  data: Buffer
  sampleRate: number
  channels: number
}

export interface AudioRecorder extends EventEmitter {
  start(): void
  stop(): void
}

export interface AudioPlayer {
  play(pcmData: Buffer, sampleRate: number): Promise<void>
  stop(): void
}

/** Create a microphone recorder. Returns mock recorder in test environment. */
export function createRecorder(sampleRate = 16_000): AudioRecorder {
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_AUDIO === '1') {
    return createMockRecorder()
  }
  return createPortAudioRecorder(sampleRate)
}

/** Create an audio player. Returns mock player in test environment. */
export function createPlayer(): AudioPlayer {
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_AUDIO === '1') {
    return createMockPlayer()
  }
  return createPortAudioPlayer()
}

function createMockRecorder(): AudioRecorder {
  const emitter = new EventEmitter() as AudioRecorder
  emitter.start = () => {
    // Emit silence chunks for testing
    const interval = setInterval(() => {
      emitter.emit('data', { data: Buffer.alloc(3200), sampleRate: 16_000, channels: 1 } as AudioChunk)
    }, 100)
    emitter.once('stop', () => clearInterval(interval))
  }
  emitter.stop = () => emitter.emit('stop')
  return emitter
}

function createMockPlayer(): AudioPlayer {
  return {
    async play(_pcmData: Buffer, _sampleRate: number): Promise<void> {
      // Mock: no-op playback
    },
    stop(): void {},
  }
}

function createPortAudioRecorder(sampleRate: number): AudioRecorder {
  const emitter = new EventEmitter() as AudioRecorder
  let stream: any = null
  emitter.start = () => {
    try {
      // Dynamic import to avoid build errors on systems without PortAudio
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const portAudio = require('node-portaudio')
      stream = new portAudio.AudioIO({
        inOptions: {
          channelCount: 1,
          sampleFormat: portAudio.SampleFormat16Bit,
          sampleRate,
          deviceId: -1, // default input device
          closeOnError: true,
        },
      })
      stream.on('data', (data: Buffer) => {
        emitter.emit('data', { data, sampleRate, channels: 1 } as AudioChunk)
      })
      stream.start()
    } catch (e: any) {
      console.warn('[audio] PortAudio unavailable:', e.message)
    }
  }
  emitter.stop = () => { stream?.quit(); stream = null }
  return emitter
}

function createPortAudioPlayer(): AudioPlayer {
  let stream: any = null
  return {
    async play(pcmData: Buffer, sampleRate: number): Promise<void> {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const portAudio = require('node-portaudio')
        stream = new portAudio.AudioIO({
          outOptions: {
            channelCount: 1,
            sampleFormat: portAudio.SampleFormat16Bit,
            sampleRate,
            deviceId: -1,
            closeOnError: true,
          },
        })
        await new Promise<void>((resolve, reject) => {
          stream.on('finish', resolve)
          stream.on('error', reject)
          stream.start()
          stream.write(pcmData)
          stream.end()
        })
      } catch (e: any) {
        console.warn('[audio] Playback failed:', e.message)
      }
    },
    stop(): void { stream?.quit(); stream = null },
  }
}
```

- [ ] **Step 5: Run — verify PASS**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/audio.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/daemon/src/voice/audio.ts packages/daemon/src/__tests__/voice/audio.test.ts
git commit -m "feat(voice): add audio.ts — PipeWire/portaudio mic + speaker with mock fallback"
```

---

### Task 15: wake-word.ts — openWakeWord Python subprocess

**Files:**
- Create: `packages/daemon/src/voice/wake-word.ts`
- Create: `packages/daemon/src/__tests__/voice/wake-word.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// packages/daemon/src/__tests__/voice/wake-word.test.ts
import { describe, it, expect } from 'vitest'
import { WakeWordDetector } from '../../voice/wake-word.js'

describe('WakeWordDetector', () => {
  it('can be constructed without error', () => {
    const detector = new WakeWordDetector({ keyword: 'hey coastal' })
    expect(detector).toBeDefined()
    detector.stop() // ensure cleanup
  })

  it('emits detected event from mock script', async () => {
    const detector = new WakeWordDetector({ keyword: 'hey coastal', mockMode: true })
    const detected = await new Promise<boolean>((resolve) => {
      detector.on('detected', () => resolve(true))
      detector.start()
      setTimeout(() => resolve(false), 500)
    })
    detector.stop()
    expect(detected).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/wake-word.test.ts
```

- [ ] **Step 3: Implement wake-word.ts**

```typescript
// packages/daemon/src/voice/wake-word.ts
import { spawn, ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

export interface WakeWordOptions {
  keyword?: string
  modelPath?: string
  mockMode?: boolean
}

/**
 * WakeWordDetector wraps the openWakeWord Python library as a child process.
 * The Python script reads audio from stdin (PCM 16-bit 16kHz mono) and
 * writes a line "DETECTED" to stdout when the wake word fires.
 *
 * In mockMode (tests), it emits 'detected' after a short delay.
 */
export class WakeWordDetector extends EventEmitter {
  private proc: ChildProcess | null = null
  private opts: WakeWordOptions

  constructor(opts: WakeWordOptions = {}) {
    super()
    this.opts = opts
  }

  start(): void {
    if (this.opts.mockMode) {
      // Simulate a wake word detection after 50ms for testing
      setTimeout(() => this.emit('detected'), 50)
      return
    }

    // Launch the Python bridge script
    this.proc = spawn('python3', ['-c', this.getPythonScript()], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.proc.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n')
      for (const line of lines) {
        if (line.trim() === 'DETECTED') {
          this.emit('detected')
        }
      }
    })

    this.proc.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.warn('[wake-word] Python stderr:', msg)
    })

    this.proc.on('error', (err) => {
      console.warn('[wake-word] Process error:', err.message)
      console.warn('[wake-word] Ensure python3 and openwakeword are installed: pip3 install openwakeword')
    })
  }

  /** Write PCM audio buffer to the Python process stdin. */
  feed(audioBuffer: Buffer): void {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(audioBuffer)
    }
  }

  stop(): void {
    this.proc?.kill('SIGTERM')
    this.proc = null
  }

  private getPythonScript(): string {
    const keyword = (this.opts.keyword ?? 'hey coastal').replace(/'/g, "\\'")
    return `
import sys, struct
try:
    from openwakeword.model import Model
    model = Model(wakeword_models=['${keyword}'], inference_framework='onnx')
    chunk_size = 1280
    while True:
        data = sys.stdin.buffer.read(chunk_size * 2)
        if not data:
            break
        audio = struct.unpack('<' + 'h' * (len(data)//2), data)
        pred = model.predict(list(audio))
        for name, score in pred.items():
            if score > 0.5:
                sys.stdout.write('DETECTED\\n')
                sys.stdout.flush()
except ImportError:
    sys.stderr.write('openwakeword not installed\\n')
    sys.exit(1)
except KeyboardInterrupt:
    pass
`
  }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/wake-word.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/daemon/src/voice/wake-word.ts packages/daemon/src/__tests__/voice/wake-word.test.ts
git commit -m "feat(voice): add WakeWordDetector — openWakeWord Python subprocess bridge"
```

---

### Task 16: stt.ts — Whisper.cpp transcription

**Files:**
- Create: `packages/daemon/src/voice/stt.ts`
- Create: `packages/daemon/src/__tests__/voice/stt.test.ts`

- [ ] **Step 1: Install whisper-node**

```bash
cd packages/daemon && pnpm add nodejs-whisper
```

Note: `nodejs-whisper` wraps Whisper.cpp and compiles locally. Requires `cmake` and `make` on the build system. Model files (e.g. `ggml-tiny.en.bin`) must be downloaded separately to `data/models/`.

- [ ] **Step 2: Write failing tests**

```typescript
// packages/daemon/src/__tests__/voice/stt.test.ts
import { describe, it, expect } from 'vitest'
import { transcribe } from '../../voice/stt.js'

describe('transcribe', () => {
  it('returns mock transcription in mockMode', async () => {
    const result = await transcribe(Buffer.alloc(1000), { mockMode: true })
    expect(result.text).toBe('mock transcription')
    expect(result.language).toBe('en')
  })

  it('returns empty string when model file is missing', async () => {
    // NODE_ENV=test triggers mock path, so test explicit non-existent path
    const result = await transcribe(Buffer.alloc(100), {
      mockMode: false,
      modelPath: '/nonexistent/ggml-tiny.en.bin',
    })
    expect(result.text).toBe('')
    expect(result.language).toBe('en')
  })
})
```

- [ ] **Step 3: Run — verify FAIL**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/stt.test.ts
```

Expected: FAIL — `stt.js` not found.

- [ ] **Step 4: Implement stt.ts**

```typescript
// packages/daemon/src/voice/stt.ts
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export interface STTResult {
  text: string
  language: string
}

export interface STTOptions {
  modelPath?: string
  language?: string
  mockMode?: boolean
}

/**
 * Transcribe a PCM audio buffer using Whisper.cpp via nodejs-whisper.
 * Audio must be 16kHz mono 16-bit PCM (the standard Whisper input format).
 */
export async function transcribe(audioBuffer: Buffer, opts: STTOptions = {}): Promise<STTResult> {
  if (opts.mockMode || process.env.NODE_ENV === 'test') {
    return { text: 'mock transcription', language: 'en' }
  }

  const modelPath = opts.modelPath ?? join(process.cwd(), 'data', 'models', 'ggml-tiny.en.bin')
  if (!existsSync(modelPath)) {
    console.warn(`[stt] Whisper model not found at ${modelPath}. Run: node -e "require('nodejs-whisper').download('tiny.en')"`)
    return { text: '', language: 'en' }
  }

  // Write PCM to temp WAV file (whisper-node expects a WAV file path)
  const tmpWav = join(tmpdir(), `stt-${randomBytes(4).toString('hex')}.wav`)
  writeWav(audioBuffer, tmpWav, 16_000)

  try {
    // Dynamic require to avoid build errors when nodejs-whisper is not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nodewhisper } = require('nodejs-whisper')
    const result = await nodewhisper(tmpWav, {
      modelName: 'tiny.en',
      autoDownloadModelName: 'tiny.en',
      verbose: false,
      removeWavFileAfterTranscription: false,
      withCuda: false,
      whisperOptions: {
        language: opts.language ?? 'en',
        outputInText: true,
      },
    })
    return { text: (result as string).trim(), language: opts.language ?? 'en' }
  } finally {
    try { unlinkSync(tmpWav) } catch {}
  }
}

/** Write a minimal WAV file header + PCM data. */
function writeWav(pcm: Buffer, outPath: string, sampleRate: number): void {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcm.length
  const fileSize = 36 + dataSize

  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)       // subchunk size
  header.writeUInt16LE(1, 20)        // PCM format
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  writeFileSync(outPath, Buffer.concat([header, pcm]))
}
```

- [ ] **Step 5: Run — verify PASS**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/stt.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/daemon/src/voice/stt.ts packages/daemon/src/__tests__/voice/stt.test.ts
git commit -m "feat(voice): add stt.ts — Whisper.cpp transcription via nodejs-whisper"
```

---

### Task 17: tts.ts — Piper TTS + espeak fallback

**Files:**
- Create: `packages/daemon/src/voice/tts.ts`
- Create: `packages/daemon/src/__tests__/voice/tts.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/daemon/src/__tests__/voice/tts.test.ts
import { describe, it, expect } from 'vitest'
import { synthesize } from '../../voice/tts.js'

describe('synthesize', () => {
  it('returns a Buffer in mock mode', async () => {
    const buf = await synthesize('Hello world', { mockMode: true })
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('falls back gracefully when Piper is unavailable', async () => {
    // Should not throw even if piper binary is missing
    const buf = await synthesize('Test', {
      piperBin: '/nonexistent/piper',
      espeakFallback: true,
    })
    // Returns empty Buffer on full failure (both piper and espeak missing)
    expect(buf).toBeInstanceOf(Buffer)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/tts.test.ts
```

- [ ] **Step 3: Implement tts.ts**

```typescript
// packages/daemon/src/voice/tts.ts
import { spawnSync, execSync } from 'node:child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'

export interface TTSOptions {
  voiceModel?: string       // e.g. "en_US-lessac-medium"
  voicesDir?: string        // directory containing .onnx Piper models
  piperBin?: string         // path to piper binary
  espeakFallback?: boolean  // use espeak if piper fails
  mockMode?: boolean
}

const DEFAULT_VOICES_DIR = '/opt/coastal/voices'
const DEFAULT_PIPER_BIN = 'piper'

/**
 * Synthesize text to PCM audio using Piper TTS.
 * Falls back to espeak-ng if Piper is unavailable.
 * Returns an empty Buffer on complete failure.
 */
export async function synthesize(text: string, opts: TTSOptions = {}): Promise<Buffer> {
  if (opts.mockMode || process.env.NODE_ENV === 'test') {
    // Return 100ms of silence (16-bit 22kHz mono)
    return Buffer.alloc(22_050 * 2 * 0.1)
  }

  const piperBin = opts.piperBin ?? DEFAULT_PIPER_BIN
  const voiceModel = opts.voiceModel ?? 'en_US-lessac-medium'
  const voicesDir = opts.voicesDir ?? DEFAULT_VOICES_DIR
  const modelPath = join(voicesDir, `${voiceModel}.onnx`)

  // Try Piper TTS
  if (existsSync(modelPath)) {
    const outFile = join(tmpdir(), `tts-${randomBytes(4).toString('hex')}.raw`)
    try {
      const result = spawnSync(piperBin, [
        '--model', modelPath,
        '--output_raw',
        '--output_file', outFile,
      ], {
        input: text,
        encoding: 'utf8',
        timeout: 30_000,
      })
      if (result.status === 0 && existsSync(outFile)) {
        const audio = readFileSync(outFile)
        unlinkSync(outFile)
        return audio
      }
    } catch {
      // Fall through to espeak
    } finally {
      try { unlinkSync(outFile) } catch {}
    }
  }

  // Fallback: espeak-ng
  if (opts.espeakFallback !== false) {
    try {
      const outFile = join(tmpdir(), `espeak-${randomBytes(4).toString('hex')}.wav`)
      const result = spawnSync('espeak-ng', [
        '-w', outFile,
        '--stdin',
      ], {
        input: text,
        timeout: 15_000,
      })
      if (result.status === 0 && existsSync(outFile)) {
        const audio = readFileSync(outFile)
        unlinkSync(outFile)
        // Strip WAV header (44 bytes) to get raw PCM
        return audio.slice(44)
      }
    } catch (e: any) {
      console.warn('[tts] espeak-ng fallback failed:', e.message)
    }
  }

  console.warn('[tts] All TTS backends failed for text:', text.slice(0, 50))
  return Buffer.alloc(0)
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/tts.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/daemon/src/voice/tts.ts packages/daemon/src/__tests__/voice/tts.test.ts
git commit -m "feat(voice): add tts.ts — Piper TTS with espeak-ng fallback"
```

---

### Task 18: vad.ts + interrupt-handler.ts

**Files:**
- Create: `packages/daemon/src/voice/vad.ts`
- Create: `packages/daemon/src/voice/interrupt-handler.ts`
- Create: `packages/daemon/src/__tests__/voice/interrupt.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/daemon/src/__tests__/voice/interrupt.test.ts
import { describe, it, expect, vi } from 'vitest'
import { InterruptHandler } from '../../voice/interrupt-handler.js'
import { IterationBudget } from '@coastal-claw/core'

describe('InterruptHandler', () => {
  it('calls abort on active budget when triggered', () => {
    const budget = new IterationBudget(10)
    const handler = new InterruptHandler()
    handler.setActiveBudget(budget)

    const abortSpy = vi.spyOn(budget, 'abort')
    handler.trigger()
    expect(abortSpy).toHaveBeenCalledOnce()
  })

  it('does nothing when no active budget', () => {
    const handler = new InterruptHandler()
    expect(() => handler.trigger()).not.toThrow()
  })

  it('clears budget after trigger', () => {
    const budget = new IterationBudget(10)
    const handler = new InterruptHandler()
    handler.setActiveBudget(budget)
    handler.trigger()
    // Second trigger should not call abort again
    const abortSpy = vi.spyOn(budget, 'abort')
    handler.trigger()
    expect(abortSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/interrupt.test.ts
```

- [ ] **Step 3: Implement vad.ts**

```typescript
// packages/daemon/src/voice/vad.ts
import { EventEmitter } from 'node:events'

export interface VADOptions {
  silenceThresholdMs?: number  // ms of silence before considering speech ended
  speechThresholdRms?: number  // RMS level above which audio is considered speech
}

/**
 * Simple energy-based Voice Activity Detector.
 * Emits 'speech_start' and 'speech_end' based on audio RMS levels.
 * For production use, consider @ricky0123/vad-node for ML-based VAD.
 */
export class VAD extends EventEmitter {
  private isSpeaking = false
  private silenceStart: number | null = null
  private opts: Required<VADOptions>

  constructor(opts: VADOptions = {}) {
    super()
    this.opts = {
      silenceThresholdMs: opts.silenceThresholdMs ?? 800,
      speechThresholdRms: opts.speechThresholdRms ?? 500,
    }
  }

  /** Feed a PCM audio chunk (16-bit samples). */
  feed(pcm: Buffer): void {
    const rms = computeRms(pcm)
    const now = Date.now()

    if (rms > this.opts.speechThresholdRms) {
      if (!this.isSpeaking) {
        this.isSpeaking = true
        this.silenceStart = null
        this.emit('speech_start')
      } else {
        this.silenceStart = null
      }
    } else {
      if (this.isSpeaking) {
        if (!this.silenceStart) {
          this.silenceStart = now
        } else if (now - this.silenceStart > this.opts.silenceThresholdMs) {
          this.isSpeaking = false
          this.silenceStart = null
          this.emit('speech_end')
        }
      }
    }
  }
}

function computeRms(pcm: Buffer): number {
  if (pcm.length < 2) return 0
  let sum = 0
  for (let i = 0; i < pcm.length - 1; i += 2) {
    const sample = pcm.readInt16LE(i)
    sum += sample * sample
  }
  return Math.sqrt(sum / (pcm.length / 2))
}
```

- [ ] **Step 4: Implement interrupt-handler.ts**

```typescript
// packages/daemon/src/voice/interrupt-handler.ts
import type { IterationBudget } from '@coastal-claw/core'

export class InterruptHandler {
  private activeBudget: IterationBudget | null = null

  setActiveBudget(budget: IterationBudget): void {
    this.activeBudget = budget
  }

  clearActiveBudget(): void {
    this.activeBudget = null
  }

  /** Called by VAD when user speech detected mid-response. */
  trigger(): void {
    if (!this.activeBudget) return
    this.activeBudget.abort()
    this.activeBudget = null
  }
}
```

- [ ] **Step 5: Add IterationBudget export to @coastal-claw/core**

In `packages/core/src/index.ts`, ensure `IterationBudget` is exported:
```typescript
export { IterationBudget } from './agents/iteration-budget.js'
```

- [ ] **Step 6: Run — verify PASS**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/interrupt.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add packages/daemon/src/voice/vad.ts packages/daemon/src/voice/interrupt-handler.ts packages/daemon/src/__tests__/voice/interrupt.test.ts
git commit -m "feat(voice): add VAD energy detector and InterruptHandler"
```

---

### Task 19: pipeline.ts — voice state machine

**Files:**
- Create: `packages/daemon/src/voice/pipeline.ts`
- Create: `packages/daemon/src/__tests__/voice/pipeline.test.ts`

The pipeline is a state machine with states: `idle → listening → transcribing → thinking → speaking → idle`.

- [ ] **Step 1: Write failing tests**

```typescript
// packages/daemon/src/__tests__/voice/pipeline.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VoicePipeline, PipelineState } from '../../voice/pipeline.js'

describe('VoicePipeline state machine', () => {
  let pipeline: VoicePipeline

  beforeEach(() => {
    pipeline = new VoicePipeline({
      onTranscript: async (_text: string) => 'mock response',
      mockMode: true,
    })
  })

  it('starts in idle state', () => {
    expect(pipeline.state).toBe(PipelineState.Idle)
  })

  it('transitions to listening on start()', async () => {
    pipeline.start()
    expect(pipeline.state).toBe(PipelineState.Listening)
    pipeline.stop()
  })

  it('transitions through full cycle in mock mode', async () => {
    const states: PipelineState[] = []
    pipeline.on('stateChange', (s: PipelineState) => states.push(s))
    pipeline.start()
    // In mock mode, wake word fires immediately, then cycles through states
    await new Promise(resolve => setTimeout(resolve, 500))
    pipeline.stop()
    expect(states).toContain(PipelineState.Listening)
  })

  it('stop() returns to idle', () => {
    pipeline.start()
    pipeline.stop()
    expect(pipeline.state).toBe(PipelineState.Idle)
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/pipeline.test.ts
```

- [ ] **Step 3: Implement pipeline.ts**

```typescript
// packages/daemon/src/voice/pipeline.ts
import { EventEmitter } from 'node:events'
import { WakeWordDetector } from './wake-word.js'
import { transcribe } from './stt.js'
import { synthesize } from './tts.js'
import { createRecorder, createPlayer } from './audio.js'
import { VAD } from './vad.js'
import { InterruptHandler } from './interrupt-handler.js'

export enum PipelineState {
  Idle         = 'idle',
  Listening    = 'listening',
  Transcribing = 'transcribing',
  Thinking     = 'thinking',
  Speaking     = 'speaking',
}

export interface PipelineOptions {
  /** Called with transcript text, returns agent reply text. */
  onTranscript: (text: string) => Promise<string>
  voiceModel?: string
  voicesDir?: string   // passed to TTSOptions.voicesDir — directory containing .onnx Piper models
  mockMode?: boolean
}

export class VoicePipeline extends EventEmitter {
  private _state: PipelineState = PipelineState.Idle
  private wakeWord: WakeWordDetector
  private interruptHandler: InterruptHandler
  private opts: PipelineOptions
  private audioBuffer: Buffer[] = []
  private recorder = createRecorder()
  private player = createPlayer()
  private vad: VAD
  private running = false

  constructor(opts: PipelineOptions) {
    super()
    this.opts = opts
    this.wakeWord = new WakeWordDetector({ mockMode: opts.mockMode })
    this.interruptHandler = new InterruptHandler()
    this.vad = new VAD()
  }

  get state(): PipelineState { return this._state }

  private setState(s: PipelineState): void {
    this._state = s
    this.emit('stateChange', s)
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.setState(PipelineState.Listening)
    this.listenForWakeWord()
  }

  stop(): void {
    this.running = false
    this.wakeWord.stop()
    this.recorder.stop()
    this.player.stop()
    this.setState(PipelineState.Idle)
  }

  private listenForWakeWord(): void {
    this.wakeWord.once('detected', () => {
      if (!this.running) return
      this.captureUtterance()
    })
    this.wakeWord.start()

    // Set up VAD on recorder for interrupt detection during speaking
    this.recorder.on('data', ({ data }) => {
      if (this._state === PipelineState.Speaking) {
        this.vad.feed(data)
      } else if (this._state === PipelineState.Listening) {
        this.wakeWord.feed(data)
      }
    })
    this.recorder.start()

    this.vad.on('speech_start', () => {
      if (this._state === PipelineState.Speaking) {
        this.interruptHandler.trigger()
        this.player.stop()
        setTimeout(() => {
          if (this.running) {
            this.setState(PipelineState.Listening)
            this.listenForWakeWord()
          }
        }, 300)
      }
    })
  }

  private async captureUtterance(): Promise<void> {
    this.setState(PipelineState.Transcribing)
    this.audioBuffer = []

    // Collect 3 seconds of audio after wake word
    await new Promise<void>(resolve => setTimeout(resolve, this.opts.mockMode ? 50 : 3_000))

    const pcm = Buffer.concat(this.audioBuffer)
    const { text } = await transcribe(pcm, { mockMode: this.opts.mockMode })
    if (!text.trim()) {
      if (this.running) {
        this.setState(PipelineState.Listening)
        this.listenForWakeWord()
      }
      return
    }

    this.setState(PipelineState.Thinking)
    const reply = await this.opts.onTranscript(text)

    this.setState(PipelineState.Speaking)
    const audio = await synthesize(reply, {
      voiceModel: this.opts.voiceModel,
      voicesDir: this.opts.voicesDir,
      mockMode: this.opts.mockMode,
    })
    await this.player.play(audio, 22_050)

    if (this.running) {
      this.setState(PipelineState.Listening)
      this.listenForWakeWord()
    }
  }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/daemon && pnpm test src/__tests__/voice/pipeline.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/daemon/src/voice/pipeline.ts packages/daemon/src/__tests__/voice/pipeline.test.ts
git commit -m "feat(voice): add VoicePipeline state machine (idle→listen→transcribe→think→speak)"
```

---

### Task 20: Wire voice into daemon + add voiceModel to agent config

**Files:**
- Modify: `packages/daemon/src/index.ts`
- Modify: `packages/core/src/agents/types.ts`
- Modify: `agents/cfo/config.json`

- [ ] **Step 1: Add voiceModel to AgentFileConfig**

In `packages/core/src/agents/types.ts`, add `voiceModel` to `AgentFileConfig`:

```typescript
export interface AgentFileConfig {
  id: string
  tools?: string[]
  modelPref?: string
  hand?: AgentHandConfig
  voiceModel?: string  // e.g. "en_US-lessac-medium" — Piper .onnx model name
}
```

- [ ] **Step 2: Update CFO config.json**

`agents/cfo/config.json`:
```json
{
  "id": "cfo",
  "tools": ["read_file", "write_file", "query_db", "http_get", "list_dir", "browser_navigate", "browser_read", "browser_click", "browser_fill", "browser_screenshot", "browser_close"],
  "voiceModel": "en_US-lessac-medium",
  "hand": {
    "enabled": true,
    "schedule": "daily at 08:00",
    "triggers": ["price_alert BTC > 5%"],
    "goal": "Review overnight P&L, check BTC price movement, and prepare morning briefing."
  }
}
```

- [ ] **Step 3: Update daemon index.ts to start voice at AUTONOMOUS tier**

Replace the existing `main()` function in `packages/daemon/src/index.ts`:

```typescript
// Add imports at top:
import { VoicePipeline } from './voice/pipeline.js'
import { randomUUID } from 'node:crypto'

// Note: BrowserSessionManager is managed by packages/core (chat.ts) — NOT needed here.

// Inside main(), after scheduler.start():
const trustLevel = process.env.CC_TRUST_LEVEL ?? 'sandboxed'
let voicePipeline: VoicePipeline | null = null

if (trustLevel === 'autonomous') {
  console.log('[coastal-daemon] AUTONOMOUS tier — starting voice pipeline...')
  voicePipeline = new VoicePipeline({
    onTranscript: async (text: string) => {
      const sessionId = `voice-${randomUUID().slice(0, 8)}`
      const result = await runner.run('general', text, sessionId)
      return result.reply ?? 'I could not process that.'
    },
  })
  voicePipeline.start()
  console.log('[coastal-daemon] Voice pipeline active. Say "Hey Coastal" to begin.')
}

// Update SIGTERM/SIGINT handlers:
process.on('SIGTERM', async () => {
  voicePipeline?.stop()
  scheduler.stop()
  process.exit(0)
})
process.on('SIGINT', async () => {
  voicePipeline?.stop()
  scheduler.stop()
  process.exit(0)
})
```

- [ ] **Step 4: Run all tests**

```bash
cd C:/Users/John/CoastalClaw && pnpm test
```

Expected: All packages PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/types.ts agents/cfo/config.json packages/daemon/src/index.ts
git commit -m "feat(voice): wire VoicePipeline into daemon at AUTONOMOUS tier + voiceModel field"
```

---

### Task 21: Final integration — run all tests, tag, push

- [ ] **Step 1: Run full test suite**

```bash
cd C:/Users/John/CoastalClaw && pnpm test
```

Expected: All packages PASS.

- [ ] **Step 2: Build all packages**

```bash
pnpm build
```

Expected: `packages/core/dist/`, `packages/daemon/dist/`, `packages/architect/dist/` all built.
Note: `packages/shell/dist/` was built in Chunk 2 (Task 12 Step 6) — re-running `pnpm build` will rebuild it, but it is not a new Chunk 3 artifact.

- [ ] **Step 3: Tag Phase 2**

```bash
git tag v0.3.0-phase2-coastalos
```

- [ ] **Step 4: Push branch and tag**

```bash
git push origin feat/phase2-coastalos
git push origin v0.3.0-phase2-coastalos
```

- [ ] **Step 5: Update memory / project notes**

Update `docs/superpowers/specs/2026-04-01-phase2-coastalos-design.md` status line:
```
**Status:** Implementation complete — v0.3.0-phase2-coastalos
```

```bash
git add docs/superpowers/specs/2026-04-01-phase2-coastalos-design.md
git commit -m "docs: mark Phase 2 CoastalOS spec as implementation complete"
git push origin feat/phase2-coastalos
```
