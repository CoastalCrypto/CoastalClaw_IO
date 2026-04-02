// packages/core/src/tools/browser/session-manager.ts
import { chromium } from 'playwright'
import type { Browser, BrowserContext, Page } from 'playwright'

interface AgentSession {
  context: BrowserContext
  page: Page
}

export class BrowserSessionManager {
  private browser: Browser | null = null
  private sessions = new Map<string, AgentSession>()

  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      this.browser = await chromium.launch({ headless: true })
    }
    return this.browser
  }

  async getOrCreate(agentId: string): Promise<Page> {
    const existing = this.sessions.get(agentId)
    if (existing) return existing.page

    const browser = await this.getBrowser()
    const context = await browser.newContext()
    const page = await context.newPage()
    this.sessions.set(agentId, { context, page })
    return page
  }

  async closeSession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId)
    if (!session) return
    try { await session.context.close() } catch {}
    this.sessions.delete(agentId)
  }

  async closeAll(): Promise<void> {
    for (const [id] of this.sessions) {
      await this.closeSession(id)
    }
    try { await this.browser?.close() } catch {}
    this.browser = null
  }
}
