import { describe, it, expect, vi, afterEach } from 'vitest'
import { VibeVoiceClient } from '../vibevoice.js'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'

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

describe('VibeVoiceClient.speak — sample rate protocol', () => {
  let wss: WebSocketServer

  afterEach(() => new Promise<void>(res => wss?.close(() => res())))

  function startServer(handler: (ws: WebSocket) => void): Promise<number> {
    return new Promise(resolve => {
      wss = new WebSocketServer({ port: 0 })
      wss.on('connection', handler)
      wss.once('listening', () => resolve((wss.address() as AddressInfo).port))
    })
  }

  it('yields { pcm, sampleRate: 22050 } when server sends metadata frame', async () => {
    const pcmData = Buffer.alloc(100, 0x42)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(JSON.stringify({ sample_rate: 22050, channels: 1 }))
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../vibevoice.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('hello')) results.push(chunk)

    expect(results).toHaveLength(1)
    expect(results[0].sampleRate).toBe(22050)
    expect(results[0].pcm).toEqual(pcmData)
  })

  it('falls back to sampleRate 24000 when server sends no metadata frame', async () => {
    const pcmData = Buffer.alloc(50, 0x01)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../vibevoice.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('hello')) results.push(chunk)

    expect(results[0].sampleRate).toBe(24_000)
    expect(results[0].pcm).toEqual(pcmData)
  })
})
