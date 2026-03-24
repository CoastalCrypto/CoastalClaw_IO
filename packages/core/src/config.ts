export interface Config {
  port: number
  host: string
  dataDir: string
  ollamaUrl: string
  mem0ApiKey: string | undefined
  vramBudgetGb: number
  routerConfidence: number
  tinyRouterModel: string
  quantRouterModel: string
  llamaCppDir: string
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
    vramBudgetGb: Number(process.env.CC_VRAM_BUDGET_GB ?? '24'),
    routerConfidence: Number(process.env.CC_ROUTER_CONFIDENCE ?? '0.7'),
    tinyRouterModel: process.env.CC_TINY_ROUTER_MODEL ?? './data/tiny-router.onnx',
    quantRouterModel: process.env.CC_QUANT_ROUTER_MODEL ?? 'qwen2.5:0.5b',
    llamaCppDir: process.env.CC_LLAMA_CPP_DIR ?? './data/llama-cpp/',
  }
}
