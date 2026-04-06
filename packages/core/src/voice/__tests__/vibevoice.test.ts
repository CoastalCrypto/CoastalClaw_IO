import { describe, it, expect, vi } from 'vitest'
import { VibeVoiceClient } from '../vibevoice.js'

describe('VibeVoiceClient', () => {
  it('isAvailable returns false when unreachable', async () => {
    const client = new VibeVoiceClient('http://127.0.0.1:19996')
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect(await new VibeVoiceClient().isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('transcribe posts audio and returns structured transcript', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'hello world',
        speakers: [{ id: 'speaker_0', start: 0.0, end: 1.5, text: 'hello world' }],
      }),
    }))
    const client = new VibeVoiceClient()
    const result = await client.transcribe(Buffer.from('audio-data'))
    expect(result.text).toBe('hello world')
    expect(result.speakers).toHaveLength(1)
    expect(result.speakers[0].id).toBe('speaker_0')
    vi.unstubAllGlobals()
  })

  it('transcribe throws on error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'model loading',
    }))
    await expect(new VibeVoiceClient().transcribe(Buffer.from('')))
      .rejects.toThrow('VibeVoice ASR error 503')
    vi.unstubAllGlobals()
  })
})
