// tests/models/router-vllm.test.ts
// Tests ModelRouter's vLLM probe and fallback behaviour
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModelRouter } from '../../src/models/router.js'

const ROUTE_DECISION = {
  model: 'llama3.2', fallbackModels: [] as string[], domain: 'general',
  signals: { relation: 'new', urgency: 'medium', actionability: 'act', retention: 'useful', confidence: 0 },
  domainConfidence: 0.5, classifiedBy: 'llm',
} as const

vi.mock('../../src/routing/cascade.js', () => ({
  CascadeRouter: vi.fn().mockImplementation(() => ({
    route: vi.fn().mockResolvedValue(ROUTE_DECISION),
    close: vi.fn(),
  })),
}))

vi.mock('../../src/models/ollama.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    listModels: vi.fn().mockResolvedValue(['llama3.2']),
    chat: vi.fn().mockResolvedValue('ollama response'),
    chatWithTools: vi.fn().mockResolvedValue({ content: 'ollama tools', toolCalls: [] }),
  })),
}))

vi.mock('../../src/models/vllm.js', () => ({
  VllmClient: vi.fn().mockImplementation((_url: string) => ({
    isAvailable: vi.fn().mockResolvedValue(false),
    chat: vi.fn().mockResolvedValue('vllm response'),
    chatWithTools: vi.fn().mockResolvedValue({ content: 'vllm tools', toolCalls: [] }),
  })),
}))

describe('ModelRouter — vLLM probe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('falls back to Ollama when vLLM is unavailable', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const { reply } = await router.chat([{ role: 'user', content: 'hi' }])
    expect(reply).toBe('ollama response')
  })

  it('uses vLLM when it is available', async () => {
    const { VllmClient } = await import('../../src/models/vllm.js')
    vi.mocked(VllmClient).mockImplementation((_url?: string) => ({
      isAvailable: vi.fn().mockResolvedValue(true),
      chat: vi.fn().mockResolvedValue('vllm response'),
      chatWithTools: vi.fn().mockResolvedValue({ content: 'vllm tools', toolCalls: [] }),
    }))

    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const { reply } = await router.chat([{ role: 'user', content: 'hi' }])
    expect(reply).toBe('vllm response')
  })

  it('caches vLLM availability after first probe', async () => {
    const { VllmClient } = await import('../../src/models/vllm.js')
    const isAvailable = vi.fn().mockResolvedValue(false)
    vi.mocked(VllmClient).mockImplementation(() => ({
      isAvailable,
      chat: vi.fn().mockResolvedValue('vllm response'),
      chatWithTools: vi.fn().mockResolvedValue({ content: '', toolCalls: [] }),
    }))

    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    await router.chat([{ role: 'user', content: 'a' }])
    await router.chat([{ role: 'user', content: 'b' }])
    // Probe should only fire once
    expect(isAvailable).toHaveBeenCalledTimes(1)
  })

  it('passes vllmUrl from config to VllmClient constructor', async () => {
    const { VllmClient } = await import('../../src/models/vllm.js')
    new ModelRouter({ ollamaUrl: 'http://localhost:11434', vllmUrl: 'http://gpu-box:8000', defaultModel: 'llama3.2' })
    expect(vi.mocked(VllmClient)).toHaveBeenCalledWith('http://gpu-box:8000')
  })
})
