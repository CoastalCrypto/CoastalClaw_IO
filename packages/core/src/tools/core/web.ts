import type { CoreTool } from './file.js'

export const webTools: CoreTool[] = [
  {
    definition: {
      name: 'http_get',
      description: 'Fetch a URL and return the response body as text.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'URL to fetch' } },
        required: ['url'],
      },
      reversible: true,
    },
    execute: async (args) => {
      try {
        const res = await fetch(String(args.url), { signal: AbortSignal.timeout(10_000) })
        const text = await res.text()
        return text.slice(0, 4000)  // cap at tool result limit
      } catch (e: any) {
        return `Fetch error: ${e.message}`
      }
    },
  },
]
