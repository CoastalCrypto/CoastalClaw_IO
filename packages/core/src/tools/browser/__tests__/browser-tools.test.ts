// packages/core/src/tools/browser/__tests__/browser-tools.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createBrowserTools } from '../browser-tools.js'
import { BrowserSessionManager } from '../session-manager.js'

describe('browser tools', () => {
  let manager: BrowserSessionManager
  let tools: ReturnType<typeof createBrowserTools>

  beforeEach(() => {
    manager = new BrowserSessionManager()
    tools = createBrowserTools(manager)
  })
  afterEach(async () => { await manager.closeAll() })

  it('exports 6 tool definitions', () => {
    expect(tools).toHaveLength(6)
    const names = tools.map(t => t.definition.name)
    expect(names).toContain('browser_navigate')
    expect(names).toContain('browser_read')
    expect(names).toContain('browser_click')
    expect(names).toContain('browser_fill')
    expect(names).toContain('browser_screenshot')
    expect(names).toContain('browser_close')
  })

  it('all browser tools are non-reversible', () => {
    for (const t of tools) {
      expect(t.definition.reversible).toBe(false)
    }
  })

  it('browser_navigate returns page title', async () => {
    const nav = tools.find(t => t.definition.name === 'browser_navigate')!
    const result = await nav.execute({ agentId: 'test', url: 'about:blank' })
    expect(typeof result).toBe('string')
    expect(result).not.toContain('Error:')
  }, 30_000)

  it('browser_close returns ok message', async () => {
    const close = tools.find(t => t.definition.name === 'browser_close')!
    // Open a session first
    await manager.getOrCreate('test-close')
    const result = await close.execute({ agentId: 'test-close' })
    expect(result).toContain('closed')
  }, 30_000)
})
