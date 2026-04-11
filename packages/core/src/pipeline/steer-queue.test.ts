import { describe, it, expect } from 'vitest'
import { SteerQueue } from './steer-queue.js'

describe('SteerQueue', () => {
  it('drains queued messages for a runId', () => {
    const q = new SteerQueue()
    q.push('run1', 'hello')
    q.push('run1', 'world')
    expect(q.drain('run1')).toEqual(['hello', 'world'])
  })

  it('returns empty array when no messages', () => {
    const q = new SteerQueue()
    expect(q.drain('no-such-run')).toEqual([])
  })

  it('draining clears the queue', () => {
    const q = new SteerQueue()
    q.push('run1', 'msg')
    q.drain('run1')
    expect(q.drain('run1')).toEqual([])
  })

  it('cleanup removes the entry', () => {
    const q = new SteerQueue()
    q.push('run1', 'msg')
    q.cleanup('run1')
    expect(q.drain('run1')).toEqual([])
  })

  it('isolates different runIds', () => {
    const q = new SteerQueue()
    q.push('run1', 'a')
    q.push('run2', 'b')
    expect(q.drain('run1')).toEqual(['a'])
    expect(q.drain('run2')).toEqual(['b'])
  })
})
