# Intelligent Routing + Model Quantization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded ModelRouter → OllamaClient path with a cascade routing layer that classifies requests by intent and domain, selects specialist models, manages VRAM via quantization, and provides a point-and-click UI for model management.

**Architecture:** New `packages/core/src/routing/` module with TinyRouterClient (ONNX intent signals), DomainClassifier (rules + LLM cascade), DomainModelRegistry (hot-reload JSON config), VRAMManager (quant selection). ModelRegistry (separate SQLite table) tracks installed models. QuantizationPipeline converts HuggingFace models to GGUF. Admin API + React UI expose management to non-technical users.

**Tech Stack:** `onnxruntime-node`, `fs.watch`, `better-sqlite3` (existing), `child_process` (pipeline), Fastify (existing), React + Tailwind v4 (existing), TypeScript/Node 22 ESM throughout.

---

## Chunk 1: Core Routing Foundation

### Task 1: Routing types + config extensions

**Files:**
- Create: `packages/core/src/routing/types.ts`
- Modify: `packages/core/src/config.ts`

- [ ] **Step 1: Create `packages/core/src/routing/types.ts`**

```typescript
export interface RouteSignals {
  relation: 'new' | 'follow_up' | 'correction' | 'confirmation' | 'cancellation' | 'closure'
  actionability: 'none' | 'review' | 'act'
  retention: 'ephemeral' | 'useful' | 'remember'
  urgency: 'low' | 'medium' | 'high'
  confidence: number
}

export interface RouteDecision {
  model: string
  domain: 'coo' | 'cfo' | 'cto' | 'general'
  signals: RouteSignals
  domainConfidence: number
  classifiedBy: 'rules' | 'llm'
}

export const ROUTE_SIGNALS_FALLBACK: RouteSignals = {
  relation: 'new',
  urgency: 'medium',
  actionability: 'act',
  retention: 'useful',
  confidence: 0,
}
```

- [ ] **Step 2: Extend `packages/core/src/config.ts`**

Add new fields to `Config` interface and `loadConfig()`:

Append the five new fields to the `Config` interface, then add them to the `loadConfig()` return object. The full file after the edit should be:

```typescript
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
    ollamaUrl: process.env.CC_OLLAMA_URL ?? 'http://127.0.0.1:11434',
    mem0ApiKey: process.env.MEM0_API_KEY,
    vramBudgetGb: Number(process.env.CC_VRAM_BUDGET_GB ?? '24'),
    routerConfidence: Number(process.env.CC_ROUTER_CONFIDENCE ?? '0.7'),
    tinyRouterModel: process.env.CC_TINY_ROUTER_MODEL ?? './data/tiny-router.onnx',
    quantRouterModel: process.env.CC_QUANT_ROUTER_MODEL ?? 'qwen2.5:0.5b',
    llamaCppDir: process.env.CC_LLAMA_CPP_DIR ?? './data/llama-cpp/',
  }
}
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm test
```

Expected: all 19 tests still passing (config tests check existing fields only).

- [ ] **Step 4: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/types.ts packages/core/src/config.ts
git commit -m "feat(core/routing): add RouteSignals/RouteDecision types and routing config vars"
```

---

### Task 2: TinyRouterClient (ONNX wrapper)

**Files:**
- Create: `packages/core/src/routing/tiny-router.ts`
- Create: `packages/core/tests/routing/tiny-router.test.ts`

- [ ] **Step 1: Install onnxruntime-node**

```bash
cd C:/Users/John/Coastal.AI/packages/core
pnpm add onnxruntime-node
```

Expected: installs without compilation (prebuilt binaries for Windows x64).

- [ ] **Step 2: Write failing test**

`packages/core/tests/routing/tiny-router.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { TinyRouterClient } from '../../src/routing/tiny-router.js'

describe('TinyRouterClient', () => {
  it('returns fallback signals when ONNX file does not exist', async () => {
    const client = new TinyRouterClient('/nonexistent/path/model.onnx')
    const signals = await client.classify('what is our burn rate?')
    expect(signals.relation).toBe('new')
    expect(signals.urgency).toBe('medium')
    expect(signals.actionability).toBe('act')
    expect(signals.retention).toBe('useful')
    expect(signals.confidence).toBe(0)
  })

  it('returns a valid RouteSignals shape', async () => {
    const client = new TinyRouterClient('/nonexistent/path/model.onnx')
    const signals = await client.classify('hello')
    expect(['new','follow_up','correction','confirmation','cancellation','closure']).toContain(signals.relation)
    expect(['none','review','act']).toContain(signals.actionability)
    expect(['ephemeral','useful','remember']).toContain(signals.retention)
    expect(['low','medium','high']).toContain(signals.urgency)
    expect(typeof signals.confidence).toBe('number')
  })
})
```

- [ ] **Step 3: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "tiny-router"
```

Expected: `Cannot find module '../../src/routing/tiny-router.js'`

- [ ] **Step 4: Implement `packages/core/src/routing/tiny-router.ts`**

```typescript
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
    // Model present but tokenization not yet wired — returns fallback with confidence=0
    // so downstream CascadeRouter knows signals are unconfident.
    // Full inference is implemented in Task 2b below.
    return { ...ROUTE_SIGNALS_FALLBACK }
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: all tests pass (tiny-router: 2 tests).

- [ ] **Step 6: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/tiny-router.ts packages/core/tests/routing/tiny-router.test.ts packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core/routing): add TinyRouterClient with ONNX wrapper and graceful fallback"
```

---

### Task 2b: TinyRouterClient — ONNX tokenization + inference

**Context:** tiny-router is a DeBERTa-v3-small multitask encoder. Its ONNX export expects `input_ids`, `attention_mask`, and `token_type_ids` as int64 tensors. It produces 4 classification heads: `relation_to_previous`, `actionability`, `retention`, `urgency`. Each head outputs a 1D logits array; argmax maps to the label string. Tokenization uses a WordPiece vocabulary (typically 128001 tokens for DeBERTa-v3); the tokenizer JSON is downloaded alongside the ONNX file.

**Files:**
- Modify: `packages/core/src/routing/tiny-router.ts`
- Create: `packages/core/src/routing/tiny-router-tokenizer.ts`
- Modify: `packages/core/tests/routing/tiny-router.test.ts`

> **Note:** This task requires the ONNX model and `tokenizer.json` to be present at `CC_TINY_ROUTER_MODEL` path (default `./data/tiny-router.onnx`) and a companion `./data/tiny-router-tokenizer.json`. Steps below implement the real inference path and add a test that only runs when the model file is present (skipped in CI if absent).

- [ ] **Step 1: Add tokenizer helper**

`packages/core/src/routing/tiny-router-tokenizer.ts`:

```typescript
import { readFileSync } from 'fs'

interface TokenizerVocab { [token: string]: number }

export function loadVocab(tokenizerJsonPath: string): TokenizerVocab {
  const raw = JSON.parse(readFileSync(tokenizerJsonPath, 'utf8'))
  return raw.model?.vocab ?? raw.vocab ?? {}
}

export function tokenize(text: string, vocab: TokenizerVocab, maxLen = 128): {
  inputIds: BigInt64Array
  attentionMask: BigInt64Array
  tokenTypeIds: BigInt64Array
} {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const ids: number[] = [101] // [CLS]
  for (const word of words) {
    if (vocab[word] !== undefined) {
      ids.push(vocab[word])
    } else {
      // Subword fallback: split into individual chars
      for (const ch of word) {
        ids.push(vocab[ch] ?? vocab['[UNK]'] ?? 100)
      }
    }
  }
  ids.push(102) // [SEP]

  // Pad / truncate to maxLen
  const padded = ids.slice(0, maxLen)
  while (padded.length < maxLen) padded.push(0)

  return {
    inputIds: BigInt64Array.from(padded.map(BigInt)),
    attentionMask: BigInt64Array.from(padded.map((v, _) => (v !== 0 ? 1n : 0n))),
    tokenTypeIds: new BigInt64Array(maxLen),
  }
}
```

- [ ] **Step 2: Write failing model-present test**

Add to `packages/core/tests/routing/tiny-router.test.ts`:

```typescript
import { existsSync } from 'fs'

const MODEL_PATH = process.env.CC_TINY_ROUTER_MODEL ?? './data/tiny-router.onnx'
const modelAvailable = existsSync(MODEL_PATH)

describe.skipIf(!modelAvailable)('TinyRouterClient — live ONNX inference', () => {
  it('returns non-zero confidence when model is present', async () => {
    const client = new TinyRouterClient(MODEL_PATH)
    const signals = await client.classify('what is our burn rate?')
    expect(signals.confidence).toBeGreaterThan(0)
  })

  it('maps relation output to a valid relation label', async () => {
    const client = new TinyRouterClient(MODEL_PATH)
    const signals = await client.classify('follow up on the budget discussion')
    expect(['new','follow_up','correction','confirmation','cancellation','closure']).toContain(signals.relation)
  })
})
```

