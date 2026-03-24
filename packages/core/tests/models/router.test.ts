import { describe, it, expect, vi } from 'vitest'
import { ModelRouter } from '../../src/models/router.js'

vi.mock('../../src/models/ollama.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    listModels: vi.fn().mockResolvedValue(['llama3.2', 'mistral']),
    chat: vi.fn().mockResolvedValue('mocked response'),
  })),
}))

describe('ModelRouter', () => {
  it('routes to default model when none specified', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const result = await router.chat([{ role: 'user', content: 'hi' }])
    expect(result).toBe('mocked response')
  })

  it('routes to specified model', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const result = await router.chat([{ role: 'user', content: 'hi' }], { model: 'mistral' })
    expect(result).toBe('mocked response')
  })

  it('lists available models', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const models = await router.listModels()
    expect(models).toContain('llama3.2')
  })
})
