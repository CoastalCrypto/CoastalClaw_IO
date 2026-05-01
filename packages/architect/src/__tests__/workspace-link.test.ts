import { describe, it, expect } from 'vitest'

describe('workspace link', () => {
  it('can import from @coastal-ai/core (root)', async () => {
    // The bare specifier must resolve through the symlink + exports map.
    // Content doesn't matter — only that the resolution chain works.
    const mod = await import('@coastal-ai/core')
    expect(mod).toBeDefined()
  })
})
