import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DomainClassifier } from '../../src/routing/domain-classifier.js'

// Mock OllamaClient so LLM fallback is controllable in tests
vi.mock('../../src/models/ollama.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue('{"domain":"cfo","confidence":0.9}'),
  })),
}))

describe('DomainClassifier', () => {
  let classifier: DomainClassifier

  beforeEach(() => {
    classifier = new DomainClassifier({
      ollamaUrl: 'http://localhost:11434',
      routerModel: 'qwen2.5:0.5b',
      confidenceThreshold: 0.7,
    })
  })

  it('rules pass: identifies cfo domain from keywords', async () => {
    // 7 of 9 cfo keywords → confidence 0.78 → above threshold
    const msg = 'review burn rate runway arr mrr fundraising cap table revenue budget forecast'
    const result = await classifier.classify(msg)
    expect(result.domain).toBe('cfo')
    expect(result.classifiedBy).toBe('rules')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('rules pass: selects domain with most keyword matches', async () => {
    // 6 of 8 cto keywords → confidence 0.75 → above threshold → rules path fires
    const msg = 'review architecture tech stack deployment api database latency infrastructure'
    const result = await classifier.classify(msg)
    expect(result.domain).toBe('cto')
    expect(result.classifiedBy).toBe('rules')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('llm fallback: fires when rules confidence is low', async () => {
    // Only 1 keyword match → low confidence → LLM fires
    const msg = 'what is our runway?'
    const result = await classifier.classify(msg)
    expect(result.classifiedBy).toBe('llm')
    expect(result.domain).toBe('cfo')
  })

  it('llm fallback: defaults to general on malformed response', async () => {
    const { OllamaClient } = await import('../../src/models/ollama.js')
    vi.mocked(OllamaClient).mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue('not valid json at all'),
      listModels: vi.fn(),
    }))
    const badClassifier = new DomainClassifier({
      ollamaUrl: 'http://localhost:11434',
      routerModel: 'qwen2.5:0.5b',
      confidenceThreshold: 0.7,
    })
    const result = await badClassifier.classify('what is our runway?')
    expect(result.domain).toBe('general')
    expect(result.confidence).toBe(0.5)
  })
})
