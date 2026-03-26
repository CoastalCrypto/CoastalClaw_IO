import { describe, it, expect, vi } from 'vitest'
import { ModelRouter } from '../../src/models/router.js'

vi.mock('../../src/models/ollama.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    listModels: vi.fn().mockResolvedValue(['llama3.2', 'mistral']),
    chat: vi.fn().mockResolvedValue('mocked response'),
  })),
}))

vi.mock('../../src/routing/cascade.js', () => ({
  CascadeRouter: vi.fn().mockImplementation(() => ({
    route: vi.fn().mockResolvedValue({
      model: 'llama3.2', fallbackModels: [], domain: 'general',
      signals: { relation: 'new', urgency: 'medium', actionability: 'act', retention: 'useful', confidence: 0 },
      domainConfidence: 0.5, classifiedBy: 'llm',
    }),
    close: vi.fn(),
  })),
}))

describe('ModelRouter', () => {
  it('routes to default model when none specified', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const { reply } = await router.chat([{ role: 'user', content: 'hi' }])
    expect(reply).toBe('mocked response')
  })

  it('routes to specified model', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const { reply } = await router.chat([{ role: 'user', content: 'hi' }], { model: 'mistral' })
    expect(reply).toBe('mocked response')
  })

  it('lists available models', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const models = await router.listModels()
    expect(models).toContain('llama3.2')
  })

  it('returns { reply, decision } with RouteDecision', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const result = await router.chat([{ role: 'user', content: 'hi' }])
    expect(result).toHaveProperty('reply')
    expect(result).toHaveProperty('decision')
    expect(result.reply).toBe('mocked response')
    expect(result.decision).toHaveProperty('model')
    expect(result.decision).toHaveProperty('signals')
  })
})
