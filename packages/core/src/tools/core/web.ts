import type { CoreTool } from './file.js'

// Block private/internal IP ranges and cloud metadata endpoints (SSRF prevention)
const BLOCKED_HOSTS = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|::1|fc00:|fe80:)/i

function validateUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw)
    if (!['http:', 'https:'].includes(parsed.protocol)) return 'Error: only http and https URLs are allowed'
    if (BLOCKED_HOSTS.test(parsed.hostname)) return `Error: requests to private/internal addresses are blocked (${parsed.hostname})`
    return null
  } catch {
    return 'Error: invalid URL'
  }
}

export const webTools: CoreTool[] = [
  {
    definition: {
      name: 'http_get',
      description: 'Fetch a public URL and return the response body as text. Private/internal addresses are blocked.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: 'Public URL to fetch (https preferred)' } },
        required: ['url'],
      },
      reversible: false,
    },
    execute: async (args) => {
      const urlError = validateUrl(String(args.url))
      if (urlError) return urlError
      try {
        const res = await fetch(String(args.url), { signal: AbortSignal.timeout(10_000) })
        const text = await res.text()
        return text.slice(0, 4000)
      } catch (e: any) {
        return `Fetch error: ${e.message}`
      }
    },
  },
]
