import { describe, it, expect } from 'vitest'

describe('workspace link', () => {
  // These tests verify the symlink, exports map, AND the architect/* subpath
  // shape — all three must be wired correctly for Plan 1 / Chunks 1-6 to
  // resolve `@coastal-ai/core/architect/...` imports.

  it('can import a named export from @coastal-ai/core (root)', async () => {
    // The bare specifier must resolve through the symlink + root exports
    // entry. Assert a real named export is present rather than just
    // `toBeDefined()`, which would pass for an empty object.
    const mod = await import('@coastal-ai/core')
    expect(typeof mod.loadConfig).toBe('function')
  })

  it('can import from @coastal-ai/core/architect/types (subpath)', async () => {
    // Exercises the `./architect/types` entry in the exports map. If the
    // path is misshapen (typo, missing dual entry, dist file not emitted)
    // this import will fail loudly here instead of confusing later chunks.
    // Plan 1 / Chunk 1 replaced the stub with the real status vocabulary;
    // assert against a real exported symbol now that the stub is gone.
    const mod = await import('@coastal-ai/core/architect/types')
    expect(mod.WORK_ITEM_STATUSES).toContain('pending')
    expect(mod.WORK_ITEM_STATUSES).toContain('merged')
  })
})
