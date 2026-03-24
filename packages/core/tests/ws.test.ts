import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server.js'
import WebSocket from 'ws'

describe('WebSocket session channel', () => {
  let server: Awaited<ReturnType<typeof buildServer>>
  let address: string

  beforeAll(async () => {
    server = await buildServer()
    await server.listen({ port: 0, host: '127.0.0.1' })
    const port = (server.server.address() as { port: number }).port
    address = `ws://127.0.0.1:${port}/ws/session`
  })

  afterAll(async () => {
    await server.close()
  })

  it('accepts connection and responds to ping', async () => {
    const ws = new WebSocket(address)
    await new Promise<void>((resolve) => ws.on('open', resolve))
    ws.send(JSON.stringify({ type: 'ping' }))
    const msg = await new Promise<string>((resolve) => ws.on('message', (d) => resolve(d.toString())))
    const parsed = JSON.parse(msg)
    expect(parsed.type).toBe('pong')
    ws.close()
  })
})
