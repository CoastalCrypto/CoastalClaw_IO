// packages/architect/src/model-router-client.ts
//
// Architect-side wrapper around the model layer with a minimum-capability gate.
//
// VERIFIED ROUTER API (Step 1 research, 2026-05-02):
//   The actual class is `packages/core/src/models/router.ts` `ModelRouter`.
//   Its public surface is:
//     - `chat(messages, options?) -> { reply, decision }`
//     - `chatWithTools(model, messages, tools)`
//     - `listModels()`
//   It internally delegates routing to `CascadeRouter.route(message)` which
//   resolves a `domain` ('coo' | 'cfo' | 'cto' | 'general') and an `urgency`
//   ('low' | 'medium' | 'high') against `data/model-registry.json` to produce
//   a bare model id string. There is NO `getModelFor`, NO `generate`, and
//   model descriptors do NOT carry a `tier` field — they are plain strings.
//
//   In short: the actual ModelRouter does not implement the shape this
//   wrapper consumes. That mismatch is intentional. This wrapper defines
//   `ModelRouterLike` as its *own* contract — a small adapter the architect
//   subsystem depends on. A future chunk will land an adapter that bridges
//   the real `ModelRouter` to this contract, mapping urgency to a tier
//   (high → apex, medium → standard, low → lite) inferred from the registry's
//   capability ordering. Until then, callers can mock or supply their own.
//
// TIER MAPPING:
//   Tier values: 'lite' | 'standard' | 'apex' (architect-internal vocabulary).
//   `CC_ARCHITECT_MIN_TIER` accepts: 'low' | 'medium' | 'high', mapped to
//   the tier rank scale (low=lite, medium=standard, high=apex). The gate
//   compares the assigned model's tier rank against the min rank.
//
// DOMAIN REGISTRATION (Step 6):
//   The real registry currently hard-codes domains as 'coo' | 'cfo' | 'cto' |
//   'general' both in `routing/types.ts` (RouteDecision['domain']) and in
//   `routing/domain-registry.ts` (DomainName). Adding 'architect' would
//   require coordinated changes across those files, the bootstrap in
//   `api/routes/admin.ts`, and cascade fallback logic. That work is out of
//   scope for Chunk 7 and is deferred to the chunk that lands the real
//   ModelRouter -> ModelRouterLike adapter. This wrapper is forward-compatible:
//   when a router that knows the 'architect' domain is plugged in, no change
//   here is required.

export type Tier = 'lite' | 'standard' | 'apex'

const TIER_RANK: Record<Tier, number> = { lite: 0, standard: 1, apex: 2 }

// CC_ARCHITECT_MIN_TIER values mapped onto the same rank scale.
const MIN_TIER_RANK: Record<MinTier, number> = { low: 0, medium: 1, high: 2 }

export type MinTier = 'low' | 'medium' | 'high'

export interface ModelDescriptor {
  id: string
  tier: Tier
}

export interface ModelRouterLike {
  /** Resolve the model assigned to a given domain at a given priority. */
  getModelFor(
    domain: string,
    priority: 'low' | 'medium' | 'high',
  ): Promise<ModelDescriptor | null>
  /** Run inference on the given model id with the given prompt. */
  generate(modelId: string, prompt: string): Promise<string>
}

export class MinCapabilityError extends Error {
  readonly modelId: string
  readonly tier: Tier
  readonly minTier: MinTier

  constructor(modelId: string, tier: Tier, minTier: MinTier) {
    super(`Model ${modelId} (tier=${tier}) is below required min tier ${minTier}`)
    this.name = 'MinCapabilityError'
    this.modelId = modelId
    this.tier = tier
    this.minTier = minTier
  }
}

export interface ArchitectModelClientOpts {
  minTier: MinTier
}

export type PreflightResult =
  | { ok: true; modelId: string }
  | { ok: false; message: string }

const REMEDIATION_MESSAGE =
  `Architect can't run on this hardware tier. The smallest model available for ` +
  `high-priority planning is too small to produce reliable diffs. ` +
  `Install a stronger model, or set CC_ARCHITECT_MIN_TIER=low to run anyway (not recommended).`

export class ArchitectModelRouterClient {
  private readonly router: ModelRouterLike
  private readonly opts: ArchitectModelClientOpts

  constructor(router: ModelRouterLike, opts: ArchitectModelClientOpts) {
    if (!(opts.minTier in MIN_TIER_RANK)) {
      throw new Error(
        `Invalid minTier '${opts.minTier}'. Expected one of: low, medium, high.`,
      )
    }
    this.router = router
    this.opts = opts
  }

  /** Route a planning prompt to the high-priority architect model. */
  async callPlan(prompt: string): Promise<{ text: string; modelId: string }> {
    const model = await this.assertModel('high')
    const text = await this.router.generate(model.id, prompt)
    return { text, modelId: model.id }
  }

  /** Route a summarization prompt to the low-priority architect model. */
  async callSummary(prompt: string): Promise<{ text: string; modelId: string }> {
    const model = await this.assertModel('low')
    const text = await this.router.generate(model.id, prompt)
    return { text, modelId: model.id }
  }

  /**
   * Probe the high-priority model and verify it meets the configured min tier.
   * Returns a structured result the daemon can surface to the operator on
   * startup. Never throws.
   */
  async preflightCapability(): Promise<PreflightResult> {
    try {
      const model = await this.assertModel('high')
      return { ok: true, modelId: model.id }
    } catch (err) {
      if (err instanceof MinCapabilityError) {
        return { ok: false, message: REMEDIATION_MESSAGE }
      }
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, message }
    }
  }

  private async assertModel(priority: 'low' | 'high'): Promise<ModelDescriptor> {
    const model = await this.router.getModelFor('architect', priority)
    if (!model) {
      throw new MinCapabilityError('<none>', 'lite', this.opts.minTier)
    }
    if (!(model.tier in TIER_RANK)) {
      throw new Error(
        `Router returned model ${model.id} with unknown tier '${model.tier}'.`,
      )
    }
    if (TIER_RANK[model.tier] < MIN_TIER_RANK[this.opts.minTier]) {
      throw new MinCapabilityError(model.id, model.tier, this.opts.minTier)
    }
    return model
  }
}
