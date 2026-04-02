// packages/daemon/src/__tests__/voice/stt.test.ts
import { describe, it, expect } from 'vitest'
import { transcribe } from '../../voice/stt.js'

describe('transcribe', () => {
  it('returns mock transcription in mockMode', async () => {
    const result = await transcribe(Buffer.alloc(1000), { mockMode: true })
    expect(result.text).toBe('mock transcription')
    expect(result.language).toBe('en')
  })

  it('returns empty string when model file is missing', async () => {
    // NODE_ENV=test triggers mock path, so test explicit non-existent path
    const result = await transcribe(Buffer.alloc(100), {
      mockMode: false,
      modelPath: '/nonexistent/ggml-tiny.en.bin',
    })
    expect(result.text).toBe('')
    expect(result.language).toBe('en')
  })
})
