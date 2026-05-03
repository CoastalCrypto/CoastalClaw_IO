import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createModelRouterAdapter } from '../model-router-adapter.js'

describe('createModelRouterAdapter', () => {
  const mockRouter = {
    chat: vi.fn(),
    cascade: { route: vi.fn() },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getModelFor returns a model descriptor with inferred tier', async () => {
    mockRouter.cascade.route.mockResolvedValue({
      model: 'vllm:llama-3.1-70b',
      domain: 'general',
      urgency: 'high',
      fallbackModels: [],
    })
    const adapter = createModelRouterAdapter(mockRouter as any)
    const result = await adapter.getModelFor('architect', 'high')
    expect(result).toEqual({ id: 'vllm:llama-3.1-70b', tier: 'apex' })
  })

  it('maps medium urgency to standard tier', async () => {
    mockRouter.cascade.route.mockResolvedValue({
      model: 'ollama:llama3.2',
      domain: 'general',
      urgency: 'medium',
      fallbackModels: [],
    })
    const adapter = createModelRouterAdapter(mockRouter as any)
    const result = await adapter.getModelFor('architect', 'medium')
    expect(result).toEqual({ id: 'ollama:llama3.2', tier: 'standard' })
  })

  it('maps low urgency to lite tier', async () => {
    mockRouter.cascade.route.mockResolvedValue({
      model: 'ollama:phi3',
      domain: 'general',
      urgency: 'low',
      fallbackModels: [],
    })
    const adapter = createModelRouterAdapter(mockRouter as any)
    const result = await adapter.getModelFor('architect', 'low')
    expect(result).toEqual({ id: 'ollama:phi3', tier: 'lite' })
  })

  it('generate calls router.chat and returns the reply', async () => {
    mockRouter.chat.mockResolvedValue({ reply: 'hello world', decision: {} })
    const adapter = createModelRouterAdapter(mockRouter as any)
    const result = await adapter.generate('vllm:llama-3.1-70b', 'prompt text')
    expect(result).toBe('hello world')
    expect(mockRouter.chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'prompt text' }],
      { model: 'vllm:llama-3.1-70b' },
    )
  })

  it('returns null when route returns no model', async () => {
    mockRouter.cascade.route.mockResolvedValue({
      model: null,
      domain: 'general',
      urgency: 'high',
      fallbackModels: [],
    })
    const adapter = createModelRouterAdapter(mockRouter as any)
    const result = await adapter.getModelFor('architect', 'high')
    expect(result).toBeNull()
  })
})
