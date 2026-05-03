// packages/architect/src/model-router-adapter.ts
//
// Adapter that bridges the real ModelRouter to the ModelRouterLike interface.
// Maps the urgency signal from the cascade router (high/medium/low) to tier
// values (apex/standard/lite) that the architect subsystem understands.

import type { ModelRouterLike, ModelDescriptor, Tier } from './model-router-client.js'

interface RealModelRouter {
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string },
  ): Promise<{ reply: string; decision: any }>
  cascade: {
    route(message: string): Promise<{
      model: string | null
      domain: string
      urgency: string
      fallbackModels: string[]
    }>
  }
}

const URGENCY_TO_TIER: Record<string, Tier> = {
  high: 'apex',
  medium: 'standard',
  low: 'lite',
}

export function createModelRouterAdapter(router: RealModelRouter): ModelRouterLike {
  return {
    async getModelFor(
      _domain: string,
      priority: 'low' | 'medium' | 'high',
    ): Promise<ModelDescriptor | null> {
      const decision = await router.cascade.route(`[architect:${priority}] routing probe`)
      if (!decision.model) return null
      const tier = URGENCY_TO_TIER[decision.urgency] ?? 'lite'
      return { id: decision.model, tier }
    },

    async generate(modelId: string, prompt: string): Promise<string> {
      const { reply } = await router.chat(
        [{ role: 'user', content: prompt }],
        { model: modelId },
      )
      return reply
    },
  }
}
