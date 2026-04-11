import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type TrustLevel = 'sandboxed' | 'trusted' | 'autonomous'

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
  agentTrustLevel: TrustLevel
  vllmUrl: string
  airllmUrl: string
  infinityUrl: string
  vibeVoiceUrl: string
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
          console.warn(`[coastal-ai] Warning: CC_OLLAMA_URL points to ${hostname} — ensure this host is trusted (SSRF risk)`)
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
    vllmUrl: process.env.CC_VLLM_URL ?? 'http://127.0.0.1:8000',
    airllmUrl: process.env.CC_AIRLLM_URL ?? 'http://127.0.0.1:8002',
    infinityUrl: process.env.CC_INFINITY_URL ?? 'http://127.0.0.1:23817',
    vibeVoiceUrl: process.env.CC_VIBEVOICE_URL ?? 'http://127.0.0.1:8001',
    agentTrustLevel: (() => {
      // File-based override takes precedence over env var
      const dataDir = process.env.CC_DATA_DIR ?? './data'
      const trustFile = join(dataDir, '.trust-level')
      const raw = (existsSync(trustFile)
        ? readFileSync(trustFile, 'utf8').trim()
        : null) ?? process.env.CC_TRUST_LEVEL ?? 'sandboxed'
      if (!['sandboxed', 'trusted', 'autonomous'].includes(raw)) {
        throw new Error(`Trust level must be 'sandboxed'|'trusted'|'autonomous', got: "${raw}"`)
      }
      return raw as TrustLevel
    })(),
  }
}
