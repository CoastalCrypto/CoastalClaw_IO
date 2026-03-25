import { existsSync, readFileSync, watch, type FSWatcher } from 'node:fs'

type UrgencyLevel = 'high' | 'medium' | 'low'
type DomainName = 'coo' | 'cfo' | 'cto' | 'general'

interface ModelRegistry {
  cfo: Record<UrgencyLevel, string>
  cto: Record<UrgencyLevel, string>
  coo: Record<UrgencyLevel, string>
  general: Record<UrgencyLevel, string>
}

const FINAL_FALLBACK = 'llama3.2:1b'

const DEFAULT_REGISTRY: ModelRegistry = {
  cfo:     { high: 'llama3.1:8b-q4_K_M', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
  cto:     { high: 'llama3.1:8b-q4_K_M', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
  coo:     { high: 'llama3.1:8b-q4_K_M', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
  general: { high: 'llama3.1:8b-q4_K_M', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
}

export class DomainModelRegistry {
  private registry: ModelRegistry = { ...DEFAULT_REGISTRY }
  private watcher: FSWatcher | null = null

  constructor(private filePath: string) {
    this.load()
    if (existsSync(filePath)) {
      this.watcher = watch(filePath, { persistent: false }, () => this.load())
    }
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        console.warn(`[DomainModelRegistry] Invalid registry shape in ${this.filePath}, keeping previous config`)
        return
      }
      this.registry = parsed as ModelRegistry
    } catch {
      console.warn(`[DomainModelRegistry] Failed to parse ${this.filePath}, keeping previous config`)
    }
  }

  resolve(domain: DomainName, urgency: UrgencyLevel): string {
    const URGENCY_ORDER: UrgencyLevel[] = ['high', 'medium', 'low']
    const startIdx = URGENCY_ORDER.indexOf(urgency)
    for (let i = startIdx; i < URGENCY_ORDER.length; i++) {
      const model = this.registry[domain]?.[URGENCY_ORDER[i]]
      if (model) return model
    }
    return FINAL_FALLBACK
  }

  close(): void {
    this.watcher?.close()
  }
}
