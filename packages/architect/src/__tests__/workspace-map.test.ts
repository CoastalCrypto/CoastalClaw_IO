import { describe, it, expect } from 'vitest'
import { loadWorkspaceMapSync } from '../workspace-map.js'
import { resolve } from 'node:path'

describe('loadWorkspaceMapSync', () => {
  it('finds the actual Coastal.AI packages', () => {
    const ws = loadWorkspaceMapSync(resolve(__dirname, '../../../..'))
    const names = ws.packages.map(p => p.name).sort()
    expect(names).toEqual(expect.arrayContaining(['architect', 'core', 'web', 'daemon']))
  })
})
