import { existsSync } from 'fs'
import { join, dirname } from 'path'
import type { RouteSignals } from './types.js'
import { ROUTE_SIGNALS_FALLBACK } from './types.js'
import { loadVocab, tokenize } from './tiny-router-tokenizer.js'

const RELATION_LABELS = ['new', 'follow_up', 'correction', 'confirmation', 'cancellation', 'closure'] as const
const ACTIONABILITY_LABELS = ['none', 'review', 'act'] as const
const RETENTION_LABELS = ['ephemeral', 'useful', 'remember'] as const
const URGENCY_LABELS = ['low', 'medium', 'high'] as const

function argmax(arr: Float32Array): number {
  let best = 0
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i
  return best
}

function softmaxMax(arr: Float32Array): number {
  const maxIdx = argmax(arr)
  const max = Math.max(...Array.from(arr))
  const exps = Array.from(arr).map(v => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps[maxIdx] / sum
}

export class TinyRouterClient {
  private modelPath: string
  private session: unknown = null
  private vocab: Record<string, number> | null = null

  constructor(modelPath: string) {
    this.modelPath = modelPath
  }

  private async loadSession(): Promise<unknown> {
    if (this.session) return this.session
    if (!existsSync(this.modelPath)) return null
    try {
      const ort = await import('onnxruntime-node')
      this.session = await ort.InferenceSession.create(this.modelPath)
      const tokenizerPath = join(dirname(this.modelPath), 'tiny-router-tokenizer.json')
      if (existsSync(tokenizerPath)) {
        this.vocab = loadVocab(tokenizerPath)
      }
      return this.session
    } catch {
      return null
    }
  }

  async classify(message: string): Promise<RouteSignals> {
    const session = await this.loadSession() as import('onnxruntime-node').InferenceSession | null
    if (!session || !this.vocab) return { ...ROUTE_SIGNALS_FALLBACK }

    try {
      const { inputIds, attentionMask, tokenTypeIds } = tokenize(message, this.vocab)
      const ort = await import('onnxruntime-node')
      const feeds = {
        input_ids: new ort.Tensor('int64', inputIds, [1, 128]),
        attention_mask: new ort.Tensor('int64', attentionMask, [1, 128]),
        token_type_ids: new ort.Tensor('int64', tokenTypeIds, [1, 128]),
      }
      const results = await session.run(feeds)
      const rel   = results['relation_to_previous']?.data as Float32Array
      const act   = results['actionability']?.data as Float32Array
      const ret   = results['retention']?.data as Float32Array
      const urg   = results['urgency']?.data as Float32Array
      if (!rel || !act || !ret || !urg) return { ...ROUTE_SIGNALS_FALLBACK }

      const confidence = (softmaxMax(rel) + softmaxMax(urg)) / 2
      return {
        relation:      RELATION_LABELS[argmax(rel)] ?? 'new',
        actionability: ACTIONABILITY_LABELS[argmax(act)] ?? 'act',
        retention:     RETENTION_LABELS[argmax(ret)] ?? 'useful',
        urgency:       URGENCY_LABELS[argmax(urg)] ?? 'medium',
        confidence,
      }
    } catch {
      return { ...ROUTE_SIGNALS_FALLBACK }
    }
  }
}
