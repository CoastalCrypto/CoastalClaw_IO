import { describe, it, expect } from 'vitest'
import { AcpSessionStore } from '../sessions.js'

describe('AcpSessionStore', () => {
  it('creates sessions with unique ids and null domain', () => {
    const store = new AcpSessionStore()
    const a = store.create()
    const b = store.create()
    expect(a.id).not.toBe(b.id)
    expect(a.domain).toBeNull()
    expect(a.history).toEqual([])
    expect(a.pendingPrompt).toBeNull()
  })

  it('get returns the same instance; unknown id returns undefined', () => {
    const store = new AcpSessionStore()
    const s = store.create()
    expect(store.get(s.id)).toBe(s)
    expect(store.get('does-not-exist')).toBeUndefined()
  })

  it('list returns all created sessions', () => {
    const store = new AcpSessionStore()
    const a = store.create()
    const b = store.create()
    expect(store.list()).toHaveLength(2)
    expect(store.list().map((s) => s.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('appendUser and appendAssistant grow history in order', () => {
    const store = new AcpSessionStore()
    const s = store.create()
    store.appendUser(s.id, 'hello')
    store.appendAssistant(s.id, 'hi there')
    store.appendUser(s.id, 'how are you?')
    expect(s.history).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'how are you?' },
    ])
  })

  it('appendUser throws on unknown session', () => {
    const store = new AcpSessionStore()
    expect(() => store.appendUser('missing', 'x')).toThrow(/ACP session not found/)
  })

  it('setDomain locks after the first set', () => {
    const store = new AcpSessionStore()
    const s = store.create()
    store.setDomain(s.id, 'cfo')
    expect(s.domain).toBe('cfo')
    store.setDomain(s.id, 'cto')
    expect(s.domain).toBe('cfo')
  })

  it('abort calls .abort() on pending controller and clears it', () => {
    const store = new AcpSessionStore()
    const s = store.create()
    const ctl = new AbortController()
    s.pendingPrompt = ctl
    store.abort(s.id)
    expect(ctl.signal.aborted).toBe(true)
    expect(s.pendingPrompt).toBeNull()
  })

  it('abort on unknown session is a no-op', () => {
    const store = new AcpSessionStore()
    expect(() => store.abort('missing')).not.toThrow()
  })
})
