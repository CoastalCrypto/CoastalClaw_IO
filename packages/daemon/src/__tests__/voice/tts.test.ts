// packages/daemon/src/__tests__/voice/tts.test.ts
import { describe, it, expect } from 'vitest'
import { synthesize } from '../../voice/tts.js'

describe('synthesize', () => {
  it('returns a Buffer in mock mode', async () => {
    const buf = await synthesize('Hello world', { mockMode: true })
    expect(buf).toBeInstanceOf(Buffer)
    expect(buf.length).toBeGreaterThan(0)
  })

  it('falls back gracefully when Piper is unavailable', async () => {
    // Should not throw even if piper binary is missing
    const buf = await synthesize('Test', {
      piperBin: '/nonexistent/piper',
      espeakFallback: true,
    })
    // Returns empty Buffer on full failure (both piper and espeak missing)
    expect(buf).toBeInstanceOf(Buffer)
  })
})
