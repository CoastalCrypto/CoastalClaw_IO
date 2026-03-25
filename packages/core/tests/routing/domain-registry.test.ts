import { describe, it, expect, afterEach } from 'vitest'
import { DomainModelRegistry } from '../../src/routing/domain-registry.js'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('DomainModelRegistry', () => {
  const registries: DomainModelRegistry[] = []
  const tmpDirs: string[] = []

  afterEach(async () => {
    registries.forEach(r => r.close())
    registries.length = 0
    // Give watchers time to release file handles before cleanup
    await new Promise(resolve => setTimeout(resolve, 50))
    for (const tmpDir of tmpDirs) {
      if (tmpDir && existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    }
    tmpDirs.length = 0
  })

  it('resolves model for domain + urgency', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    tmpDirs.push(tmpDir)
    const path = join(tmpDir, 'model-registry.json')
    writeFileSync(path, JSON.stringify({
      cfo: { high: 'finma:7b-q5', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto: { high: 'codestral:22b-q4', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('finma:7b-q5')
    expect(reg.resolve('cto', 'medium')).toBe('llama3.2:3b')
    expect(reg.resolve('general', 'low')).toBe('llama3.2:1b')
  })

  it('uses DEFAULT_REGISTRY when file is missing', () => {
    const reg = new DomainModelRegistry('/nonexistent/path/model-registry.json')
    registries.push(reg)
    // No file → DEFAULT_REGISTRY applies → cfo/high maps to llama3.1:8b-q4_K_M
    expect(reg.resolve('cfo', 'high')).toBe('llama3.1:8b-q4_K_M')
  })

  it('cascades through urgency tiers when a level is undefined in registry', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    tmpDirs.push(tmpDir)
    const path = join(tmpDir, 'model-registry.json')
    // cfo has no 'high' key — resolve should cascade to medium
    writeFileSync(path, JSON.stringify({
      cfo:     { medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto:     { high: 'codestral:22b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo:     { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('llama3.2:3b')   // cascaded to medium
    expect(reg.resolve('cfo', 'low')).toBe('llama3.2:1b')    // found directly
  })

  it('falls back to FINAL_FALLBACK when all urgency tiers are missing', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    tmpDirs.push(tmpDir)
    const path = join(tmpDir, 'model-registry.json')
    // cfo has no entries at all
    writeFileSync(path, JSON.stringify({
      cto:     { high: 'codestral:22b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo:     { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('llama3.2:1b')   // FINAL_FALLBACK
  })

  it('hot-reloads when file changes', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    tmpDirs.push(tmpDir)
    const path = join(tmpDir, 'model-registry.json')
    writeFileSync(path, JSON.stringify({
      cfo: { high: 'model-a', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('model-a')

    writeFileSync(path, JSON.stringify({
      cfo: { high: 'model-b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))

    await new Promise(resolve => setTimeout(resolve, 200))
    expect(reg.resolve('cfo', 'high')).toBe('model-b')
  })
})
