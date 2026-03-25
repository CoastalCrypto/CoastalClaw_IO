import { describe, it, expect, vi } from 'vitest'
import { CascadeRouter } from '../../src/routing/cascade.js'

// Mock all sub-components
vi.mock('../../src/routing/tiny-router.js', () => ({
  TinyRouterClient: vi.fn().mockImplementation(() => ({
    classify: vi.fn().mockResolvedValue({
      relation: 'new', urgency: 'high', actionability: 'act',
      retention: 'remember', confidence: 0.85,
    }),
  })),
}))

vi.mock('../../src/routing/domain-classifier.js', () => ({
  DomainClassifier: vi.fn().mockImplementation(() => ({
    classify: vi.fn().mockResolvedValue({ domain: 'cfo', confidence: 0.9, classifiedBy: 'rules' }),
  })),
}))

vi.mock('../../src/routing/domain-registry.js', () => ({
  DomainModelRegistry: vi.fn().mockImplementation(() => ({
    resolve: vi.fn().mockReturnValue('finma:7b-q5_K_M'),
    close: vi.fn(),
  })),
}))

vi.mock('../../src/routing/vram-manager.js', () => ({
  VRAMManager: vi.fn().mockImplementation(() => ({
    selectQuant: vi.fn().mockResolvedValue('finma:7b-Q5_K_M'),
  })),
}))

vi.mock('../../src/models/registry.js', () => ({
  ModelRegistry: vi.fn().mockImplementation(() => ({
    getVariants: vi.fn().mockReturnValue([]),
    close: vi.fn(),
  })),
}))

describe('CascadeRouter', () => {
  const makeRouter = () => new CascadeRouter({
    ollamaUrl: 'http://localhost:11434',
    dataDir: '/tmp/test',
    routerConfidence: 0.7,
    tinyRouterModel: '/nonexistent.onnx',
    quantRouterModel: 'qwen2.5:0.5b',
    vramBudgetGb: 24,
  })

  it('returns a complete RouteDecision', async () => {
    const router = makeRouter()
    const decision = await router.route('what is our burn rate and runway?')
    expect(decision.domain).toBe('cfo')
    expect(decision.model).toBe('finma:7b-Q5_K_M')
    expect(decision.signals.urgency).toBe('high')
    expect(decision.signals.retention).toBe('remember')
    expect(decision.classifiedBy).toBe('rules')
    expect(decision.domainConfidence).toBe(0.9)
    router.close()
  })

  it('exposes signals from TinyRouter in the decision', async () => {
    const router = makeRouter()
    const decision = await router.route('test message')
    expect(decision.signals.actionability).toBe('act')
    expect(decision.signals.relation).toBe('new')
    router.close()
  })

  it('uses fallback defaults when Ollama/VRAMManager is unavailable', async () => {
    // Override VRAMManager mock to simulate Ollama being unreachable
    const { VRAMManager } = await import('../../src/routing/vram-manager.js')
    vi.mocked(VRAMManager).mockImplementationOnce(() => ({
      selectQuant: vi.fn().mockRejectedValue(new Error('connection refused')),
    }))
    const router = makeRouter()
    // Should not throw — falls back to the domain-registry resolved model directly
    const decision = await router.route('what is our burn rate?')
    expect(decision).toHaveProperty('model')
    expect(typeof decision.model).toBe('string')
    expect(decision.model.length).toBeGreaterThan(0)
    expect(decision.model).toBe('finma:7b-q5_K_M')
    router.close()
  })
})
