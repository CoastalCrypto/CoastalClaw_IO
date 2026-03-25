const QUANT_ORDER = ['Q8_0', 'Q6_K', 'Q5_K_M', 'Q4_K_M', 'Q4_0'] as const
type QuantLevel = typeof QUANT_ORDER[number]

interface OllamaLoadedModel {
  name: string
  size_vram: number
}

interface ModelVariant {
  id: string
  quantLevel: string
  sizeGb: number
}

export interface VRAMManagerConfig {
  ollamaUrl: string
  budgetGb: number
  getVariants: (baseName: string) => ModelVariant[]
}

export class VRAMManager {
  constructor(private config: VRAMManagerConfig) {}

  private async getLoadedModels(): Promise<OllamaLoadedModel[]> {
    try {
      const res = await fetch(`${this.config.ollamaUrl}/api/ps`)
      if (!res.ok) return []
      const data = await res.json() as { models: OllamaLoadedModel[] }
      return data.models ?? []
    } catch {
      return []
    }
  }

  async selectQuant(baseName: string): Promise<string> {
    const loaded = await this.getLoadedModels()

    // If the model is already loaded at any quant, return it directly
    const alreadyLoaded = loaded.find(m =>
      m.name === baseName ||
      m.name.startsWith(baseName + ':') ||
      m.name.startsWith(baseName + '-')
    )
    if (alreadyLoaded) return alreadyLoaded.name

    // Calculate available VRAM
    const usedBytes = loaded.reduce((sum, m) => sum + (m.size_vram ?? 0), 0)
    const budgetBytes = this.config.budgetGb * 1024 * 1024 * 1024
    const availableGb = (budgetBytes - usedBytes) / (1024 * 1024 * 1024)

    const variants = this.config.getVariants(baseName)

    // Try quant levels in descending quality order
    for (const quant of QUANT_ORDER) {
      const variant = variants.find(v => v.quantLevel === quant)
      if (variant && variant.sizeGb <= availableGb) {
        return variant.id
      }
    }

    // Intentional overcommit: nothing fits, but returning a model ID lets Ollama
    // attempt to load at Q4_0. Better to try than to fail silently.
    const q4 = variants.find(v => v.quantLevel === 'Q4_0')
    return q4?.id ?? `${baseName}-Q4_0`
  }
}
