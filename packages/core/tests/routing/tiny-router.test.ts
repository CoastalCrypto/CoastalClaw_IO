import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { TinyRouterClient } from '../../src/routing/tiny-router.js'

describe('TinyRouterClient', () => {
  it('returns fallback signals when ONNX file does not exist', async () => {
    const client = new TinyRouterClient('/nonexistent/path/model.onnx')
    const signals = await client.classify('what is our burn rate?')
    expect(signals.relation).toBe('new')
    expect(signals.urgency).toBe('medium')
    expect(signals.actionability).toBe('act')
    expect(signals.retention).toBe('useful')
    expect(signals.confidence).toBe(0)
  })

  it('returns a valid RouteSignals shape', async () => {
    const client = new TinyRouterClient('/nonexistent/path/model.onnx')
    const signals = await client.classify('hello')
    expect(['new','follow_up','correction','confirmation','cancellation','closure']).toContain(signals.relation)
    expect(['none','review','act']).toContain(signals.actionability)
    expect(['ephemeral','useful','remember']).toContain(signals.retention)
    expect(['low','medium','high']).toContain(signals.urgency)
    expect(typeof signals.confidence).toBe('number')
  })
})

const MODEL_PATH = process.env.CC_TINY_ROUTER_MODEL ?? './data/tiny-router.onnx'
const modelAvailable = existsSync(MODEL_PATH)

describe.skipIf(!modelAvailable)('TinyRouterClient — live ONNX inference', () => {
  it('returns non-zero confidence when model is present', async () => {
    const client = new TinyRouterClient(MODEL_PATH)
    const signals = await client.classify('what is our burn rate?')
    expect(signals.confidence).toBeGreaterThan(0)
  })

  it('maps relation output to a valid relation label', async () => {
    const client = new TinyRouterClient(MODEL_PATH)
    const signals = await client.classify('follow up on the budget discussion')
    expect(['new','follow_up','correction','confirmation','cancellation','closure']).toContain(signals.relation)
  })
})
