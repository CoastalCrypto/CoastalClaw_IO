import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ModelRegistry } from '../../src/models/registry.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('ModelRegistry', () => {
  let registry: ModelRegistry
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-registry-'))
    registry = new ModelRegistry(tmpDir)
  })

  afterEach(() => {
    registry.close()
    rmSync(tmpDir, { recursive: true })
  })

  it('registers a model variant', () => {
    registry.register({
      id: 'llama3.2:3b-q4_K_M',
      hfSource: 'meta-llama/Llama-3.2-3B',
      baseName: 'llama3.2:3b',
      quantLevel: 'Q4_K_M',
      sizeGb: 1.9,
    })
    const variants = registry.getVariants('llama3.2:3b')
    expect(variants).toHaveLength(1)
    expect(variants[0].id).toBe('llama3.2:3b-q4_K_M')
    expect(variants[0].sizeGb).toBe(1.9)
  })

  it('lists all active models grouped by base name', () => {
    registry.register({ id: 'codestral:22b-q4_K_M', hfSource: 'mistralai/Codestral-22B', baseName: 'codestral:22b', quantLevel: 'Q4_K_M', sizeGb: 12.5 })
    registry.register({ id: 'codestral:22b-q8_0', hfSource: 'mistralai/Codestral-22B', baseName: 'codestral:22b', quantLevel: 'Q8_0', sizeGb: 23.1 })
    const all = registry.listGrouped()
    expect(all).toHaveLength(1)
    expect(all[0].baseName).toBe('codestral:22b')
    expect(all[0].variants).toHaveLength(2)
  })

  it('deactivates a model variant', () => {
    registry.register({ id: 'llama3.2:3b-q4_K_M', hfSource: 'meta-llama/Llama-3.2-3B', baseName: 'llama3.2:3b', quantLevel: 'Q4_K_M', sizeGb: 1.9 })
    registry.deactivate('llama3.2:3b-q4_K_M')
    const variants = registry.getVariants('llama3.2:3b')
    expect(variants).toHaveLength(0)
  })
})
