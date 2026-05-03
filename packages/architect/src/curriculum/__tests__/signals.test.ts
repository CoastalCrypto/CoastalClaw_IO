import { describe, it, expect } from 'vitest'
import { findStaleTodos, findChurnHotspots } from '../signals.js'

describe('signals', () => {
  it('findStaleTodos extracts file, line, and text correctly', () => {
    const grepOutput = `src/foo.ts:42: TODO: fix this
src/bar.ts:15: FIXME: revisit logic`
    const result = findStaleTodos(grepOutput)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      file: 'src/foo.ts',
      line: 42,
      text: 'TODO: fix this'
    })
    expect(result[1]).toEqual({
      file: 'src/bar.ts',
      line: 15,
      text: 'FIXME: revisit logic'
    })
  })

  it('findStaleTodos returns empty array for empty input', () => {
    expect(findStaleTodos('')).toEqual([])
    expect(findStaleTodos('   \n  ')).toEqual([])
  })

  it('findChurnHotspots counts file occurrences and filters by threshold', () => {
    const gitLogOutput = `src/foo.ts
src/foo.ts
src/foo.ts
src/bar.ts
src/bar.ts
src/baz.ts`
    const result = findChurnHotspots(gitLogOutput, 2)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ file: 'src/foo.ts', changes: 3 })
    expect(result[1]).toEqual({ file: 'src/bar.ts', changes: 2 })
  })

  it('findChurnHotspots respects minChanges threshold', () => {
    const gitLogOutput = `src/foo.ts
src/foo.ts
src/bar.ts`
    const result = findChurnHotspots(gitLogOutput, 3)
    expect(result).toHaveLength(0)

    const result2 = findChurnHotspots(gitLogOutput, 2)
    expect(result2).toHaveLength(1)
    expect(result2[0].file).toBe('src/foo.ts')
  })
})
