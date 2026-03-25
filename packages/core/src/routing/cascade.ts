import { TinyRouterClient } from './tiny-router.js'
import { DomainClassifier } from './domain-classifier.js'
import { DomainModelRegistry } from './domain-registry.js'
import { VRAMManager } from './vram-manager.js'
import { ModelRegistry } from '../models/registry.js'
import type { RouteDecision } from './types.js'
import { join } from 'node:path'

export interface CascadeRouterConfig {
  ollamaUrl: string
  dataDir: string
  routerConfidence: number
  tinyRouterModel: string
  quantRouterModel: string
  vramBudgetGb: number
}

export class CascadeRouter {
  private tiny: TinyRouterClient
  private domain: DomainClassifier
  private registry: DomainModelRegistry
  private vram: VRAMManager
  private models: ModelRegistry

  constructor(config: CascadeRouterConfig) {
    this.models = new ModelRegistry(config.dataDir)
    this.tiny = new TinyRouterClient(config.tinyRouterModel)
    this.domain = new DomainClassifier({
      ollamaUrl: config.ollamaUrl,
      routerModel: config.quantRouterModel,
      confidenceThreshold: config.routerConfidence,
    })
    this.registry = new DomainModelRegistry(join(config.dataDir, 'model-registry.json'))
    this.vram = new VRAMManager({
      ollamaUrl: config.ollamaUrl,
      budgetGb: config.vramBudgetGb,
      getVariants: (baseName) => this.models.getVariants(baseName),
    })
  }

  async route(message: string): Promise<RouteDecision> {
    const [signals, domainResult] = await Promise.all([
      this.tiny.classify(message),
      this.domain.classify(message),
    ])

    const preferredModel = this.registry.resolve(domainResult.domain, signals.urgency)

    // VRAMManager may fail if Ollama is unreachable — fall back to registry model directly
    let model = preferredModel
    try {
      model = await this.vram.selectQuant(preferredModel)
    } catch {
      // Ollama unavailable: use registry model as-is
    }

    return {
      model,
      domain: domainResult.domain,
      signals,
      domainConfidence: domainResult.confidence,
      classifiedBy: domainResult.classifiedBy,
    }
  }

  close(): void {
    this.registry.close()
    this.models.close()
  }
}