- [ ] **Step 3: Run to verify FAIL (or SKIP if model absent)**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "live ONNX"
```

Expected: tests skip if model not present (`skipped 2`), or fail with inference error if present.

- [ ] **Step 4: Wire real inference into `classify()`**

Update `packages/core/src/routing/tiny-router.ts`:

```typescript
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
  const max = Math.max(...Array.from(arr))
  const exps = Array.from(arr).map(v => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps[argmax(arr)] / sum
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
```

- [ ] **Step 5: Run tests — expect PASS (model-absent tests pass; live tests skip)**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: all prior tiny-router tests pass; live ONNX tests skipped.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/tiny-router.ts packages/core/src/routing/tiny-router-tokenizer.ts packages/core/tests/routing/tiny-router.test.ts
git commit -m "feat(core/routing): implement TinyRouterClient ONNX inference with WordPiece tokenizer"
```

---

### Task 3: DomainClassifier (rules + LLM cascade)

**Files:**
- Create: `packages/core/src/routing/domain-classifier.ts`
- Create: `packages/core/tests/routing/domain-classifier.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/routing/domain-classifier.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DomainClassifier } from '../../src/routing/domain-classifier.js'

// Mock OllamaClient so LLM fallback is controllable in tests
vi.mock('../../src/models/ollama.js', () => ({
  OllamaClient: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue('{"domain":"cfo","confidence":0.9}'),
  })),
}))

describe('DomainClassifier', () => {
  let classifier: DomainClassifier

  beforeEach(() => {
    classifier = new DomainClassifier({
      ollamaUrl: 'http://localhost:11434',
      routerModel: 'qwen2.5:0.5b',
      confidenceThreshold: 0.7,
    })
  })

  it('rules pass: identifies cfo domain from keywords', async () => {
    // 7 of 9 cfo keywords → confidence 0.78 → above threshold
    const msg = 'review burn rate runway arr mrr fundraising cap table revenue budget forecast'
    const result = await classifier.classify(msg)
    expect(result.domain).toBe('cfo')
    expect(result.classifiedBy).toBe('rules')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('rules pass: selects domain with most keyword matches', async () => {
    // 6 of 8 cto keywords → confidence 0.75 → above threshold → rules path fires
    const msg = 'review architecture tech stack deployment api database latency infrastructure'
    const result = await classifier.classify(msg)
    expect(result.domain).toBe('cto')
    expect(result.classifiedBy).toBe('rules')
    expect(result.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('llm fallback: fires when rules confidence is low', async () => {
    // Only 1 keyword match → low confidence → LLM fires
    const msg = 'what is our runway?'
    const result = await classifier.classify(msg)
    expect(result.classifiedBy).toBe('llm')
    expect(result.domain).toBe('cfo')
  })

  it('llm fallback: defaults to general on malformed response', async () => {
    const { OllamaClient } = await import('../../src/models/ollama.js')
    vi.mocked(OllamaClient).mockImplementation(() => ({
      chat: vi.fn().mockResolvedValue('not valid json at all'),
      listModels: vi.fn(),
    }))
    const badClassifier = new DomainClassifier({
      ollamaUrl: 'http://localhost:11434',
      routerModel: 'qwen2.5:0.5b',
      confidenceThreshold: 0.7,
    })
    const result = await badClassifier.classify('what is our runway?')
    expect(result.domain).toBe('general')
    expect(result.confidence).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "domain-classifier"
```

Expected: `Cannot find module '../../src/routing/domain-classifier.js'`

- [ ] **Step 3: Implement `packages/core/src/routing/domain-classifier.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 4 new domain-classifier tests pass, all 21+ tests pass total.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/domain-classifier.ts packages/core/tests/routing/domain-classifier.test.ts
git commit -m "feat(core/routing): add DomainClassifier with rules cascade and LLM fallback"
```

---

### Task 4: ModelRegistry (SQLite models table)

**Files:**
- Create: `packages/core/src/models/registry.ts`
- Create: `packages/core/tests/models/registry.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/models/registry.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ModelRegistry } from '../../src/models/registry.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('ModelRegistry', () => {
  let registry: ModelRegistry
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-registry-'))
    registry = new ModelRegistry(tmpDir)
  })

  afterEach(() => {
    registry.close()
    rmSync(tmpDir, { recursive: true })
  })

  it('registers a model variant', () => {
    registry.register({
      id: 'llama3.2:3b-q4_K_M',
      hfSource: 'meta-llama/Llama-3.2-3B',
      baseName: 'llama3.2:3b',
      quantLevel: 'Q4_K_M',
      sizeGb: 1.9,
    })
    const variants = registry.getVariants('llama3.2:3b')
    expect(variants).toHaveLength(1)
    expect(variants[0].id).toBe('llama3.2:3b-q4_K_M')
    expect(variants[0].sizeGb).toBe(1.9)
  })

  it('lists all active models grouped by base name', () => {
    registry.register({ id: 'codestral:22b-q4_K_M', hfSource: 'mistralai/Codestral-22B', baseName: 'codestral:22b', quantLevel: 'Q4_K_M', sizeGb: 12.5 })
    registry.register({ id: 'codestral:22b-q8_0', hfSource: 'mistralai/Codestral-22B', baseName: 'codestral:22b', quantLevel: 'Q8_0', sizeGb: 23.1 })
    const all = registry.listGrouped()
    expect(all).toHaveLength(1)
    expect(all[0].baseName).toBe('codestral:22b')
    expect(all[0].variants).toHaveLength(2)
  })

  it('deactivates a model variant', () => {
    registry.register({ id: 'llama3.2:3b-q4_K_M', hfSource: 'meta-llama/Llama-3.2-3B', baseName: 'llama3.2:3b', quantLevel: 'Q4_K_M', sizeGb: 1.9 })
    registry.deactivate('llama3.2:3b-q4_K_M')
    const variants = registry.getVariants('llama3.2:3b')
    expect(variants).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "registry"
```

Expected: `Cannot find module '../../src/models/registry.js'`

- [ ] **Step 3: Implement `packages/core/src/models/registry.ts`**

```typescript
import Database from 'better-sqlite3'
import { join } from 'path'

export interface ModelRecord {
  id: string
  hfSource: string
  baseName: string
  quantLevel: string
  sizeGb: number
}

export interface ModelGroup {
  baseName: string
  hfSource: string
  variants: Array<{ id: string; quantLevel: string; sizeGb: number; addedAt: number }>
}

export class ModelRegistry {
  private db: Database.Database

  constructor(dataDir: string) {
    this.db = new Database(join(dataDir, 'models.db'))
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id          TEXT PRIMARY KEY,
        hf_source   TEXT NOT NULL,
        base_name   TEXT NOT NULL,
        quant_level TEXT NOT NULL,
        added_at    INTEGER NOT NULL,
        size_gb     REAL NOT NULL,
        active      INTEGER NOT NULL DEFAULT 1
      )
    `)
  }

  register(record: ModelRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO models (id, hf_source, base_name, quant_level, added_at, size_gb, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(record.id, record.hfSource, record.baseName, record.quantLevel, Date.now(), record.sizeGb)
  }

  deactivate(id: string): void {
    this.db.prepare('UPDATE models SET active = 0 WHERE id = ?').run(id)
  }

  getVariants(baseName: string): Array<{ id: string; quantLevel: string; sizeGb: number }> {
    return this.db.prepare(
      'SELECT id, quant_level as quantLevel, size_gb as sizeGb FROM models WHERE base_name = ? AND active = 1'
    ).all(baseName) as Array<{ id: string; quantLevel: string; sizeGb: number }>
  }

  listGrouped(): ModelGroup[] {
    const rows = this.db.prepare(`
      SELECT id, hf_source as hfSource, base_name as baseName, quant_level as quantLevel,
             size_gb as sizeGb, added_at as addedAt
      FROM models WHERE active = 1 ORDER BY base_name, quant_level
    `).all() as Array<{ id: string; hfSource: string; baseName: string; quantLevel: string; sizeGb: number; addedAt: number }>

    const groups = new Map<string, ModelGroup>()
    for (const row of rows) {
      if (!groups.has(row.baseName)) {
        groups.set(row.baseName, { baseName: row.baseName, hfSource: row.hfSource, variants: [] })
      }
      groups.get(row.baseName)!.variants.push({ id: row.id, quantLevel: row.quantLevel, sizeGb: row.sizeGb, addedAt: row.addedAt })
    }
    return Array.from(groups.values())
  }

  isActive(id: string): boolean {
    const row = this.db.prepare('SELECT active FROM models WHERE id = ?').get(id) as { active: number } | undefined
    return row?.active === 1
  }

  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 3 new registry tests pass, all tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/models/registry.ts packages/core/tests/models/registry.test.ts
git commit -m "feat(core/models): add ModelRegistry with SQLite models table"
```

---

## Chunk 2: VRAM, Registry, Cascade

### Task 5: DomainModelRegistry (hot-reload JSON config)

**Files:**
- Create: `packages/core/src/routing/domain-registry.ts`
- Create: `packages/core/tests/routing/domain-registry.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/routing/domain-registry.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { DomainModelRegistry } from '../../src/routing/domain-registry.js'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('DomainModelRegistry', () => {
  const registries: DomainModelRegistry[] = []
  let tmpDir: string

  afterEach(() => {
    registries.forEach(r => r.close())
    registries.length = 0
    if (tmpDir) rmSync(tmpDir, { recursive: true })
  })

  it('resolves model for domain + urgency', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    const path = join(tmpDir, 'model-registry.json')
    writeFileSync(path, JSON.stringify({
      cfo: { high: 'finma:7b-q5', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto: { high: 'codestral:22b-q4', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('finma:7b-q5')
    expect(reg.resolve('cto', 'medium')).toBe('llama3.2:3b')
    expect(reg.resolve('general', 'low')).toBe('llama3.2:1b')
  })

  it('uses DEFAULT_REGISTRY when file is missing', () => {
    const reg = new DomainModelRegistry('/nonexistent/path/model-registry.json')
    registries.push(reg)
    // No file → DEFAULT_REGISTRY applies → cfo/high maps to llama3.1:8b-q4_K_M
    expect(reg.resolve('cfo', 'high')).toBe('llama3.1:8b-q4_K_M')
  })

  it('cascades through urgency tiers when a level is undefined in registry', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    const path = join(tmpDir, 'model-registry.json')
    // cfo has no 'high' key — resolve should cascade to medium
    writeFileSync(path, JSON.stringify({
      cfo:     { medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto:     { high: 'codestral:22b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo:     { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('llama3.2:3b')   // cascaded to medium
    expect(reg.resolve('cfo', 'low')).toBe('llama3.2:1b')    // found directly
  })

  it('falls back to FINAL_FALLBACK when all urgency tiers are missing', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    const path = join(tmpDir, 'model-registry.json')
    // cfo has no entries at all
    writeFileSync(path, JSON.stringify({
      cto:     { high: 'codestral:22b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo:     { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b',   medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('llama3.2:1b')   // FINAL_FALLBACK
  })

  it('hot-reloads when file changes', async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-reg-'))
    const path = join(tmpDir, 'model-registry.json')
    writeFileSync(path, JSON.stringify({
      cfo: { high: 'model-a', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))
    const reg = new DomainModelRegistry(path)
    registries.push(reg)
    expect(reg.resolve('cfo', 'high')).toBe('model-a')

    writeFileSync(path, JSON.stringify({
      cfo: { high: 'model-b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      cto: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      coo: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
      general: { high: 'llama3.1:8b', medium: 'llama3.2:3b', low: 'llama3.2:1b' },
    }))

    await new Promise(resolve => setTimeout(resolve, 200))
    expect(reg.resolve('cfo', 'high')).toBe('model-b')
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "domain-registry"
```

Expected: `Cannot find module '../../src/routing/domain-registry.js'`

- [ ] **Step 3: Implement `packages/core/src/routing/domain-registry.ts`**

```typescript
import { existsSync, readFileSync, watch, type FSWatcher } from 'fs'

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
      this.watcher = watch(filePath, () => this.load())
    }
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      this.registry = JSON.parse(raw) as ModelRegistry
    } catch {
      // keep existing registry on parse error
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 5 new domain-registry tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/domain-registry.ts packages/core/tests/routing/domain-registry.test.ts
git commit -m "feat(core/routing): add DomainModelRegistry with hot-reload"
```

---

### Task 6: VRAMManager

**Files:**
- Create: `packages/core/src/routing/vram-manager.ts`
- Create: `packages/core/tests/routing/vram-manager.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/routing/vram-manager.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { VRAMManager } from '../../src/routing/vram-manager.js'

// Mock fetch for Ollama /api/ps responses
globalThis.fetch = vi.fn()

function mockPs(models: Array<{ name: string; size_vram: number }>) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ models }),
  } as Response)
}

describe('VRAMManager', () => {
  const variants = [
    { id: 'codestral:22b-Q8_0',   quantLevel: 'Q8_0',   sizeGb: 23.0 },
    { id: 'codestral:22b-Q6_K',   quantLevel: 'Q6_K',   sizeGb: 17.2 },
    { id: 'codestral:22b-Q5_K_M', quantLevel: 'Q5_K_M', sizeGb: 14.8 },
    { id: 'codestral:22b-Q4_K_M', quantLevel: 'Q4_K_M', sizeGb: 12.5 },
    { id: 'codestral:22b-Q4_0',   quantLevel: 'Q4_0',   sizeGb: 11.8 },
  ]
  const getVariants = vi.fn().mockReturnValue(variants)

  it('selects Q8_0 when VRAM budget is large enough', async () => {
    mockPs([])  // nothing loaded → 48GB available
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q8_0')
  })

  it('degrades to Q5_K_M when Q8 and Q6 do not fit', async () => {
    // 15GB loaded → only 15GB free (48-33=15) → Q8(23) no, Q6(17.2) no, Q5(14.8) yes
    mockPs([{ name: 'some-model', size_vram: 33 * 1024 * 1024 * 1024 }])
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q5_K_M')
  })

  it('returns already-loaded model without quant selection', async () => {
    mockPs([{ name: 'codestral:22b-Q4_K_M', size_vram: 12.5 * 1024 * 1024 * 1024 }])
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q4_K_M')
  })

  it('falls back to Q4_0 when nothing else fits', async () => {
    // 47GB loaded → only 1GB free → nothing fits → force Q4_0
    mockPs([{ name: 'huge-model', size_vram: 47 * 1024 * 1024 * 1024 }])
    const mgr = new VRAMManager({ ollamaUrl: 'http://localhost:11434', budgetGb: 48, getVariants })
    const result = await mgr.selectQuant('codestral:22b')
    expect(result).toBe('codestral:22b-Q4_0')
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "vram-manager"
```

Expected: `Cannot find module '../../src/routing/vram-manager.js'`

- [ ] **Step 3: Implement `packages/core/src/routing/vram-manager.ts`**

```typescript
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
    const alreadyLoaded = loaded.find(m => m.name.startsWith(baseName))
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

    // Final fallback: return Q4_0 variant if it exists, otherwise base name
    const q4 = variants.find(v => v.quantLevel === 'Q4_0')
    return q4?.id ?? `${baseName}-Q4_0`
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 4 new vram-manager tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/vram-manager.ts packages/core/tests/routing/vram-manager.test.ts
git commit -m "feat(core/routing): add VRAMManager with quant degradation"
```

---

### Task 7: CascadeRouter

> **Dependency note:** `ModelRegistry` (imported as `../models/registry.js`) is created in Task 4 of Chunk 1. Implement Chunk 1 Tasks 1–4 before this task.

**Files:**
- Create: `packages/core/src/routing/cascade.ts`
- Create: `packages/core/tests/routing/cascade.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/routing/cascade.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { CascadeRouter } from '../../src/routing/cascade.js'

// Mock all sub-components
vi.mock('../../src/routing/tiny-router.js', () => ({
  TinyRouterClient: vi.fn().mockImplementation(() => ({
    classify: vi.fn().mockResolvedValue({
      relation: 'new', urgency: 'high', actionability: 'act',
      retention: 'remember', confidence: 0.85,
    }),
  })),
}))

vi.mock('../../src/routing/domain-classifier.js', () => ({
  DomainClassifier: vi.fn().mockImplementation(() => ({
    classify: vi.fn().mockResolvedValue({ domain: 'cfo', confidence: 0.9, classifiedBy: 'rules' }),
  })),
}))

vi.mock('../../src/routing/domain-registry.js', () => ({
  DomainModelRegistry: vi.fn().mockImplementation(() => ({
    resolve: vi.fn().mockReturnValue('finma:7b-q5_K_M'),
    close: vi.fn(),
  })),
}))

vi.mock('../../src/routing/vram-manager.js', () => ({
  VRAMManager: vi.fn().mockImplementation(() => ({
    selectQuant: vi.fn().mockResolvedValue('finma:7b-Q5_K_M'),
  })),
}))

describe('CascadeRouter', () => {
  const makeRouter = () => new CascadeRouter({
    ollamaUrl: 'http://localhost:11434',
    dataDir: '/tmp/test',
    routerConfidence: 0.7,
    tinyRouterModel: '/nonexistent.onnx',
    quantRouterModel: 'qwen2.5:0.5b',
    vramBudgetGb: 24,
  })

  it('returns a complete RouteDecision', async () => {
    const router = makeRouter()
    const decision = await router.route('what is our burn rate and runway?')
    expect(decision.domain).toBe('cfo')
    expect(decision.model).toBe('finma:7b-Q5_K_M')
    expect(decision.signals.urgency).toBe('high')
    expect(decision.signals.retention).toBe('remember')
    expect(decision.classifiedBy).toBe('rules')
    expect(decision.domainConfidence).toBe(0.9)
    router.close()
  })

  it('exposes signals from TinyRouter in the decision', async () => {
    const router = makeRouter()
    const decision = await router.route('test message')
    expect(decision.signals.actionability).toBe('act')
    expect(decision.signals.relation).toBe('new')
    router.close()
  })

  it('uses fallback defaults when Ollama/VRAMManager is unavailable', async () => {
    // Override VRAMManager mock to simulate Ollama being unreachable
    const { VRAMManager } = await import('../../src/routing/vram-manager.js')
    vi.mocked(VRAMManager).mockImplementationOnce(() => ({
      selectQuant: vi.fn().mockRejectedValue(new Error('connection refused')),
    }))
    const router = makeRouter()
    // Should not throw — falls back to the domain-registry resolved model directly
    const decision = await router.route('what is our burn rate?')
    expect(decision).toHaveProperty('model')
    expect(typeof decision.model).toBe('string')
    expect(decision.model.length).toBeGreaterThan(0)
    router.close()
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "cascade"
```

Expected: `Cannot find module '../../src/routing/cascade.js'`

- [ ] **Step 3: Implement `packages/core/src/routing/cascade.ts`**

```typescript
import { TinyRouterClient } from './tiny-router.js'
import { DomainClassifier } from './domain-classifier.js'
import { DomainModelRegistry } from './domain-registry.js'
import { VRAMManager } from './vram-manager.js'
import { ModelRegistry } from '../models/registry.js'
import type { RouteDecision } from './types.js'
import { join } from 'path'

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
    this.tiny = new TinyRouterClient(config.tinyRouterModel)
    this.domain = new DomainClassifier({
      ollamaUrl: config.ollamaUrl,
      routerModel: config.quantRouterModel,
      confidenceThreshold: config.routerConfidence,
    })
    this.registry = new DomainModelRegistry(join(config.dataDir, 'model-registry.json'))
    this.models = new ModelRegistry(config.dataDir)
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 3 new cascade tests pass, all tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/routing/cascade.ts packages/core/tests/routing/cascade.test.ts
git commit -m "feat(core/routing): add CascadeRouter orchestrating full routing pipeline"
```

---

## Chunk 3: Wire Retention End-to-End

### Task 8: Update UnifiedMemory, ModelRouter, chatRoutes

**Files:**
- Modify: `packages/core/src/memory/index.ts`
- Modify: `packages/core/src/models/router.ts`
- Modify: `packages/core/src/api/routes/chat.ts`
- Modify: `packages/core/tests/memory/unified.test.ts`
- Modify: `packages/core/tests/models/router.test.ts`
- Modify: `packages/core/tests/api/chat.test.ts`

- [ ] **Step 1: Write failing tests for updated UnifiedMemory**

Add to `packages/core/tests/memory/unified.test.ts` (append after existing test):

```typescript
  it('ephemeral retention skips all writes', async () => {
    await memory.write({
      id: 'msg-ephemeral',
      sessionId: 'sess-1',
      role: 'user',
      content: 'what time is it?',
      timestamp: Date.now(),
    }, 'ephemeral')
    const results = await memory.queryHistory({ sessionId: 'sess-1' })
    expect(results).toHaveLength(0)
  })

  it('useful retention writes lossless only', async () => {
    await memory.write({
      id: 'msg-useful',
      sessionId: 'sess-2',
      role: 'user',
      content: 'useful info',
      timestamp: Date.now(),
    }, 'useful')
    const results = await memory.queryHistory({ sessionId: 'sess-2' })
    expect(results).toHaveLength(1)
  })

  it('default retention (no arg) behaves like useful', async () => {
    await memory.write({
      id: 'msg-default',
      sessionId: 'sess-3',
      role: 'user',
      content: 'default behavior',
      timestamp: Date.now(),
    })
    const results = await memory.queryHistory({ sessionId: 'sess-3' })
    expect(results).toHaveLength(1)
  })
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "unified"
```

Expected: tests fail because `write()` doesn't accept a second argument yet.

- [ ] **Step 3: Update `packages/core/src/memory/index.ts`**

Replace the `write()` method:

```typescript
async write(
  entry: MemoryEntry,
  retention: 'ephemeral' | 'useful' | 'remember' = 'useful'
): Promise<void> {
  if (retention === 'ephemeral') return

  await this.lossless.write(entry)

  if (retention === 'remember' && this.mem0) {
    this.mem0
      .remember(entry.sessionId, entry.content)
      .catch((err) => console.warn('[memory] mem0 write failed:', err))
  }
}
```

- [ ] **Step 4: Run unified tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- tests/memory/unified.test.ts
```

Expected: 4 unified tests pass.

- [ ] **Step 5: Write failing test for updated ModelRouter**

Add to `packages/core/tests/models/router.test.ts`:

```typescript
  it('returns { reply, decision } with RouteDecision', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const result = await router.chat([{ role: 'user', content: 'hi' }])
    expect(result).toHaveProperty('reply')
    expect(result).toHaveProperty('decision')
    expect(result.reply).toBe('mocked response')
    expect(result.decision).toHaveProperty('model')
    expect(result.decision).toHaveProperty('signals')
  })
```

Update the existing tests to destructure `.reply`:
```typescript
  it('routes to default model when none specified', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const { reply } = await router.chat([{ role: 'user', content: 'hi' }])
    expect(reply).toBe('mocked response')
  })

  it('routes to specified model', async () => {
    const router = new ModelRouter({ ollamaUrl: 'http://localhost:11434', defaultModel: 'llama3.2' })
    const { reply } = await router.chat([{ role: 'user', content: 'hi' }], { model: 'mistral' })
    expect(reply).toBe('mocked response')
  })
```

- [ ] **Step 6: Update `packages/core/src/models/router.ts`**

```typescript
import { OllamaClient, type ChatMessage } from './ollama.js'
import { CascadeRouter } from '../routing/cascade.js'
import type { RouteDecision } from '../routing/types.js'
import { loadConfig } from '../config.js'

export interface RouterConfig {
  ollamaUrl: string
  defaultModel: string
}

export interface ChatOptions {
  model?: string
}

export class ModelRouter {
  private ollama: OllamaClient
  private cascade: CascadeRouter

  constructor(private config: RouterConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
    const appConfig = loadConfig()
    this.cascade = new CascadeRouter({
      ollamaUrl: config.ollamaUrl,
      dataDir: appConfig.dataDir,
      routerConfidence: appConfig.routerConfidence,
      tinyRouterModel: appConfig.tinyRouterModel,
      quantRouterModel: appConfig.quantRouterModel,
      vramBudgetGb: appConfig.vramBudgetGb,
    })
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<{ reply: string; decision: RouteDecision }> {
    const lastMessage = messages[messages.length - 1].content
    const decision = await this.cascade.route(lastMessage)
    const model = options?.model ?? decision.model
    const reply = await this.ollama.chat(model, messages)
    return { reply, decision }
  }

  async listModels(): Promise<string[]> {
    return this.ollama.listModels()
  }

  close(): void {
    this.cascade.close()
  }
}
```

- [ ] **Step 7: Run router tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- tests/models/router.test.ts
```

Expected: all 4 router tests pass.

- [ ] **Step 8: Update `packages/core/src/api/routes/chat.ts`**

```typescript
import type { FastifyInstance } from 'fastify'
import { ModelRouter } from '../../models/router.js'
import { UnifiedMemory } from '../../memory/index.js'
import { loadConfig } from '../../config.js'
import { randomUUID } from 'crypto'

export async function chatRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const router = new ModelRouter({
    ollamaUrl: config.ollamaUrl,
    defaultModel: process.env.CC_DEFAULT_MODEL ?? 'llama3.2',
  })
  const memory = new UnifiedMemory({
    dataDir: config.dataDir,
    mem0ApiKey: config.mem0ApiKey,
  })

  fastify.addHook('onClose', async () => {
    await memory.close()
    router.close()
  })

  fastify.post<{
    Body: { sessionId?: string; message: string; model?: string }
  }>('/api/chat', {
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          sessionId: { type: 'string' },
          message: { type: 'string', minLength: 1 },
          model: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { message, model } = req.body
    const sessionId = req.body.sessionId ?? randomUUID()

    // Get history first (before persisting user message, to avoid including it)
    const history = await memory.queryHistory({ sessionId, limit: 20 })
    const messages = history
      .slice()
      .reverse()
      .map((e) => ({ role: e.role, content: e.content }))
    messages.push({ role: 'user', content: message })

    // Route to model — cascade router classifies the message
    const { reply: replyText, decision } = await router.chat(messages, { model })
    const retention = decision.signals.retention

    // Persist user message with retention signal from tiny-router
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }, retention)

    // Assistant replies always persisted
    await memory.write({
      id: randomUUID(),
      sessionId,
      role: 'assistant',
      content: replyText,
      timestamp: Date.now(),
    }, 'useful')

    return reply.send({ sessionId, reply: replyText })
  })
}
```

- [ ] **Step 9: Run all tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: all tests pass.

> **chat.test.ts mock check:** The existing `chat.test.ts` mocks `ModelRouter.chat()` to return a string. Now that `chat()` returns `{ reply, decision }`, update the mock in `chat.test.ts` before running:
>
> ```typescript
> vi.mock('../../src/models/router.js', () => ({
>   ModelRouter: vi.fn().mockImplementation(() => ({
>     chat: vi.fn().mockResolvedValue({
>       reply: 'mocked response',
>       decision: {
>         model: 'llama3.2', domain: 'general',
>         signals: { relation: 'new', urgency: 'medium', actionability: 'act', retention: 'useful', confidence: 0 },
>         domainConfidence: 0.5, classifiedBy: 'llm',
>       },
>     }),
>   })),
> }))
> ```

- [ ] **Step 10: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/memory/index.ts packages/core/src/models/router.ts packages/core/src/api/routes/chat.ts packages/core/tests/memory/unified.test.ts packages/core/tests/models/router.test.ts packages/core/tests/api/chat.test.ts
git commit -m "feat(core): wire retention signal end-to-end through ModelRouter and chatRoutes"
```

---

## Chunk 4: Quantization Pipeline

### Task 9: QuantizationPipeline

**Files:**
- Create: `packages/core/src/models/quantizer.ts`
- Create: `packages/core/tests/models/quantizer.test.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/models/quantizer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QuantizationPipeline } from '../../src/models/quantizer.js'

// Mock child_process.spawn and execSync to avoid actually running Python/llama.cpp
vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn().mockImplementation((event, cb) => {
      if (event === 'close') cb(0)  // exit code 0 = success
    }),
  })),
  execSync: vi.fn(),  // Python check passes silently
}))

// Mock fs.existsSync so llama.cpp binaries are "found" (no download needed)
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
  }
})

// Mock ModelRegistry so we can assert SQLite inserts without real DB
vi.mock('../../src/models/registry.js', () => ({
  ModelRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    close: vi.fn(),
  })),
}))

describe('QuantizationPipeline', () => {
  it('validates hfModelId format (must be owner/repo)', async () => {
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress: vi.fn(),
    })
    await expect(pipeline.run('not-valid-format', ['Q4_K_M'])).rejects.toThrow('owner/repo')
  })

  it('rejects empty quants array', async () => {
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress: vi.fn(),
    })
    await expect(pipeline.run('owner/repo', [])).rejects.toThrow('at least one')
  })

  it('calls onProgress with step updates', async () => {
    const onProgress = vi.fn()
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp/test-data',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress,
    })
    await pipeline.run('owner/mymodel', ['Q4_K_M'])
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ type: 'quant_progress' }))
  })

  it('registers each quant variant in ModelRegistry after ollama create', async () => {
    const onProgress = vi.fn()
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp/test-data',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress,
    })
    await pipeline.run('owner/mymodel', ['Q4_K_M', 'Q8_0'])
    const { ModelRegistry } = await import('../../src/models/registry.js')
    const registryInstance = vi.mocked(ModelRegistry).mock.results[0].value
    expect(registryInstance.register).toHaveBeenCalledTimes(2)
    expect(registryInstance.register).toHaveBeenCalledWith(expect.objectContaining({
      baseName: 'mymodel',
      quantLevel: 'Q4_K_M',
      hfSource: 'owner/mymodel',
    }))
    expect(registryInstance.register).toHaveBeenCalledWith(expect.objectContaining({
      quantLevel: 'Q8_0',
    }))
  })

  it('throws a clear error when Python is not found', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('not found') })
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress: vi.fn(),
    })
    await expect(pipeline.run('owner/repo', ['Q4_K_M'])).rejects.toThrow('Python is required')
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- --reporter=verbose 2>&1 | grep -A3 "quantizer"
```

Expected: `Cannot find module '../../src/models/quantizer.js'`

- [ ] **Step 3: Implement `packages/core/src/models/quantizer.ts`**

```typescript
import { spawn, execSync } from 'child_process'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ModelRegistry } from './registry.js'

export interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}

export interface QuantizationPipelineConfig {
  dataDir: string
  llamaCppDir: string
  ollamaUrl: string
  onProgress: (event: QuantProgress) => void
}

type QuantLevel = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'

// GitHub release tag pinned for reproducibility — update when upgrading llama.cpp
const LLAMA_CPP_RELEASE = 'b3178'
const LLAMA_CPP_ARCHIVE_WIN = `llama-${LLAMA_CPP_RELEASE}-bin-win-cuda-cu12.2.0-x64.zip`
const LLAMA_CPP_ARCHIVE_LINUX = `llama-${LLAMA_CPP_RELEASE}-bin-ubuntu-x64.zip`

function runCommand(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true })
    proc.stderr.on('data', (d: Buffer) => process.stderr.write(d))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with exit code ${code}: ${cmd} ${args.join(' ')}`))
    })
  })
}

function checkPython(): void {
  try {
    execSync('python --version', { stdio: 'pipe' })
  } catch {
    throw new Error(
      'Python is required for quantization but was not found on your PATH. ' +
      'Install Python 3.10+ from https://python.org and re-run.'
    )
  }
}

async function ensureLlamaCppBinaries(llamaCppDir: string): Promise<void> {
  const binExt = process.platform === 'win32' ? '.exe' : ''
  const quantizeBin = join(llamaCppDir, `llama-quantize${binExt}`)
  if (existsSync(quantizeBin)) return

  mkdirSync(llamaCppDir, { recursive: true })
  const archive = process.platform === 'win32' ? LLAMA_CPP_ARCHIVE_WIN : LLAMA_CPP_ARCHIVE_LINUX
  const zipPath = join(llamaCppDir, 'llama.zip')
  const releaseUrl = `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_CPP_RELEASE}/${archive}`

  await runCommand('curl', ['-L', '-o', zipPath, releaseUrl])

  if (process.platform === 'win32') {
    await runCommand('powershell', [
      '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${llamaCppDir}'`,
    ])
  } else {
    await runCommand('unzip', ['-o', zipPath, '-d', llamaCppDir])
  }
}

export class QuantizationPipeline {
  constructor(private config: QuantizationPipelineConfig) {}

  async run(hfModelId: string, quants: QuantLevel[]): Promise<void> {
    if (!hfModelId.includes('/')) {
      throw new Error('hfModelId must be in owner/repo format')
    }
    if (quants.length === 0) {
      throw new Error('Must request at least one quant level')
    }

    // Pre-flight checks (not counted as progress steps)
    checkPython()
    await ensureLlamaCppBinaries(this.config.llamaCppDir)

    const modelName = hfModelId.split('/')[1].toLowerCase()
    const downloadsDir = join(this.config.dataDir, 'downloads', modelName)
    // Steps: download + convert + (quantize + ollama create + SQLite register) × quants
    const totalSteps = 2 + quants.length * 3
    mkdirSync(downloadsDir, { recursive: true })

    const progress = (step: number, message: string) =>
      this.config.onProgress({ type: 'quant_progress', step, total: totalSteps, message })

    // Step 1: Download from HuggingFace
    progress(1, `Downloading ${hfModelId} from HuggingFace...`)
    await runCommand('huggingface-cli', ['download', hfModelId, '--local-dir', downloadsDir])

    // Step 2: Convert to GGUF
    progress(2, 'Converting to GGUF format...')
    const ggufPath = join(downloadsDir, `${modelName}.gguf`)
    const convertScript = join(this.config.llamaCppDir, 'convert_hf_to_gguf.py')
    await runCommand('python', [convertScript, downloadsDir, '--outfile', ggufPath])

    const registry = new ModelRegistry(this.config.dataDir)
    let step = 3
    try {
      for (const quant of quants) {
        // Step A: Quantize
        progress(step++, `Quantizing to ${quant}...`)
        const quantPath = join(downloadsDir, `${modelName}-${quant}.gguf`)
        const binExt = process.platform === 'win32' ? '.exe' : ''
        await runCommand(
          join(this.config.llamaCppDir, `llama-quantize${binExt}`),
          [ggufPath, quantPath, quant]
        )

        // Step B: Register with Ollama (Modelfile is intentionally bare — parameters via registry/UI)
        progress(step++, `Creating Ollama model for ${quant}...`)
        const modelfileDir = join(downloadsDir, `modelfile-${quant}`)
        mkdirSync(modelfileDir, { recursive: true })
        writeFileSync(join(modelfileDir, 'Modelfile'), `FROM ${quantPath}`)
        const ollamaName = `${modelName}:${quant.toLowerCase()}`
        await runCommand('ollama', ['create', ollamaName, '-f', join(modelfileDir, 'Modelfile')])

        // Step C: Register in SQLite models table
        progress(step++, `Saving ${quant} to model registry...`)
        const { statSync } = await import('fs')
        const sizeGb = statSync(quantPath).size / (1024 ** 3)
        registry.register({
          id: ollamaName,
          hfSource: hfModelId,
          baseName: modelName,
          quantLevel: quant,
          sizeGb: Math.round(sizeGb * 10) / 10,
        })
      }
    } finally {
      registry.close()
    }
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 5 new quantizer tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/models/quantizer.ts packages/core/tests/models/quantizer.test.ts
git commit -m "feat(core/models): add QuantizationPipeline for HuggingFace → GGUF → Ollama"
```

---

## Chunk 5: Admin API

### Task 10: Admin token + admin routes

**Files:**
- Create: `packages/core/src/api/routes/admin.ts`
- Create: `packages/core/tests/api/admin.test.ts`
- Modify: `packages/core/src/server.ts`

- [ ] **Step 1: Write failing tests**

`packages/core/tests/api/admin.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { buildServer } from '../../src/server.js'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { FastifyInstance } from 'fastify'

describe('Admin API', () => {
  let server: FastifyInstance
  let tmpDir: string
  const token = 'test-admin-token'

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'cc-admin-'))
    process.env.CC_DATA_DIR = tmpDir
    process.env.CC_ADMIN_TOKEN = token
    server = await buildServer()
    await server.listen({ port: 0 })
  })

  afterEach(async () => {
    await server.close()
    delete process.env.CC_DATA_DIR
    delete process.env.CC_ADMIN_TOKEN
    rmSync(tmpDir, { recursive: true })
  })

  it('GET /api/admin/models returns 401 without token', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/admin/models' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/admin/models returns 200 with valid token', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/models',
      headers: { 'x-admin-token': token },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual([])
  })

  it('PATCH /api/admin/registry returns 422 for unknown model', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: '/api/admin/registry',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ cfo: { high: 'nonexistent-model', medium: 'llama3.2:3b', low: 'llama3.2:1b' } }),
    })
    expect(res.statusCode).toBe(422)
  })

  it('POST /api/admin/models/add returns 401 without token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/models/add',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hfModelId: 'owner/repo', quants: ['Q4_K_M'], sessionId: 'sess-1' }),
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /api/admin/models/add returns 202 and starts pipeline', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/models/add',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ hfModelId: 'owner/mymodel', quants: ['Q4_K_M'], sessionId: 'sess-1' }),
    })
    expect(res.statusCode).toBe(202)
    expect(JSON.parse(res.body)).toMatchObject({ hfModelId: 'owner/mymodel' })
  })

  it('DELETE /api/admin/models/:quantId returns 401 without token', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/models/mymodel:q4_k_m',
    })
    expect(res.statusCode).toBe(401)
  })

  it('DELETE /api/admin/models/:quantId returns 204', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: '/api/admin/models/mymodel:q4_k_m',
      headers: { 'x-admin-token': token },
    })
    expect(res.statusCode).toBe(204)
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test -- tests/api/admin.test.ts
```

Expected: fails — admin routes not registered.

- [ ] **Step 3: Implement `packages/core/src/api/routes/admin.ts`**

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { loadConfig } from '../../config.js'
import { ModelRegistry } from '../../models/registry.js'
import { QuantizationPipeline } from '../../models/quantizer.js'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

function getOrCreateAdminToken(dataDir: string): string {
  const envToken = process.env.CC_ADMIN_TOKEN
  if (envToken) return envToken

  const tokenFile = join(dataDir, '.admin-token')
  if (existsSync(tokenFile)) return readFileSync(tokenFile, 'utf8').trim()

  const token = randomBytes(32).toString('hex')
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(tokenFile, token)
  console.log(`[coastal-claw] Admin token generated: ${token}`)
  return token
}

export async function adminRoutes(fastify: FastifyInstance) {
  const config = loadConfig()
  const adminToken = getOrCreateAdminToken(config.dataDir)
  const modelRegistry = new ModelRegistry(config.dataDir)
  const registryPath = join(config.dataDir, 'model-registry.json')

  // Auth hook for all admin routes
  fastify.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/api/admin')) return
    if (req.headers['x-admin-token'] !== adminToken) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })

  // GET /api/admin/models
  fastify.get('/api/admin/models', async () => {
    return modelRegistry.listGrouped()
  })

  // DELETE /api/admin/models/:quantId
  fastify.delete<{ Params: { quantId: string } }>('/api/admin/models/:quantId', async (req, reply) => {
    const { quantId } = req.params
    // Remove from Ollama (best-effort)
    try {
      await fetch(`${config.ollamaUrl}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quantId }),
      })
    } catch { /* Ollama may not be running */ }
    modelRegistry.deactivate(quantId)
    return reply.status(204).send()
  })

  // POST /api/admin/models/add
  fastify.post<{
    Body: { hfModelId: string; quants: ('Q4_K_M' | 'Q5_K_M' | 'Q8_0')[]; sessionId: string }
  }>('/api/admin/models/add', {
    schema: {
      body: {
        type: 'object',
        required: ['hfModelId', 'quants', 'sessionId'],
        properties: {
          hfModelId: { type: 'string' },
          quants: { type: 'array', items: { type: 'string' } },
          sessionId: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { hfModelId, quants, sessionId } = req.body

    if (!hfModelId.includes('/')) {
      return reply.status(400).send({ error: 'hfModelId must be in owner/repo format' })
    }

    // Start pipeline in background
    const pipeline = new QuantizationPipeline({
      dataDir: config.dataDir,
      llamaCppDir: config.llamaCppDir,
      ollamaUrl: config.ollamaUrl,
      onProgress: (event) => {
        // Broadcast to the requesting WebSocket session
        fastify.websocketServer?.clients.forEach((client) => {
          if ((client as any)._sessionId === sessionId) {
            client.send(JSON.stringify(event))
          }
        })
      },
    })

    pipeline.run(hfModelId, quants).catch((err) => {
      console.error('[admin] quantization failed:', err.message)
    })

    return reply.status(202).send({ message: 'Pipeline started', hfModelId, quants })
  })

  // GET /api/admin/registry — returns current registry file contents
  fastify.get('/api/admin/registry', async () => {
    if (!existsSync(registryPath)) return {}
    try { return JSON.parse(readFileSync(registryPath, 'utf8')) } catch { return {} }
  })

  // PATCH /api/admin/registry
  fastify.patch<{
    Body: Partial<Record<'cfo' | 'cto' | 'coo' | 'general', Record<string, string>>>
  }>('/api/admin/registry', async (req, reply) => {
    const updates = req.body

    // Validate all model names exist in registry
    for (const [, urgencyMap] of Object.entries(updates)) {
      for (const [, modelId] of Object.entries(urgencyMap ?? {})) {
        if (!modelRegistry.isActive(modelId)) {
          return reply.status(422).send({ error: `Model not found in registry: ${modelId}` })
        }
      }
    }

    // Load existing registry
    let existing: Record<string, unknown> = {}
    if (existsSync(registryPath)) {
      try { existing = JSON.parse(readFileSync(registryPath, 'utf8')) } catch {}
    }

    // Merge and write
    const merged = { ...existing, ...updates }
    mkdirSync(config.dataDir, { recursive: true })
    writeFileSync(registryPath, JSON.stringify(merged, null, 2))

    return reply.send({ ok: true })
  })

  fastify.addHook('onClose', () => {
    modelRegistry.close()
  })
}
```

- [ ] **Step 4: Register admin routes in `packages/core/src/server.ts`**

Add the import and registration:

```typescript
import { adminRoutes } from './api/routes/admin.js'
// ...inside buildServer():
await fastify.register(adminRoutes)
```

> **WebSocket `_sessionId` note:** The `POST /api/admin/models/add` handler broadcasts progress events to WebSocket clients matching `_sessionId`. This property is set in `api/routes/websocket.ts` (Phase 1, Task 4) when a client connects: `ws._sessionId = sessionId`. No change needed here — the property is already present on any connected client.

- [ ] **Step 5: Run all tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/core && pnpm test
```

Expected: 7 new admin tests pass, all pass.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/core/src/api/routes/admin.ts packages/core/tests/api/admin.test.ts packages/core/src/server.ts
git commit -m "feat(core/api): add admin routes for model management with token auth"
```

---

## Chunk 6: Web UI

### Task 11: Admin API client methods

**Files:**
- Modify: `packages/web/src/api/client.ts`
- Modify: `packages/web/src/api/client.test.ts`

- [ ] **Step 1: Add failing tests for admin methods**

Add to `packages/web/src/api/client.test.ts`:

```typescript
describe('CoreClient admin methods', () => {
  const client = new CoreClient('http://localhost:4747', 'test-token')

  it('listModels returns grouped model array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ baseName: 'codestral:22b', variants: [] }],
    } as Response)
    const result = await client.listModels()
    expect(result).toHaveLength(1)
    expect(result[0].baseName).toBe('codestral:22b')
  })

  it('removeModel sends DELETE request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response)
    await client.removeModel('codestral:22b-Q4_K_M')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/models/'),
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('updateRegistry sends PATCH request', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ ok: true }),
    } as Response)
    await client.updateRegistry({ cfo: { high: 'model-a', medium: 'model-b', low: 'model-c' } })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/registry'),
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('addModel sends POST request with hfModelId and quants', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ message: 'Pipeline started' }),
    } as Response)
    await client.addModel('owner/mymodel', ['Q4_K_M'], 'sess-1')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/models/add'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('owner/mymodel'),
      })
    )
  })

  it('getRegistry returns current registry assignments', async () => {
    const mockRegistry = { cfo: { high: 'model-a', medium: 'model-b', low: 'model-c' } }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => mockRegistry,
    } as Response)
    const result = await client.getRegistry()
    expect(result).toEqual(mockRegistry)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/registry'),
      expect.objectContaining({ method: 'GET' })
    )
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/web && pnpm test
```

Expected: fails — new client constructor overload not present.

- [ ] **Step 3: Update `packages/web/src/api/client.ts`**

```typescript
export interface ModelVariant {
  id: string
  quantLevel: string
  sizeGb: number
  addedAt: number
  active: boolean
}

export interface ModelGroup {
  baseName: string
  hfSource: string
  variants: ModelVariant[]
}

export type RegistryUpdate = Partial<Record<'cfo' | 'cto' | 'coo' | 'general', Record<'high' | 'medium' | 'low', string>>>

export class CoreClient {
  private baseUrl: string
  private adminToken: string | undefined

  constructor(baseUrl: string, adminToken?: string) {
    this.baseUrl = baseUrl
    this.adminToken = adminToken
  }

  private adminHeaders(): Record<string, string> {
    return this.adminToken ? { 'x-admin-token': this.adminToken } : {}
  }

  async sendMessage(options: SendMessageOptions): Promise<SendMessageResult> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Chat request failed (${res.status}): ${text}`)
    }
    return res.json()
  }

  async listModels(): Promise<ModelGroup[]> {
    const res = await fetch(`${this.baseUrl}/api/admin/models`, {
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to list models (${res.status})`)
    return res.json()
  }

  async removeModel(quantId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/models/${encodeURIComponent(quantId)}`, {
      method: 'DELETE',
      headers: this.adminHeaders(),
    })
    if (!res.ok && res.status !== 204) throw new Error(`Failed to remove model (${res.status})`)
  }

  async addModel(hfModelId: string, quants: string[], sessionId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/models/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify({ hfModelId, quants, sessionId }),
    })
    if (!res.ok) throw new Error(`Failed to start install (${res.status})`)
  }

  async getRegistry(): Promise<Record<string, Record<string, string>>> {
    const res = await fetch(`${this.baseUrl}/api/admin/registry`, {
      method: 'GET',
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Failed to get registry (${res.status})`)
    return res.json()
  }

  async updateRegistry(updates: RegistryUpdate): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/admin/registry`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.adminHeaders() },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to update registry (${res.status}): ${text}`)
    }
  }
}

export const coreClient = new CoreClient('/api')
```

- [ ] **Step 4: Run web tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/web && pnpm test
```

Expected: all web tests pass.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/web/src/api/client.ts packages/web/src/api/client.test.ts
git commit -m "feat(web/api): add admin methods to CoreClient (listModels, removeModel, updateRegistry)"
```

---

### Task 12: ModelCard + ModelInstaller components

**Files:**
- Create: `packages/web/src/components/ModelCard.tsx`
- Create: `packages/web/src/components/ModelCard.test.tsx`
- Create: `packages/web/src/components/ModelInstaller.tsx`
- Create: `packages/web/src/components/ModelInstaller.test.tsx`

- [ ] **Step 1: Write failing tests for ModelCard**

`packages/web/src/components/ModelCard.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModelCard } from './ModelCard'

const group = {
  baseName: 'codestral:22b',
  hfSource: 'mistralai/Codestral-22B-v0.1',
  variants: [
    { id: 'codestral:22b-Q4_K_M', quantLevel: 'Q4_K_M', sizeGb: 12.5, addedAt: Date.now(), active: true },
    { id: 'codestral:22b-Q8_0',   quantLevel: 'Q8_0',   sizeGb: 23.1, addedAt: Date.now(), active: true },
  ],
}

describe('ModelCard', () => {
  it('renders model name and source', () => {
    render(<ModelCard group={group} onRemove={vi.fn()} />)
    expect(screen.getByText('codestral:22b')).toBeInTheDocument()
    expect(screen.getByText('mistralai/Codestral-22B-v0.1')).toBeInTheDocument()
  })

  it('renders quant variant badges', () => {
    render(<ModelCard group={group} onRemove={vi.fn()} />)
    expect(screen.getByText('Q4_K_M')).toBeInTheDocument()
    expect(screen.getByText('Q8_0')).toBeInTheDocument()
  })

  it('calls onRemove with variant id when Remove clicked', () => {
    const onRemove = vi.fn()
    render(<ModelCard group={group} onRemove={onRemove} />)
    fireEvent.click(screen.getAllByText('Remove')[0])
    expect(onRemove).toHaveBeenCalledWith('codestral:22b-Q4_K_M')
  })

  it('disables Remove button for removing variant while removal is pending', () => {
    render(<ModelCard group={group} onRemove={vi.fn()} removingId="codestral:22b-Q4_K_M" />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[0]).toBeDisabled()
    expect(buttons[0]).toHaveTextContent('Removing…')
  })
})
```

- [ ] **Step 2: Write failing test for ModelInstaller**

`packages/web/src/components/ModelInstaller.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ModelInstaller } from './ModelInstaller'

describe('ModelInstaller', () => {
  it('renders HuggingFace input and quant selector', () => {
    render(<ModelInstaller onInstall={vi.fn()} installing={false} progress={null} />)
    expect(screen.getByPlaceholderText(/mistralai\/Codestral/i)).toBeInTheDocument()
    expect(screen.getByText('Fast')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('Quality')).toBeInTheDocument()
  })

  it('calls onInstall with modelId and quant when Install clicked', () => {
    const onInstall = vi.fn()
    render(<ModelInstaller onInstall={onInstall} installing={false} progress={null} />)
    fireEvent.change(screen.getByPlaceholderText(/mistralai\/Codestral/i), {
      target: { value: 'owner/mymodel' },
    })
    fireEvent.click(screen.getByText('Install'))
    expect(onInstall).toHaveBeenCalledWith('owner/mymodel', 'Q4_K_M')
  })

  it('disables Install button while installing', () => {
    render(<ModelInstaller onInstall={vi.fn()} installing={true} progress={null} />)
    expect(screen.getByText('Installing...')).toBeDisabled()
  })
})
```

- [ ] **Step 3: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/web && pnpm test
```

Expected: `Cannot find module './ModelCard'` and `Cannot find module './ModelInstaller'`

- [ ] **Step 4: Implement `packages/web/src/components/ModelCard.tsx`**

```tsx
import type { ModelGroup } from '../api/client'

interface ModelCardProps {
  group: ModelGroup
  onRemove: (variantId: string) => void
  removingId?: string  // variant currently being removed (disables its button)
}

export function ModelCard({ group, onRemove, removingId }: ModelCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="mb-3">
        <div className="font-semibold text-white">{group.baseName}</div>
        <div className="text-xs text-gray-500 mt-0.5">{group.hfSource}</div>
      </div>
      <div className="space-y-2">
        {group.variants.map((v) => {
          const isRemoving = removingId === v.id
          return (
            <div key={v.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded">
                  {v.quantLevel}
                </span>
                <span className="text-xs text-gray-500">{v.sizeGb.toFixed(1)} GB</span>
              </div>
              <button
                onClick={() => onRemove(v.id)}
                disabled={isRemoving}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
              >
                {isRemoving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement `packages/web/src/components/ModelInstaller.tsx`**

```tsx
import { useState } from 'react'
import type { QuantProgress } from '../../../core/src/models/quantizer'

type Quant = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'

interface ModelInstallerProps {
  onInstall: (hfModelId: string, quant: Quant) => void
  installing: boolean
  progress: QuantProgress | null
  error?: string | null
}

const QUANT_OPTIONS: { value: Quant; label: string; desc: string }[] = [
  { value: 'Q4_K_M', label: 'Fast',     desc: 'Smallest — fits more models in VRAM' },
  { value: 'Q5_K_M', label: 'Balanced', desc: 'Recommended — best quality/size tradeoff' },
  { value: 'Q8_0',   label: 'Quality',  desc: 'Highest quality — requires more VRAM' },
]

export function ModelInstaller({ onInstall, installing, progress, error }: ModelInstallerProps) {
  const [modelId, setModelId] = useState('')
  const [quant, setQuant] = useState<Quant>('Q4_K_M')

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Add Model</h3>

      <label className="block text-xs text-gray-400 mb-1">HuggingFace Model ID</label>
      <input
        className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 mb-4"
        placeholder="mistralai/Codestral-22B-v0.1"
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        disabled={installing}
      />

      <div className="grid grid-cols-3 gap-2 mb-4">
        {QUANT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setQuant(opt.value)}
            className={`p-3 rounded-lg border text-left transition-all ${
              quant === opt.value
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-gray-700 hover:border-gray-600'
            }`}
          >
            <div className="text-sm font-semibold text-white">{opt.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
          </button>
        ))}
      </div>

      {progress && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>{progress.message}</span>
            <span>{progress.step}/{progress.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-1">
            <div
              className="bg-cyan-400 h-1 rounded-full transition-all"
              style={{ width: `${(progress.step / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 mb-3">{error}</div>
      )}

      <button
        onClick={() => onInstall(modelId, quant)}
        disabled={!modelId.trim() || installing}
        className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-lg transition-colors text-sm"
      >
        {installing ? 'Installing...' : 'Install'}
      </button>
    </div>
  )
}
```

Note: The `QuantProgress` import from core won't work in web package — inline the type instead:

```tsx
interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI/packages/web && pnpm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/web/src/components/ModelCard.tsx packages/web/src/components/ModelCard.test.tsx packages/web/src/components/ModelInstaller.tsx packages/web/src/components/ModelInstaller.test.tsx
git commit -m "feat(web): add ModelCard and ModelInstaller components"
```

---

### Task 13: DomainAssigner + Models page + App routing

**Files:**
- Create: `packages/web/src/components/DomainAssigner.tsx`
- Create: `packages/web/src/components/DomainAssigner.test.tsx`
- Create: `packages/web/src/pages/Models.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/pages/Chat.tsx`

- [ ] **Step 1: Write failing test for DomainAssigner**

`packages/web/src/components/DomainAssigner.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DomainAssigner } from './DomainAssigner'

const models = [
  { baseName: 'model-a', hfSource: '', variants: [{ id: 'model-a-q4', quantLevel: 'Q4_K_M', sizeGb: 2, addedAt: 0, active: true }] },
  { baseName: 'model-b', hfSource: '', variants: [{ id: 'model-b-q8', quantLevel: 'Q8_0', sizeGb: 8, addedAt: 0, active: true }] },
]

describe('DomainAssigner', () => {
  it('renders 4 domain rows', () => {
    render(<DomainAssigner models={models} registry={{}} onChange={vi.fn()} />)
    expect(screen.getByText('COO')).toBeInTheDocument()
    expect(screen.getByText('CFO')).toBeInTheDocument()
    expect(screen.getByText('CTO')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('calls onChange when a select changes', () => {
    const onChange = vi.fn()
    render(<DomainAssigner models={models} registry={{}} onChange={onChange} />)
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'model-a-q4' } })
    expect(onChange).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd C:/Users/John/Coastal.AI/packages/web && pnpm test
```

Expected: `Cannot find module './DomainAssigner'`

- [ ] **Step 3: Implement `packages/web/src/components/DomainAssigner.tsx`**

```tsx
import { useState } from 'react'
import type { ModelGroup, RegistryUpdate } from '../api/client'

type Domain = 'coo' | 'cfo' | 'cto' | 'general'
type Urgency = 'high' | 'medium' | 'low'

const DOMAINS: { key: Domain; label: string }[] = [
  { key: 'coo', label: 'COO' },
  { key: 'cfo', label: 'CFO' },
  { key: 'cto', label: 'CTO' },
  { key: 'general', label: 'General' },
]

const URGENCIES: { key: Urgency; label: string }[] = [
  { key: 'high',   label: 'High Priority' },
  { key: 'medium', label: 'Medium' },
  { key: 'low',    label: 'Low' },
]

interface DomainAssignerProps {
  models: ModelGroup[]
  registry: Record<string, Record<string, string>>
  onChange: (update: RegistryUpdate) => void
}

type CellKey = `${Domain}.${Urgency}`
type CellState = 'idle' | 'success' | 'error'

export function DomainAssigner({ models, registry, onChange }: DomainAssignerProps) {
  const allVariants = models.flatMap(g => g.variants)
  const [cellStates, setCellStates] = useState<Partial<Record<CellKey, CellState>>>({})

  const handleChange = async (domain: Domain, urgency: Urgency, value: string) => {
    const key: CellKey = `${domain}.${urgency}`
    try {
      await onChange({
        [domain]: { ...registry[domain], [urgency]: value },
      } as RegistryUpdate)
      setCellStates(s => ({ ...s, [key]: 'success' }))
    } catch {
      setCellStates(s => ({ ...s, [key]: 'error' }))
    }
    setTimeout(() => setCellStates(s => ({ ...s, [key]: 'idle' })), 1500)
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Domain Assignments</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-500 pb-3 pr-4">Domain</th>
              {URGENCIES.map(u => (
                <th key={u.key} className="text-left text-xs text-gray-500 pb-3 pr-4">{u.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOMAINS.map(domain => (
              <tr key={domain.key} className="border-t border-gray-800">
                <td className="py-3 pr-4 font-semibold text-white">{domain.label}</td>
                {URGENCIES.map(urgency => {
                  const current = registry[domain.key]?.[urgency.key] ?? ''
                  const state = cellStates[`${domain.key}.${urgency.key}` as CellKey] ?? 'idle'
                  const borderClass = state === 'success'
                    ? 'border-green-500'
                    : state === 'error'
                    ? 'border-red-500'
                    : 'border-gray-700'
                  return (
                    <td key={urgency.key} className="py-3 pr-4">
                      <select
                        value={current}
                        onChange={(e) => handleChange(domain.key, urgency.key, e.target.value)}
                        title={state === 'error' ? 'Update failed — check model registry' : undefined}
                        className={`bg-gray-800 border ${borderClass} text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500 w-full transition-colors`}
                      >
                        <option value="">— select —</option>
                        {allVariants.map(v => (
                          <option key={v.id} value={v.id}>{v.id}</option>
                        ))}
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `packages/web/src/pages/Models.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { CoreClient, type ModelGroup, type RegistryUpdate } from '../api/client'
import { ModelCard } from '../components/ModelCard'
import { ModelInstaller } from '../components/ModelInstaller'
import { DomainAssigner } from '../components/DomainAssigner'

interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}

const adminClient = new CoreClient('/api', import.meta.env.VITE_ADMIN_TOKEN ?? '')
// Note: Set VITE_ADMIN_TOKEN in packages/web/.env.local to match CC_ADMIN_TOKEN from core startup output.
// Example: VITE_ADMIN_TOKEN=<token printed to stdout on first core start>
// In production, replace with a login form or server-session mechanism — never ship the token in a
// public bundle. For the purposes of this internal admin UI, .env.local is acceptable.

export function Models() {
  const [models, setModels] = useState<ModelGroup[]>([])
  const [registry, setRegistry] = useState<Record<string, Record<string, string>>>({})
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<QuantProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [m, reg] = await Promise.all([
        adminClient.listModels(),
        adminClient.getRegistry(),
      ])
      setModels(m)
      setRegistry(reg)
    } catch (e) {
      console.error('Failed to load models', e)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleInstall = async (hfModelId: string, quant: string) => {
    setInstalling(true)
    setError(null)
    setProgress(null)
    const sessionId = `install-${Date.now()}`

    // Derive WebSocket URL from current window location to avoid hardcoding localhost
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = window.location.hostname
    const wsPort = import.meta.env.VITE_CORE_PORT ?? '4747'
    const ws = new WebSocket(`${wsProtocol}//${wsHost}:${wsPort}/ws/session`)
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'quant_progress') setProgress(msg)
      } catch {}
    }

    try {
      await adminClient.addModel(hfModelId, [quant], sessionId)
      // Wait for ws completion (simplified: poll after delay)
      await new Promise(r => setTimeout(r, 2000))
      await refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Installation failed')
    } finally {
      setInstalling(false)
      ws.close()
    }
  }

  const handleRemove = async (variantId: string) => {
    setRemovingId(variantId)
    try {
      await adminClient.removeModel(variantId)
      await refresh()
    } catch (e: unknown) {
      console.error('Remove failed', e)
    } finally {
      setRemovingId(null)
    }
  }

  const handleRegistryChange = async (update: RegistryUpdate) => {
    await adminClient.updateRegistry(update)  // let rejection propagate to DomainAssigner
    setRegistry(prev => ({ ...prev, ...update }))
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <h1 className="text-xl font-bold text-white mb-6">Model Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {models.length === 0 && (
          <div className="col-span-full text-gray-500 text-sm">
            No models installed yet. Add one below.
          </div>
        )}
        {models.map(g => (
          <ModelCard key={g.baseName} group={g} onRemove={handleRemove} removingId={removingId ?? undefined} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ModelInstaller
          onInstall={handleInstall}
          installing={installing}
          progress={progress}
          error={error}
        />
        <DomainAssigner
          models={models}
          registry={registry}
          onChange={handleRegistryChange}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Update `packages/web/src/App.tsx` with routing**

```tsx
import { useState } from 'react'
import { Onboarding } from './pages/Onboarding'
import { Chat } from './pages/Chat'
import { Models } from './pages/Models'
import './index.css'

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [page, setPage] = useState<'chat' | 'models'>('chat')

  if (!sessionId) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <Onboarding onComplete={setSessionId} />
    </div>
  )

  if (page === 'models') return (
    <div>
      <nav className="fixed top-0 left-0 right-0 z-10 bg-gray-950 border-b border-gray-800 px-6 py-3 flex justify-between items-center">
        <span className="text-sm text-gray-400 font-mono">COASTAL CLAW</span>
        <div className="flex gap-4">
          <button onClick={() => setPage('chat')} className="text-sm text-gray-400 hover:text-white transition-colors">Chat</button>
          <button className="text-sm text-cyan-400">Models</button>
        </div>
      </nav>
      <div className="pt-14">
        <Models />
      </div>
    </div>
  )

  return <Chat sessionId={sessionId} onNav={() => setPage('models')} />
}
```

- [ ] **Step 6: Update `packages/web/src/pages/Chat.tsx`** — add `onNav` prop and nav link in header

Replace the file with:

```tsx
import { useState, useRef, useEffect } from 'react'
import { ChatBubble } from '../components/ChatBubble'
import { coreClient } from '../api/client'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function Chat({ sessionId, onNav }: { sessionId: string; onNav: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello. I\'m your AI executive. How can I help you today?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    setLoading(true)
    try {
      const res = await coreClient.sendMessage({ message: text, sessionId })
      setMessages((m) => [...m, { role: 'assistant', content: res.reply }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Connection error. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-sm text-gray-400 font-mono">COASTAL CLAW · SESSION {sessionId.slice(-8).toUpperCase()}</span>
        <button onClick={onNav} className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-auto">
          Models
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {loading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-2xl">
              <span className="text-cyan-500 font-mono text-sm animate-pulse">thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 px-4 py-4">
        <div className="flex gap-3 max-w-4xl mx-auto">
          <input
            className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Message your agent..."
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-5 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-black font-semibold rounded-xl transition-colors text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run all tests — expect PASS**

```bash
cd C:/Users/John/Coastal.AI && pnpm test
```

Expected: all tests pass across core and web.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/John/Coastal.AI
git add packages/web/src/
git commit -m "feat(web): add Models page with DomainAssigner, ModelCard, ModelInstaller, and App routing"
```

---

## Final: Full test run + push

- [ ] **Step 1: Run complete monorepo test suite**

```bash
cd C:/Users/John/Coastal.AI && pnpm test
```

Expected: all tasks pass across both packages.

- [ ] **Step 2: Push to GitHub**

```bash
cd C:/Users/John/Coastal.AI && git push origin master
```
