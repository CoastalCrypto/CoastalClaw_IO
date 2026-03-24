export interface Config {
  port: number
  host: string
  dataDir: string
  ollamaUrl: string
  mem0ApiKey: string | undefined
}

export function loadConfig(): Config {
  return {
    port: process.env.CC_PORT ? parseInt(process.env.CC_PORT, 10) : 4747,
    host: process.env.CC_HOST ?? '127.0.0.1',
    dataDir: process.env.CC_DATA_DIR ?? './data',
    ollamaUrl: process.env.CC_OLLAMA_URL ?? 'http://127.0.0.1:11434',
    mem0ApiKey: process.env.MEM0_API_KEY,
  }
}
