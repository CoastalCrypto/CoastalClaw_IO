import { describe, it, expect } from 'vitest'
import { findTouchedPackages } from '../touched-packages.js'

const workspace = {
  packages: [
    { name: 'core', path: 'packages/core' },
    { name: 'web', path: 'packages/web' },
    { name: 'architect', path: 'packages/architect' },
  ],
}

describe('findTouchedPackages', () => {
  it('returns the package containing each diff path', () => {
    const diff = `--- a/packages/core/src/x.ts
+++ b/packages/core/src/x.ts
--- a/packages/web/src/y.tsx
+++ b/packages/web/src/y.tsx
`
    expect(findTouchedPackages(diff, workspace)).toEqual(['core', 'web'])
  })

  it('deduplicates packages', () => {
    const diff = `--- a/packages/core/a.ts
+++ b/packages/core/a.ts
--- a/packages/core/b.ts
+++ b/packages/core/b.ts
`
    expect(findTouchedPackages(diff, workspace)).toEqual(['core'])
  })

  it('ignores files outside known packages', () => {
    const diff = `--- a/scripts/foo.ts
+++ b/scripts/foo.ts
--- a/packages/architect/x.ts
+++ b/packages/architect/x.ts
`
    expect(findTouchedPackages(diff, workspace)).toEqual(['architect'])
  })
})
