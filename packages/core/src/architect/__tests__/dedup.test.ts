import { describe, it, expect } from 'vitest'
import { computeDedupSignature } from '../dedup.js'

describe('computeDedupSignature', () => {
  it('is stable for identical title + hints', () => {
    const a = computeDedupSignature('Add retry', ['packages/core/src/web.ts'])
    const b = computeDedupSignature('Add retry', ['packages/core/src/web.ts'])
    expect(a).toBe(b)
  })

  it('normalizes case and whitespace in title', () => {
    const a = computeDedupSignature('  Add Retry  ', ['x.ts'])
    const b = computeDedupSignature('add retry', ['x.ts'])
    expect(a).toBe(b)
  })

  it('sorts target_hints so order does not matter', () => {
    const a = computeDedupSignature('t', ['b.ts', 'a.ts'])
    const b = computeDedupSignature('t', ['a.ts', 'b.ts'])
    expect(a).toBe(b)
  })

  it('differs for different titles', () => {
    expect(computeDedupSignature('a', ['x'])).not.toBe(computeDedupSignature('b', ['x']))
  })

  it('treats null/undefined hints as empty', () => {
    expect(computeDedupSignature('t', null)).toBe(computeDedupSignature('t', []))
    expect(computeDedupSignature('t', undefined as any)).toBe(computeDedupSignature('t', []))
  })

  it('returns a 64-char hex sha256', () => {
    const sig = computeDedupSignature('t', ['x.ts'])
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })
})
