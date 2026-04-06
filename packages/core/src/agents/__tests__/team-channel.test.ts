import { describe, it, expect } from 'vitest'
import { TeamChannel } from '../team-channel.js'

describe('TeamChannel', () => {
  it('subscriber receives posted message', () => {
    const channel = new TeamChannel()
    const received: unknown[] = []
    channel.subscribe('agent-b', (msg) => received.push(msg))
    channel.post('agent-a', 'agent-b', { type: 'task', payload: 'do something' })
    expect(received).toHaveLength(1)
    expect((received[0] as any).payload).toBe('do something')
  })

  it('broadcast reaches all subscribers', () => {
    const channel = new TeamChannel()
    const a: unknown[] = [], b: unknown[] = []
    channel.subscribe('agent-a', (m) => a.push(m))
    channel.subscribe('agent-b', (m) => b.push(m))
    channel.broadcast('boss', { type: 'status', payload: 'done' })
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
  })

  it('unsubscribe stops delivery', () => {
    const channel = new TeamChannel()
    const received: unknown[] = []
    const unsub = channel.subscribe('agent-a', (m) => received.push(m))
    unsub()
    channel.post('boss', 'agent-a', { type: 'task', payload: 'hello' })
    expect(received).toHaveLength(0)
  })

  it('message to unknown agent is silently dropped', () => {
    const channel = new TeamChannel()
    expect(() => channel.post('a', 'nobody', { type: 'task', payload: '' })).not.toThrow()
  })
})
