import { existsSync } from 'fs'
import type { RouteSignals } from './types.js'
import { ROUTE_SIGNALS_FALLBACK } from './types.js'

export class TinyRouterClient {
  private modelPath: string
  private session: unknown = null

  constructor(modelPath: string) {
    this.modelPath = modelPath
  }

  private async loadSession(): Promise<unknown> {
    if (this.session) return this.session
    if (!existsSync(this.modelPath)) return null
    try {
      const ort = await import('onnxruntime-node')
      this.session = await ort.InferenceSession.create(this.modelPath)
      return this.session
    } catch {
      return null
    }
  }

  async classify(message: string): Promise<RouteSignals> {
    const session = await this.loadSession()
    if (!session) return { ...ROUTE_SIGNALS_FALLBACK }
    // Full inference wired in Task 2b; for now session-present also returns fallback
    return { ...ROUTE_SIGNALS_FALLBACK }
  }
}
