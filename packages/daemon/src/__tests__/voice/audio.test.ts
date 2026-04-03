// packages/daemon/src/__tests__/voice/audio.test.ts
import { describe, it, expect } from 'vitest'
import { createRecorder, createPlayer } from '../../voice/audio.js'

describe('createRecorder (mock mode)', () => {
  it('returns an EventEmitter with start/stop methods', () => {
    process.env.MOCK_AUDIO = '1'
    const rec = createRecorder()
    expect(typeof rec.start).toBe('function')
    expect(typeof rec.stop).toBe('function')
    rec.stop()
    delete process.env.MOCK_AUDIO
  })

  it('emits data events when started', async () => {
    process.env.MOCK_AUDIO = '1'
    const rec = createRecorder()
    const chunk = await new Promise<Buffer>((resolve) => {
      rec.once('data', ({ data }) => resolve(data))
      rec.start()
    })
    rec.stop()
    delete process.env.MOCK_AUDIO
    expect(chunk).toBeInstanceOf(Buffer)
    expect(chunk.length).toBeGreaterThan(0)
  })
})

describe('createPlayer (mock mode)', () => {
  it('returns an object with play and stop methods', () => {
    process.env.MOCK_AUDIO = '1'
    const player = createPlayer()
    expect(typeof player.play).toBe('function')
    expect(typeof player.stop).toBe('function')
    delete process.env.MOCK_AUDIO
  })

  it('play() resolves without throwing', async () => {
    process.env.MOCK_AUDIO = '1'
    const player = createPlayer()
    await expect(player.play(Buffer.alloc(100), 16_000)).resolves.toBeUndefined()
    delete process.env.MOCK_AUDIO
  })
})
