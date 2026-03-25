import { OllamaClient, type ChatMessage } from '../models/ollama.js'

const DOMAIN_KEYWORDS = {
  cfo: ['burn rate', 'runway', 'arr', 'mrr', 'fundraising', 'cap table', 'revenue', 'budget', 'forecast'],
  cto: ['architecture', 'tech stack', 'deployment', 'api', 'database', 'latency', 'infrastructure', 'code'],
  coo: ['hiring', 'team', 'process', 'operations', 'roadmap', 'headcount', 'okr', 'workflow'],
} as const

type Domain = 'coo' | 'cfo' | 'cto' | 'general'

export interface DomainResult {
  domain: Domain
  confidence: number
  classifiedBy: 'rules' | 'llm'
}

export interface DomainClassifierConfig {
  ollamaUrl: string
  routerModel: string
  confidenceThreshold: number
}

const DOMAIN_PROMPT = `You are a message classifier. Given a user message, classify which executive domain it belongs to.

Domains:
- cfo: financial topics (burn rate, revenue, fundraising, budgets, forecasting)
- cto: technical topics (architecture, code, databases, deployment, infrastructure)
- coo: operational topics (hiring, team management, processes, roadmaps, operations)
- general: anything that doesn't clearly fit the above

Respond ONLY with valid JSON in this exact format: {"domain":"cfo","confidence":0.9}
No other text.`

export class DomainClassifier {
  private ollama: OllamaClient

  constructor(private config: DomainClassifierConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
  }

  async classify(message: string): Promise<DomainResult> {
    const lower = message.toLowerCase()

    // Stage 1: rules pass
    let bestDomain: Domain = 'general'
    let bestMatches = 0
    let bestKeywordCount = 1

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const matches = keywords.filter(kw => lower.includes(kw)).length
      if (matches > bestMatches) {
        bestMatches = matches
        bestDomain = domain as Domain
        bestKeywordCount = keywords.length
      }
    }

    const rulesConfidence = bestMatches > 0 ? bestMatches / bestKeywordCount : 0

    if (rulesConfidence >= this.config.confidenceThreshold) {
      return { domain: bestDomain, confidence: rulesConfidence, classifiedBy: 'rules' }
    }

    // Stage 2: LLM fallback
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: DOMAIN_PROMPT },
        { role: 'user', content: message },
      ]
      const raw = await this.ollama.chat(this.config.routerModel, messages)
      const parsed = JSON.parse(raw.trim()) as { domain: string; confidence: number }
      const validDomains: Domain[] = ['coo', 'cfo', 'cto', 'general']
      const domain = validDomains.includes(parsed.domain as Domain)
        ? (parsed.domain as Domain)
        : 'general'
      return { domain, confidence: parsed.confidence ?? 0.5, classifiedBy: 'llm' }
    } catch {
      return { domain: 'general', confidence: 0.5, classifiedBy: 'llm' }
    }
  }
}
