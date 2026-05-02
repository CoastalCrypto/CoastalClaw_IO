// packages/architect/src/__tests__/model-router-client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ArchitectModelRouterClient, MinCapabilityError } from '../model-router-client.js'

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

  it('throws MinCapabilityError when assigned model is below minTier', async () => {
    const router = {
      getModelFor: vi.fn().mockResolvedValue({ id: 'ollama:llama3.2-1b', tier: 'lite' }),
      generate: vi.fn(),
    }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    await expect(client.callPlan('p')).rejects.toBeInstanceOf(MinCapabilityError)
  })

  it('preflightCapability returns ok when high-priority model meets minTier', async () => {
    const router = { getModelFor: vi.fn().mockResolvedValue({ id: 'x', tier: 'apex' }), generate: vi.fn() }
    const client = new ArchitectModelRouterClient(router as any, { minTier: 'medium' })
    const ok = await client.preflightCapability()
    expect(ok.ok).toBe(true)
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
})
