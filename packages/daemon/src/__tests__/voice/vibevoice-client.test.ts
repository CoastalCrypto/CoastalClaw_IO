import { describe, it, expect, afterEach } from 'vitest'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'

describe('VibeVoiceClient (daemon) — sample rate protocol', () => {
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
    const pcmData = Buffer.alloc(64, 0x10)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(JSON.stringify({ sample_rate: 22050, channels: 1 }))
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../../voice/vibevoice-client.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('test')) results.push(chunk)

    expect(results).toHaveLength(1)
    expect(results[0].sampleRate).toBe(22050)
    expect(results[0].pcm).toEqual(pcmData)
  })

  it('falls back to sampleRate 24000 when no metadata frame', async () => {
    const pcmData = Buffer.alloc(32, 0x20)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../../voice/vibevoice-client.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('test')) results.push(chunk)

    expect(results[0].sampleRate).toBe(24_000)
  })
})
