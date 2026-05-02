import { describe, it, expect } from 'vitest'
import { parseSkillMd, serializeSkillMd } from '../skill-md.js'

describe('parseSkillMd', () => {
  it('parses required frontmatter and body', () => {
    const input = `---
name: Add retry to web tool
description: Wrap http_get in retry
---

# Why

Transient 5xx is the most common failure.
`
    const r = parseSkillMd(input)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.name).toBe('Add retry to web tool')
      expect(r.value.description).toBe('Wrap http_get in retry')
      expect(r.value.body).toContain('Transient 5xx')
    }
  })

  it('parses target_hints array and numeric fields', () => {
    const input = `---
name: X
description: y
target_hints:
  - packages/core/src/web.ts
budget_loc: 50
budget_iters: 2
approval_policy: pr-only
---

body
`
    const r = parseSkillMd(input)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.targetHints).toEqual(['packages/core/src/web.ts'])
    expect(r.value.budgetLoc).toBe(50)
    expect(r.value.budgetIters).toBe(2)
    expect(r.value.approvalPolicy).toBe('pr-only')
  })

  it('returns error on missing required name', () => {
    const r = parseSkillMd('---\ndescription: x\n---\n\nbody')
    expect(r.ok).toBe(false)
  })

  it('returns error on missing frontmatter', () => {
    const r = parseSkillMd('# just a heading\n\nbody')
    expect(r.ok).toBe(false)
  })
})

describe('serializeSkillMd round-trip', () => {
  it('serialize then parse yields equivalent value', () => {
    const original = {
      name: 'X',
      description: 'y',
      targetHints: ['a.ts', 'b.ts'],
      budgetLoc: 100,
      budgetIters: 3,
      approvalPolicy: 'plan-only' as const,
      body: 'body text',
    }
    const text = serializeSkillMd(original)
    const r = parseSkillMd(text)
    if (!r.ok) throw new Error(r.error)
    expect(r.value).toEqual(original)
  })
})
