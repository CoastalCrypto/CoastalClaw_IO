// packages/architect/src/__tests__/model-router-client.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  ArchitectModelRouterClient,
  MinCapabilityError,
  NoModelAssignedError,
} from '../model-router-client.js'

describe('ArchitectModelRouterClient', () => {
  it('routes plan calls to the high-priority model', async () => {
    const router = {
      getModelFor: vi.fn().mockResolvedValue({ id: 'vllm:llama-3.1-70b', tier: 'apex' }),
      generate: vi.fn().mockResolvedValue('plan + diff text'),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    const result = await client.callPlan('the prompt')
    expect(router.getModelFor).toHaveBeenCalledWith('architect', 'high')
    expect(result.text).toBe('plan + diff text')
    expect(result.modelId).toBe('vllm:llama-3.1-70b')
  })

  it('routes summary calls to the low-priority model', async () => {
    const router = {
      getModelFor: vi.fn().mockResolvedValue({ id: 'ollama:llama3.2-3b', tier: 'standard' }),
      generate: vi.fn().mockResolvedValue('summary text'),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'low' })
    const result = await client.callSummary('summarize this')
    expect(router.getModelFor).toHaveBeenCalledWith('architect', 'low')
    expect(result.text).toBe('summary text')
    expect(result.modelId).toBe('ollama:llama3.2-3b')
  })

  it('throws MinCapabilityError when assigned model is below minTier', async () => {
    const router = {
      getModelFor: vi.fn().mockResolvedValue({ id: 'ollama:llama3.2-1b', tier: 'lite' }),
      generate: vi.fn(),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    await expect(client.callPlan('p')).rejects.toBeInstanceOf(MinCapabilityError)
  })

  it('throws NoModelAssignedError when router returns null', async () => {
    const router = {
      getModelFor: vi.fn().mockResolvedValue(null),
      generate: vi.fn(),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    await expect(client.callPlan('p')).rejects.toBeInstanceOf(NoModelAssignedError)

    const result = await client.preflightCapability()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // The no-assignment path must not surface the standard
      // "lower CC_ARCHITECT_MIN_TIER" remediation, since lowering the min
      // does nothing when no model is assigned at all.
      expect(result.message).not.toContain('CC_ARCHITECT_MIN_TIER=low to run anyway')
      expect(result.message).toContain('architect')
    }
  })

  it('rejects an invalid minTier in the constructor', () => {
    const router = { getModelFor: vi.fn(), generate: vi.fn() }
    expect(
      () => new ArchitectModelRouterClient(router as any, { minTier: 'bogus' as any }),
    ).toThrow(/Invalid minTier/)
  })

  it('throws a non-MinCapabilityError when the router returns an unknown tier', async () => {
    const router = {
      getModelFor: vi.fn().mockResolvedValue({ id: 'x', tier: 'huge' as any }),
      generate: vi.fn(),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    let caught: unknown
    try {
      await client.callPlan('p')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect(caught).not.toBeInstanceOf(MinCapabilityError)
    expect((caught as Error).message).toMatch(/unknown tier/i)
  })

  it('preflightCapability returns ok when high-priority model meets minTier', async () => {
    const router = { getModelFor: vi.fn().mockResolvedValue({ id: 'x', tier: 'apex' }), generate: vi.fn() }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    const ok = await client.preflightCapability()
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.modelId).toBe('x')
  })

  it('preflightCapability returns failure with remediation when below minTier', async () => {
    const router = { getModelFor: vi.fn().mockResolvedValue({ id: 'x', tier: 'lite' }), generate: vi.fn() }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    const result = await client.preflightCapability()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('CC_ARCHITECT_MIN_TIER')
    }
  })

  it('preflightCapability surfaces non-MinCapabilityError messages verbatim', async () => {
    const router = {
      getModelFor: vi.fn().mockRejectedValue(new Error('network down')),
      generate: vi.fn(),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    const result = await client.preflightCapability()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('network down')
    }
  })
})
