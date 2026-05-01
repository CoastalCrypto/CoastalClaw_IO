import { readFileSync, existsSync, watch } from 'node:fs'
import { createHash } from 'node:crypto'
import type { ApprovalPolicy } from '@coastal-ai/core/architect/types'
import type { WorkItemStore, InsertWorkItemInput } from '@coastal-ai/core/architect/store'

export interface ParsedQueueItem {
  title: string
  body: string
  targetHints: string[] | null
  acceptance: string | null
  budgetLoc?: number
  budgetIters?: number
  approvalPolicy?: ApprovalPolicy
}

const MOVED_RE = /<!--\s*moved to PR\s+#?\d+\s*-->/i

export function parseQueueMarkdown(content: string): ParsedQueueItem[] {
  if (!content.trim()) return []
  const items: ParsedQueueItem[] = []
  const parts = content.split(/\n(?=## )/g)
  for (const part of parts) {
    if (!part.startsWith('## ')) continue
    const lines = part.split(/\r?\n/)
    const title = lines[0].slice(3).trim()
    const restRaw = lines.slice(1).join('\n')

    if (MOVED_RE.test(restRaw)) continue

    const yamlMatch = restRaw.match(/```ya?ml\s*\n([\s\S]*?)```/)
    const yaml = yamlMatch ? parseSimpleYaml(yamlMatch[1]) : {}
    const body = (yamlMatch
      ? restRaw.slice(0, yamlMatch.index!) + restRaw.slice(yamlMatch.index! + yamlMatch[0].length)
      : restRaw).trim()

    items.push({
      title,
      body,
      targetHints: Array.isArray(yaml.target_hints) ? yaml.target_hints : null,
      acceptance: typeof yaml.acceptance === 'string' ? yaml.acceptance : null,
      budgetLoc: typeof yaml.budget_loc === 'number' ? yaml.budget_loc : undefined,
      budgetIters: typeof yaml.budget_iters === 'number' ? yaml.budget_iters : undefined,
      approvalPolicy: typeof yaml.approval_policy === 'string' ? (yaml.approval_policy as ApprovalPolicy) : undefined,
    })
  }
  return items
}

/** Tiny YAML-subset parser: top-level scalars and one-level string lists.
 *  Out of scope: nested objects, multi-line strings, anchors, etc. */
function parseSimpleYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  let currentKey: string | null = null
  let currentList: string[] | null = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '')
    if (!line.trim()) continue
    if (line.startsWith('  - ')) {
      if (currentList) currentList.push(line.slice(4).trim())
      continue
    }
    const m = line.match(/^([A-Za-z_]\w*):\s*(.*)$/)
    if (!m) continue
    currentKey = m[1]
    const rawValue = m[2]
    if (rawValue === '') {
      currentList = []
      out[currentKey] = currentList
    } else {
      currentList = null
      const num = Number(rawValue)
      out[currentKey] = !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(rawValue) ? num : rawValue.replace(/^['"]|['"]$/g, '')
    }
  }
  return out
}

export function hashQueueContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)
}

export interface MarkdownAdapterDeps {
  store: WorkItemStore
  filePath: string
  log?: (msg: string) => void
}

export function startMarkdownAdapter(deps: MarkdownAdapterDeps): { stop: () => void } {
  const log = deps.log ?? ((m) => console.log(`[architect:markdown] ${m}`))
  let lastHash = ''
  let timer: NodeJS.Timeout | null = null

  const reconcile = () => {
    if (!existsSync(deps.filePath)) return
    const content = readFileSync(deps.filePath, 'utf8')
    const hash = hashQueueContent(content)
    if (hash === lastHash) return
    lastHash = hash
    const parsed = parseQueueMarkdown(content)
    for (const item of parsed) {
      try {
        deps.store.insert({
          source: 'markdown',
          sourceRef: `${deps.filePath}#${hashQueueContent(item.title)}`,
          title: item.title,
          body: item.body,
          targetHints: item.targetHints,
          acceptance: item.acceptance,
          budgetLoc: item.budgetLoc,
          budgetIters: item.budgetIters,
          approvalPolicy: item.approvalPolicy,
        } as InsertWorkItemInput)
        log(`inserted "${item.title}"`)
      } catch (err: any) {
        if (err.name === 'DedupConflictError') {
          // Idempotent — already in queue.
        } else {
          log(`failed to insert "${item.title}": ${err.message}`)
        }
      }
    }
  }

  reconcile()

  const watcher = watch(deps.filePath, () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(reconcile, 2000)
  })

  return {
    stop: () => {
      if (timer) clearTimeout(timer)
      watcher.close()
    },
  }
}
