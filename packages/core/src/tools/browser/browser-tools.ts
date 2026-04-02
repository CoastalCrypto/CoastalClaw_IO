// packages/core/src/tools/browser/browser-tools.ts
import type { CoreTool } from '../core/file.js'
import type { BrowserSessionManager } from './session-manager.js'

export function createBrowserTools(manager: BrowserSessionManager): CoreTool[] {
  return [
    {
      definition: {
        name: 'browser_navigate',
        description: 'Navigate the agent\'s browser to a URL. Returns page title and HTTP status.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID owning this browser session' },
            url: { type: 'string', description: 'URL to navigate to' },
          },
          required: ['agentId', 'url'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId, url } = args as { agentId: string; url: string }
        try {
          const page = await manager.getOrCreate(agentId)
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
          const title = await page.title()
          const status = response?.status() ?? 0
          return `Navigated to ${url} — title: "${title}", status: ${status}`
        } catch (e: any) {
          return `Error: browser_navigate failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_read',
        description: 'Extract all visible text content from the current page.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId } = args as { agentId: string }
        try {
          const page = await manager.getOrCreate(agentId)
          const text = await page.evaluate(() => document.body.innerText ?? '')
          return text.slice(0, 8000) || '(empty page)'
        } catch (e: any) {
          return `Error: browser_read failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_click',
        description: 'Click an element by CSS selector or visible text.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            selector: { type: 'string', description: 'CSS selector or text content to click' },
          },
          required: ['agentId', 'selector'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId, selector } = args as { agentId: string; selector: string }
        try {
          const page = await manager.getOrCreate(agentId)
          await page.click(selector, { timeout: 10_000 })
          return `Clicked: ${selector}`
        } catch (e: any) {
          return `Error: browser_click failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_fill',
        description: 'Fill a form input field with a value.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
            selector: { type: 'string', description: 'CSS selector for the input field' },
            value: { type: 'string', description: 'Value to type into the field' },
          },
          required: ['agentId', 'selector', 'value'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId, selector, value } = args as { agentId: string; selector: string; value: string }
        try {
          const page = await manager.getOrCreate(agentId)
          await page.fill(selector, value, { timeout: 10_000 })
          return `Filled ${selector}`
        } catch (e: any) {
          return `Error: browser_fill failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_screenshot',
        description: 'Capture a screenshot of the current page. Returns base64-encoded PNG.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId } = args as { agentId: string }
        try {
          const page = await manager.getOrCreate(agentId)
          const buf = await page.screenshot({ type: 'png', fullPage: false })
          return `data:image/png;base64,${buf.toString('base64')}`
        } catch (e: any) {
          return `Error: browser_screenshot failed — ${e.message}`
        }
      },
    },
    {
      definition: {
        name: 'browser_close',
        description: 'Close the agent\'s browser session. Login state is lost.',
        parameters: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID' },
          },
          required: ['agentId'],
        },
        reversible: false,
      },
      async execute(args) {
        const { agentId } = args as { agentId: string }
        await manager.closeSession(agentId)
        return `Browser session closed for agent: ${agentId}`
      },
    },
  ]
}
