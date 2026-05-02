import type { ApprovalPolicy } from '@coastal-ai/core/architect/types'

export interface SkillMd {
  name: string
  description: string
  body: string
  targetHints?: string[]
  acceptance?: string
  budgetLoc?: number
  budgetIters?: number
  approvalPolicy?: ApprovalPolicy
  version?: number
  locale?: string
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/

export function parseSkillMd(content: string): ParseResult<SkillMd> {
  const m = content.match(FRONTMATTER_RE)
  if (!m) return { ok: false, error: 'no frontmatter delimiters' }
  const fm = parseSimpleYaml(m[1])
  const body = m[2].trim()

  if (typeof fm.name !== 'string' || !fm.name.trim()) return { ok: false, error: 'name is required' }
  if (typeof fm.description !== 'string') return { ok: false, error: 'description is required' }

  return {
    ok: true,
    value: {
      name: fm.name.trim(),
      description: fm.description,
      body,
      targetHints: Array.isArray(fm.target_hints) ? fm.target_hints as string[] : undefined,
      acceptance: typeof fm.acceptance === 'string' ? fm.acceptance : undefined,
      budgetLoc: typeof fm.budget_loc === 'number' ? fm.budget_loc : undefined,
      budgetIters: typeof fm.budget_iters === 'number' ? fm.budget_iters : undefined,
      approvalPolicy: typeof fm.approval_policy === 'string' ? fm.approval_policy as ApprovalPolicy : undefined,
      version: typeof fm.version === 'number' ? fm.version : undefined,
      locale: typeof fm.locale === 'string' ? fm.locale : undefined,
    },
  }
}

export function serializeSkillMd(s: SkillMd): string {
  const lines: string[] = ['---']
  lines.push(`name: ${s.name}`)
  lines.push(`description: ${s.description}`)
  if (s.version != null) lines.push(`version: ${s.version}`)
  if (s.locale) lines.push(`locale: ${s.locale}`)
  if (s.targetHints?.length) {
    lines.push('target_hints:')
    for (const h of s.targetHints) lines.push(`  - ${h}`)
  }
  if (s.acceptance) lines.push(`acceptance: ${JSON.stringify(s.acceptance)}`)
  if (s.budgetLoc != null) lines.push(`budget_loc: ${s.budgetLoc}`)
  if (s.budgetIters != null) lines.push(`budget_iters: ${s.budgetIters}`)
  if (s.approvalPolicy) lines.push(`approval_policy: ${s.approvalPolicy}`)
  lines.push('---', '', s.body)
  return lines.join('\n')
}

// Same minimal YAML-subset parser as the markdown adapter — duplicated by
// design so this module is self-contained for export usage.
function parseSimpleYaml(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
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
    const key = m[1]
    const rawValue = m[2]
    if (rawValue === '') {
      currentList = []
      out[key] = currentList
    } else {
      currentList = null
      const stripped = rawValue.replace(/^['"]|['"]$/g, '')
      const num = Number(stripped)
      out[key] = !Number.isNaN(num) && /^-?\d+(\.\d+)?$/.test(stripped) ? num : stripped
    }
  }
  return out
}
