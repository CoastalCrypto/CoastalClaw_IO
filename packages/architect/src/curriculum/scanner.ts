import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkItemStore } from '@coastal-ai/core/architect/store'
import { DedupConflictError } from '@coastal-ai/core/architect/store'
import type { CycleStore } from '@coastal-ai/core/architect/cycle-store'
import type { HarvestedSignals } from './signals.js'
import type { SuppressionStore } from './suppression-store.js'

export interface ScannerDeps {
  workStore: WorkItemStore
  cycleStore: CycleStore
  suppressions: SuppressionStore
  repoRoot: string
  callLLM: (prompt: string) => Promise<{ text: string; modelId: string }>
  harvestSignals: () => HarvestedSignals
  isLockedPath: (path: string) => string | null
  dailyBudget: number
}

export interface ScanResult {
  proposalsInserted: number
  proposalsRejected: number
  signalsSummarized: number
  modelUsed: string
}

interface LLMProposal {
  title: string
  targetHints: string[]
  budgetLoc: number
}

const MAX_PROMPT_TODOS = 20
const MAX_PROMPT_CHURN = 10
const DEFAULT_BUDGET_LOC = 200

function buildPrompt(signals: HarvestedSignals, dailyBudget: number): string {
  const todos = signals.staleTodos.slice(0, MAX_PROMPT_TODOS)
  const churn = signals.churnHotspots.slice(0, MAX_PROMPT_CHURN)

  const todoLines = todos.map(t => `  ${t.file}:${t.line} — ${t.text}`).join('\n')
  const churnLines = churn.map(c => `  ${c.file} (${c.changes} changes)`).join('\n')

  return `You are a senior engineer reviewing a codebase for improvement opportunities.

Based on the following signals, propose up to ${dailyBudget} self-contained work items.
Each work item must be achievable in one automated coding cycle.

STALE TODOs / FIXMEs:
${todoLines || '  (none)'}

HIGH-CHURN FILES:
${churnLines || '  (none)'}

Respond with ONLY a JSON array of objects. Each object must have:
- "title": string (concise, action-oriented, under 80 chars)
- "targetHints": string[] (relative file paths relevant to this work item)
- "budgetLoc": number (estimated lines of code to change, 10–500)

Example:
[
  {
    "title": "Resolve TODO: add retry logic to http_get",
    "targetHints": ["src/tools/core/web.ts"],
    "budgetLoc": 40
  }
]

Only propose items that require code changes to existing files. Do not propose new features
that require creating entirely new subsystems. Keep each item focused and testable.`
}

function parseProposals(text: string): LLMProposal[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const proposals: LLMProposal[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue
    const obj = item as Record<string, unknown>
    const title = typeof obj['title'] === 'string' ? obj['title'].trim() : null
    if (!title) continue

    const rawHints = obj['targetHints']
    const targetHints: string[] = Array.isArray(rawHints)
      ? rawHints.filter((h): h is string => typeof h === 'string')
      : []

    const rawBudget = obj['budgetLoc']
    const budgetLoc = typeof rawBudget === 'number' && rawBudget > 0
      ? Math.min(rawBudget, 2000)
      : DEFAULT_BUDGET_LOC

    proposals.push({ title, targetHints, budgetLoc })
  }

  return proposals
}

export class CurriculumScanner {
  constructor(private deps: ScannerDeps) {}

  async scan(): Promise<ScanResult> {
    const { workStore, cycleStore, suppressions, repoRoot, callLLM, harvestSignals, isLockedPath, dailyBudget } = this.deps

    const cycle = cycleStore.start(null, { kind: 'curriculum_scan' })

    const signals = harvestSignals()
    const signalsSummarized = signals.staleTodos.length + signals.churnHotspots.length

    let modelUsed = 'unknown'
    let proposalsInserted = 0
    let proposalsRejected = 0

    try {
      const prompt = buildPrompt(signals, dailyBudget)
      const llmResult = await callLLM(prompt)
      modelUsed = llmResult.modelId

      const proposals = parseProposals(llmResult.text)

      for (const proposal of proposals) {
        const { title, targetHints, budgetLoc } = proposal

        // Check locked paths
        const lockedHint = targetHints.find(hint => isLockedPath(hint) !== null)
        if (lockedHint) {
          proposalsRejected++
          continue
        }

        // Check that at least one target file exists (if hints provided)
        if (targetHints.length > 0) {
          const anyExists = targetHints.some(hint => existsSync(join(repoRoot, hint)))
          if (!anyExists) {
            proposalsRejected++
            continue
          }
        }

        // Check suppression
        const suppressionSig = buildSig(title, targetHints)
        if (suppressions.isSuppressed(suppressionSig)) {
          proposalsRejected++
          continue
        }

        // Try inserting; catch dedup conflicts
        try {
          workStore.insert({
            source: 'curriculum',
            title,
            body: `Curriculum-proposed work item.\n\nTarget hints: ${targetHints.join(', ') || '(none)'}`,
            targetHints: targetHints.length > 0 ? targetHints : null,
            budgetLoc,
            approvalPolicy: 'full',
            priority: 'low',
          })
          proposalsInserted++
        } catch (err) {
          if (err instanceof DedupConflictError) {
            proposalsRejected++
          } else {
            throw err
          }
        }
      }
    } catch (err) {
      cycleStore.terminate(cycle.id, {
        outcome: 'failed',
        modelUsed,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      throw err
    }

    const outcome = proposalsInserted >= 1 ? 'merged' : 'failed'
    cycleStore.terminate(cycle.id, {
      outcome,
      modelUsed,
    })

    return { proposalsInserted, proposalsRejected, signalsSummarized, modelUsed }
  }
}

function buildSig(title: string, targetHints: string[]): string {
  const normalTitle = title.toLowerCase().trim()
  const hints = targetHints.slice().sort().join(',')
  return hints ? `${normalTitle}|${hints}` : normalTitle
}
