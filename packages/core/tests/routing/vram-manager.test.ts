import { describe, it, expect, vi } from 'vitest'
import { VRAMManager } from '../../src/routing/vram-manager.js'

// Mock fetch for Ollama /api/ps responses
globalThis.fetch = vi.fn()

function mockPs(models: Array<{ name: string; size_vram: number }>) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ models }),
  } as Response)
}

describe('VRAMManager', () => {
  const variants = [
    { id: 'codestral:22b-Q8_0',   quantLevel: 'Q8_0',   sizeGb: 23.0 },
    { id: 'codestral:22b-Q6_K',   quantLevel: 'Q6_K',   sizeGb: 17.2 },
    { id: 'codestral:22b-Q5_K_M', quantLevel: 'Q5_K_M', sizeGb: 14.8 },
    { id: 'codestral:22b-Q4_K_M', quantLevel: 'Q4_K_M', sizeGb: 12.5 },
    { id: 'codestral:22b-Q4_0',   quantLevel: 'Q4_0',   sizeGb: 11.8 },
  ]
  const getVariants = vi.fn().mockReturnValue(variants)

  it('selects Q8_0 when VRAM budget is large enough', async () => {
    mockPs([])  // nothing loaded → 48GB available
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q8_0')
  })

  it('degrades to Q5_K_M when Q8 and Q6 do not fit', async () => {
    // 33GB loaded → only 15GB free (48-33=15) → Q8(23) no, Q6(17.2) no, Q5(14.8) yes
    mockPs([{ name: 'some-model', size_vram: 33 * 1024 * 1024 * 1024 }])
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q5_K_M')
  })

  it('returns already-loaded model without quant selection', async () => {
    mockPs([{ name: 'codestral:22b-Q4_K_M', size_vram: 12.5 * 1024 * 1024 * 1024 }])
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q4_K_M')
  })

  it('falls back to Q4_0 when nothing else fits', async () => {
    // 47GB loaded → only 1GB free → nothing fits → force Q4_0
    mockPs([{ name: 'huge-model', size_vram: 47 * 1024 * 1024 * 1024 }])
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q4_0')
  })
})
