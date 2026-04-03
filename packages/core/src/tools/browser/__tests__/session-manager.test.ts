// packages/core/src/tools/browser/__tests__/session-manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BrowserSessionManager } from '../session-manager.js'

describe('BrowserSessionManager', () => {
  let manager: BrowserSessionManager

  beforeEach(() => { manager = new BrowserSessionManager() }, 30_000)
  afterEach(async () => { await manager.closeAll() }, 30_000)

  it('getOrCreate returns a page for an agentId', async () => {
    const page = await manager.getOrCreate('cfo')
    expect(page).toBeDefined()
    expect(typeof page.goto).toBe('function')
  }, 30_000)

  it('getOrCreate returns the same page on second call', async () => {
    const page1 = await manager.getOrCreate('cfo')
    const page2 = await manager.getOrCreate('cfo')
    expect(page1).toBe(page2)
  }, 30_000)

  it('different agents get different pages', async () => {
    const cfo = await manager.getOrCreate('cfo')
    const cto = await manager.getOrCreate('cto')
    expect(cfo).not.toBe(cto)
  }, 30_000)

  it('closeSession removes the agent session', async () => {
    await manager.getOrCreate('cfo')
    await manager.closeSession('cfo')
    // After close, getOrCreate creates a fresh page (new object)
    const fresh = await manager.getOrCreate('cfo')
    expect(fresh).toBeDefined()
  }, 30_000)

  it('closeAll closes all sessions', async () => {
    await manager.getOrCreate('cfo')
    await manager.getOrCreate('cto')
    await manager.closeAll() // should not throw
  }, 30_000)
})
