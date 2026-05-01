import { describe, it, expect } from 'vitest'
import { parseQueueMarkdown } from '../markdown.js'

describe('parseQueueMarkdown', () => {
  it('parses a single H2 entry with no fenced YAML', () => {
    const input = `
## Add retry to web tool

Wrap http_get in exponential backoff.
`
    const items = parseQueueMarkdown(input)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Add retry to web tool')
    expect(items[0].body).toContain('Wrap http_get')
    expect(items[0].targetHints).toBeNull()
  })

  it('parses fenced YAML config block', () => {
    const input = `
## Add retry

\`\`\`yaml
target_hints:
  - packages/core/src/tools/core/web.ts
budget_iters: 3
approval_policy: pr-only
\`\`\`

Body text after config.
`
    const items = parseQueueMarkdown(input)
    expect(items[0].targetHints).toEqual(['packages/core/src/tools/core/web.ts'])
    expect(items[0].budgetIters).toBe(3)
    expect(items[0].approvalPolicy).toBe('pr-only')
    expect(items[0].body).toContain('Body text after config.')
    expect(items[0].body).not.toContain('target_hints:')
  })

  it('parses multiple H2 entries', () => {
    const input = `
## Item A
Body A.

## Item B
Body B.
`
    const items = parseQueueMarkdown(input)
    expect(items).toHaveLength(2)
    expect(items[0].title).toBe('Item A')
    expect(items[1].title).toBe('Item B')
  })

  it('skips entries marked moved-to-PR', () => {
    const input = `
## Item A
<!-- moved to PR #42 -->

## Item B
Live one.
`
    const items = parseQueueMarkdown(input)
    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('Item B')
  })

  it('returns empty for empty input', () => {
    expect(parseQueueMarkdown('')).toEqual([])
  })
})
