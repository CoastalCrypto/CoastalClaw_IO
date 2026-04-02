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

Propose ONE unified diff as a targeted fix. Rules:
- Output ONLY ONE \`\`\`diff block and nothing else after it.
- The fix must directly address ONE of the failure patterns above.
- Do not change unrelated code.
- Do not add imports unless strictly necessary.
- The diff must be syntactically valid and apply cleanly.

Respond with a brief one-sentence summary, then the diff block.`
}

/** Infer the most relevant source file from failure patterns. */
function inferTargetFile(gaps: SkillGapRow[], repoRoot: string): string | null {
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

  const summary = response.split('\n').find(l => l.trim() && !l.startsWith('```')) ?? 'Proposed fix'

  return { diff, summary, targetFile: targetRel, gapIds: gaps.map(g => g.id) }
}
