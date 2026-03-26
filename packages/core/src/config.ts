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
  agentWorkdir: string
  soulMaxTokens: number
  agentMaxTurns: number
  toolResultMaxChars: number
  approvalTimeoutMs: number
  defaultModel: string
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
    ollamaUrl: (() => {
      const url = process.env.CC_OLLAMA_URL ?? 'http://127.0.0.1:11434'
      try {
        const { hostname } = new URL(url)
        if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
          console.warn(`[coastal-claw] Warning: CC_OLLAMA_URL points to ${hostname} — ensure this host is trusted (SSRF risk)`)
        }
      } catch {
        throw new Error(`CC_OLLAMA_URL is not a valid URL: "${url}"`)
      }
      return url
    })(),
    mem0ApiKey: process.env.MEM0_API_KEY,
    vramBudgetGb: Number(process.env.CC_VRAM_BUDGET_GB ?? '24'),
    routerConfidence: Number(process.env.CC_ROUTER_CONFIDENCE ?? '0.7'),
    tinyRouterModel: process.env.CC_TINY_ROUTER_MODEL ?? './data/tiny-router.onnx',
    quantRouterModel: process.env.CC_QUANT_ROUTER_MODEL ?? 'qwen2.5:0.5b',
    llamaCppDir: process.env.CC_LLAMA_CPP_DIR ?? './data/llama-cpp/',
    agentWorkdir: process.env.CC_AGENT_WORKDIR ?? './data/workspace',
    soulMaxTokens: Number(process.env.CC_SOUL_MAX_TOKENS ?? '1500'),
    agentMaxTurns: Number(process.env.CC_AGENT_MAX_TURNS ?? '10'),
    toolResultMaxChars: Number(process.env.CC_TOOL_RESULT_MAX_CHARS ?? '4000'),
    approvalTimeoutMs: Number(process.env.CC_APPROVAL_TIMEOUT_MS ?? '300000'),
    defaultModel: process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
  }
}
