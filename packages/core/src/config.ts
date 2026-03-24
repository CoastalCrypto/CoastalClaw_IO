export interface Config {
  port: number
  host: string
  dataDir: string
  ollamaUrl: string
  mem0ApiKey: string | undefined
}

export function loadConfig(): Config {
  return {
    port: (() => {
      const raw = process.env.CC_PORT
      if (!raw) return 4747
      const parsed = parseInt(raw, 10)
      if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error(`CC_PORT must be a valid port number (1-65535), got: "${raw}"`)
      }
      return parsed
    })(),
    host: process.env.CC_HOST ?? '127.0.0.1',
    dataDir: process.env.CC_DATA_DIR ?? './data',
    ollamaUrl: process.env.CC_OLLAMA_URL ?? 'http://127.0.0.1:11434',
    mem0ApiKey: process.env.MEM0_API_KEY,
  }
}
