# Intelligent Routing + Model Quantization Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `ModelRouter → OllamaClient` path with a cascade routing layer that classifies every request by intent and domain, selects the right specialist model, automatically manages quantization levels to fit multiple large models in VRAM, and gives non-technical users a point-and-click UI to install and assign models.

**Architecture:** A new `packages/core/src/routing/` module sits between `ModelRouter` and `OllamaClient`. Incoming requests are classified by a tiny ONNX model (tiny-router) for intent signals, then domain-classified by a rules cascade with LLM fallback. The classification drives model selection from a hot-reloadable config. A separate quantization pipeline converts any HuggingFace model to GGUF and registers it with Ollama. VRAM is tracked per-model so quant level degrades gracefully under memory pressure.

**Tech Stack:** `onnxruntime-node` (tiny-router inference), `fs.watch` (hot-reload), `llama.cpp` prebuilt binaries + Python 3.10+ with `transformers`, `gguf`, `numpy` (GGUF conversion), Ollama Modelfile API (model registration), SQLite (model registry), React + Tailwind v4 (management UI), existing Fastify + WebSocket infrastructure (progress streaming).

---

## 1. Architecture Overview

```
Incoming request
       │
       ▼
  TinyRouterClient          ← ONNX inference, ~5ms, always runs
  (urgency, actionability,
   retention, relation)
       │
       ▼
  DomainClassifier           ← Rules-based first (~0ms)
  (COO / CFO / CTO /           if confidence < 0.7 → LLM fallback
   general)                    (qwen2.5:0.5b, ~200ms)
       │
       ▼
  DomainModelRegistry        ← Config-driven map:
  (domain + urgency            domain + urgency → preferred model
   → model preference)         hot-reloadable, UI-editable
       │
       ▼
  VRAMManager                ← Queries Ollama /api/ps for loaded models
  (model + VRAM budget         Selects highest quant that fits:
   → model:quant string)       Q8_0 → Q6_K → Q5_K_M → Q4_K_M → Q4_0
       │
       ▼
  OllamaClient.chat()        ← Unchanged
```

**Retention signal → UnifiedMemory integration:**
tiny-router's `retention` output replaces the current hardcoded fan-out logic in `UnifiedMemory.write()`:
- `remember` → LosslessAdapter + Mem0 (full persistence)
- `useful` → LosslessAdapter only
- `ephemeral` → skip persistence entirely (e.g. "what time is it?")

---

## 2. File Structure

```
packages/core/src/
  routing/
    types.ts             — RouteSignals, RouteDecision interfaces
    cascade.ts           — CascadeRouter (main orchestrator)
    tiny-router.ts       — onnxruntime-node ONNX inference wrapper
    domain-classifier.ts — Rules pass + LLM fallback domain classifier
    domain-registry.ts   — Loads + watches model-registry.json
    vram-manager.ts      — VRAM budget tracking + quant selection
  models/
    ollama.ts            — (existing, unchanged)
    router.ts            — Updated: chat() returns { reply, decision }
    quantizer.ts         — HuggingFace → GGUF → Ollama pipeline
  api/routes/
    chat.ts              — Updated: threads retention signal into UnifiedMemory
    admin.ts             — New: /api/admin/models/*, /api/admin/registry
  memory/
    index.ts             — Updated: write() accepts optional retention override

packages/web/src/
  pages/
    Models.tsx           — Model management page (3 panels)
  components/
    ModelCard.tsx        — Installed model card with Remove button
    ModelInstaller.tsx   — HF URL input + quant selector + progress bar
    DomainAssigner.tsx   — Domain → model dropdowns (4 rows × 3 urgency levels)
```

---

## 3. Component Specifications

### 3.1 Types (`routing/types.ts`)

```typescript
export interface RouteSignals {
  relation: 'new' | 'follow_up' | 'correction' | 'confirmation' | 'cancellation' | 'closure'
  actionability: 'none' | 'review' | 'act'
  retention: 'ephemeral' | 'useful' | 'remember'
  urgency: 'low' | 'medium' | 'high'
  confidence: number
}

export interface RouteDecision {
  model: string              // e.g. "codestral:22b-q4_K_M"
  domain: 'coo' | 'cfo' | 'cto' | 'general'
  signals: RouteSignals
  domainConfidence: number
  classifiedBy: 'rules' | 'llm'  // audit trail
}
```

### 3.2 TinyRouterClient (`routing/tiny-router.ts`)

- Loads `CC_TINY_ROUTER_MODEL` ONNX file at startup via `onnxruntime-node`
- Singleton — one model load, many inference calls
- Returns `RouteSignals` from the 4 classification heads
- **Graceful fallback:** if ONNX file is absent, returns safe defaults so the rest of the
  system continues working without the model present:
  ```typescript
  { relation: 'new', urgency: 'medium', actionability: 'act', retention: 'useful', confidence: 0 }
  ```

### 3.3 DomainClassifier (`routing/domain-classifier.ts`)

Two-stage cascade:

**Stage 1 — Rules pass (~0ms)**
Lowercases the message text and counts matches against each domain's keyword list.
Confidence = `matchesForWinningDomain / keywordsInThatDomain` clamped to [0, 1].
The domain with the highest match count wins. If no domain scores any matches, confidence = 0.

```typescript
const DOMAIN_KEYWORDS = {
  cfo: ['burn rate', 'runway', 'arr', 'mrr', 'fundraising', 'cap table', 'revenue', 'budget', 'forecast'],
  cto: ['architecture', 'tech stack', 'deployment', 'api', 'database', 'latency', 'infrastructure', 'code'],
  coo: ['hiring', 'team', 'process', 'operations', 'roadmap', 'headcount', 'okr', 'workflow'],
}
```

Example: message "what's our burn rate?" → matches `cfo` 1/9 = 0.11 — below threshold, LLM fires.
Example: message "review burn rate, runway, and arr forecast" → matches `cfo` 3/9 = 0.33 — LLM fires.
Example: message containing 7 of 9 CFO keywords → 0.78 — above threshold, rules path used.

**Stage 2 — LLM fallback (~200ms, only when Stage 1 confidence < CC_ROUTER_CONFIDENCE)**
Calls `CC_QUANT_ROUTER_MODEL` with a structured system prompt listing each domain's responsibilities.
The prompt instructs the model to return only valid JSON: `{ "domain": "cfo", "confidence": 0.92 }`.
Parses the response with a try/catch; on any parse failure or invalid domain value, defaults to
`{ domain: 'general', confidence: 0.5 }`.

### 3.4 DomainModelRegistry (`routing/domain-registry.ts`)

- Loads `CC_DATA_DIR/model-registry.json` on startup
- Watches file with `fs.watch` — hot-reloads in-place on change (no restart needed)
- `resolve(domain, urgency)` → preferred model name for that domain + urgency level.
  If that model is not present in Ollama's model list, falls back to the next urgency tier
  (high → medium → low → `llama3.2:1b` hardcoded final fallback).

**Default `model-registry.json`:**
```json
{
  "cfo":     { "high": "llama3.1:8b-q4_K_M", "medium": "llama3.2:3b", "low": "llama3.2:1b" },
  "cto":     { "high": "llama3.1:8b-q4_K_M", "medium": "llama3.2:3b", "low": "llama3.2:1b" },
  "coo":     { "high": "llama3.1:8b-q4_K_M", "medium": "llama3.2:3b", "low": "llama3.2:1b" },
  "general": { "high": "llama3.1:8b-q4_K_M", "medium": "llama3.2:3b", "low": "llama3.2:1b" }
}
```
Ships with generic defaults. Customers replace entries with their specialist models via the UI.

### 3.5 VRAMManager (`routing/vram-manager.ts`)

- Queries `GET /api/ps` on Ollama to get currently loaded models and their VRAM usage
- Reads `CC_VRAM_BUDGET_GB` for total budget
- `selectQuant(modelName)` → tries quant levels in descending quality order:
  **`Q8_0 → Q6_K → Q5_K_M → Q4_K_M → Q4_0`**
  Returns the highest quality variant that fits within remaining VRAM budget.
  Checks the SQLite model registry to know which variants are installed for a given base model.
- If the requested model is already loaded at any quant level, returns that directly (avoids a reload penalty).
- If no variant fits, returns `Q4_0` of the model and accepts the VRAM pressure (Ollama will evict the least-recently-used model automatically).

### 3.6 CascadeRouter (`routing/cascade.ts`)

Orchestrates the full routing decision:

```
1. TinyRouterClient.classify(message)           → RouteSignals
2. DomainClassifier.classify(message)           → { domain, confidence, classifiedBy }
3. DomainModelRegistry.resolve(domain, urgency) → preferredModel
4. VRAMManager.selectQuant(preferredModel)      → model:quant string
5. return RouteDecision
```

### 3.7 Updated ModelRouter (`models/router.ts`)

`ModelRouter.chat()` return type changes from `Promise<string>` to
`Promise<{ reply: string; decision: RouteDecision }>`.

```typescript
async chat(
  messages: ChatMessage[],
  options?: ChatOptions
): Promise<{ reply: string; decision: RouteDecision }> {
  const decision = await this.cascade.route(messages[messages.length - 1].content)
  const reply = await this.ollama.chat(decision.model, messages)
  return { reply, decision }
}
```

### 3.8 Updated UnifiedMemory (`memory/index.ts`)

`write()` gains an optional `retention` parameter that overrides the default fan-out logic:

```typescript
async write(
  entry: MemoryEntry,
  retention: 'ephemeral' | 'useful' | 'remember' = 'useful'
): Promise<void> {
  if (retention === 'ephemeral') return   // skip all persistence

  await this.lossless.write(entry)        // always write to SQLite for non-ephemeral

  if (retention === 'remember') {
    // fire-and-forget to Mem0 (same as current behavior for user messages)
    this.mem0.add(entry.content, entry.sessionId).catch(() => {})
  }
}
```

The existing default (`'useful'`) preserves backward compatibility — callers that don't pass `retention` get the same behavior as before.

### 3.9 Updated chatRoutes (`api/routes/chat.ts`)

The chat route threads `retention` from the `RouteDecision` into `UnifiedMemory.write()`:

```typescript
// After routing:
const { reply, decision } = await router.chat(messages, { model })
const retention = decision.signals.retention

// Persist user message with retention signal
await memory.write({ ...userEntry }, retention)

// Assistant replies are always persisted (they don't go through tiny-router)
await memory.write({ ...assistantEntry }, 'useful')
```

### 3.10 QuantizationPipeline (`models/quantizer.ts`)

On-demand pipeline triggered by `POST /api/admin/models/add`.

**Runtime dependencies:**
- `llama.cpp` prebuilt Windows binaries (auto-downloaded to `CC_LLAMA_CPP_DIR` on first use from official GitHub releases)
- Python 3.10+ with packages: `transformers`, `gguf`, `numpy`, `torch` (CPU-only build sufficient for conversion). The pipeline checks for Python at startup and surfaces a clear error if missing.

**Pipeline steps:**
```
1. huggingface-cli download <hfModelId>      → safetensors in CC_DATA_DIR/downloads/
2. python convert_hf_to_gguf.py              → base .gguf
3. ./llama-quantize <model.gguf> Q4_K_M      → model-Q4_K_M.gguf
4. ./llama-quantize <model.gguf> Q5_K_M      → model-Q5_K_M.gguf  (if requested)
5. ./llama-quantize <model.gguf> Q8_0        → model-Q8_0.gguf     (if requested)
6. ollama create <name>:<quant> -f Modelfile → registered in Ollama
7. INSERT INTO models (...)                  → SQLite registry
```

Progress is streamed to the requesting WebSocket connection as JSON events:
`{ type: 'quant_progress', step: number, total: number, message: string }`.
The WebSocket session ID from the originating request is stored when the pipeline starts,
so progress is sent only to the client that initiated the install.

**SQLite model registry table:**
```sql
CREATE TABLE models (
  id          TEXT PRIMARY KEY,   -- "codestral:22b-q4_K_M"
  hf_source   TEXT,               -- "mistralai/Codestral-22B-v0.1"
  base_name   TEXT,               -- "codestral:22b"
  quant_level TEXT,               -- "Q4_K_M"
  added_at    INTEGER,
  size_gb     REAL,
  active      INTEGER DEFAULT 1
);
```

---

## 4. Admin API

```
POST   /api/admin/models/add
       Body: { hfModelId: string, quants: ('Q4_K_M' | 'Q5_K_M' | 'Q8_0')[], sessionId: string }
       → validates hfModelId format (must be "owner/repo"), starts pipeline,
         progress streamed to the provided sessionId's WebSocket connection

DELETE /api/admin/models/:quantId
       → removes a single quant variant (e.g. "codestral:22b-q4_K_M")
       → runs `ollama rm <quantId>`, marks active=0 in SQLite for that row only
       → other quant variants of the same base model are unaffected
       → to remove all variants of a base model, call DELETE for each quant individually

GET    /api/admin/models
       → returns all SQLite model rows grouped by base_name:
         [{ baseName, hfSource, variants: [{ id, quantLevel, sizeGb, active }] }]

PATCH  /api/admin/registry
       Body: { cfo?: {...}, cto?: {...}, coo?: {...}, general?: {...} }
       → validates that every model name in the body exists in the SQLite registry (active=1)
         before writing; returns 422 with the invalid model name if validation fails
       → writes model-registry.json, triggers hot-reload
```

All admin routes require header `x-admin-token: <CC_ADMIN_TOKEN>`. On first run, if
`CC_ADMIN_TOKEN` is not set, a random token is generated, stored in `CC_DATA_DIR/.admin-token`,
and printed to stdout once.

---

## 5. Model Management UI (`packages/web`)

**`/models` page — 3 panels:**

**Panel 1 — Installed Models**
Card grid. Each card: model name, HuggingFace source, quant variants as badges (Q4/Q5/Q8),
size on disk, Remove button per variant. Loading state during removal. Empty state message
when no models are installed.

**Panel 2 — Add Model**
- Text input: "Paste a HuggingFace model ID" with placeholder `mistralai/Codestral-22B-v0.1`
- Quant selector: three radio buttons — **Fast** (Q4_K_M), **Balanced** (Q5_K_M), **Quality** (Q8_0)
- **Install** button → progress bar with step label (e.g. "Step 3 of 7: Quantizing Q4_K_M...")
  fed live from WebSocket events. Button disabled while install is in progress.
- Error state: plain-English message (e.g. "Model not found on HuggingFace — check the ID and try again")

**Panel 3 — Domain Assignments**
Table: 4 rows (COO, CFO, CTO, General) × 3 columns (High Priority, Medium, Low).
Each cell is a `<select>` populated from `GET /api/admin/models` (active models only).
On change → `PATCH /api/admin/registry` immediately. No save button needed.
Visual confirmation: brief green border flash on the changed cell on success.
Error state: red border + tooltip if the PATCH fails.

**App routing:** `/` → Onboarding/Chat (existing), `/models` → Models page.
Nav link added to chat header: small "Models" text link, right-aligned.

---

## 6. Config Variables

```
CC_DATA_DIR              Base directory for all persistent data (default: ./data)
                         Inherited from Phase 1 — defines location of SQLite DB,
                         model-registry.json, downloads/, llama-cpp/ binaries
CC_VRAM_BUDGET_GB        Total GPU VRAM available (default: 24)
CC_ROUTER_CONFIDENCE     Cascade threshold — below this, LLM fallback fires (default: 0.7)
CC_TINY_ROUTER_MODEL     Path to tiny-router ONNX file (default: ./data/tiny-router.onnx)
CC_QUANT_ROUTER_MODEL    LLM fallback model name in Ollama (default: qwen2.5:0.5b)
CC_LLAMA_CPP_DIR         Path to llama.cpp binaries directory (default: ./data/llama-cpp/)
CC_ADMIN_TOKEN           Shared secret for /api/admin/* routes
                         (auto-generated on first run, stored in CC_DATA_DIR/.admin-token)
```

---

## 7. Testing

- **`CascadeRouter`** — unit tested with mocked `TinyRouterClient`, `DomainClassifier`, `VRAMManager`. Verifies rules path fires on high confidence, LLM path fires on low confidence, fallback defaults used when Ollama is unavailable.
- **`VRAMManager`** — unit tested with mocked `/api/ps` responses. Verifies quant degradation order (`Q8_0 → Q6_K → Q5_K_M → Q4_K_M → Q4_0`) as VRAM fills.
- **`DomainClassifier`** — tests keyword matching (correct domain wins, correct confidence formula), LLM JSON parsing, malformed response defaulting to `general`.
- **`DomainModelRegistry`** — tests hot-reload: write file, verify in-memory registry updates on next `resolve()` call without restart.
- **`UnifiedMemory`** — tests the three retention paths: `ephemeral` skips all writes, `useful` writes lossless only, `remember` writes lossless + fires Mem0. Verifies default (`useful`) preserves existing behavior.
- **`QuantizationPipeline`** — integration test gated by `CC_INTEGRATION_TESTS=true` (skipped in CI by default). Uses a small public GGUF to verify full pipeline end-to-end.
- **Model Management UI** — React Testing Library tests for all three panels, admin API mocked via `vi.mock`. Tests install flow, remove flow, domain assignment change + immediate PATCH.

---

## 8. Roadmap Placement

Self-contained feature, implementable between Phase 1 and Phase 2 or in parallel with Phase 2.
Phase 1 dependencies: Fastify server, WebSocket channel, SQLite memory store, OllamaClient.
No Phase 2 dependencies.

**Suggested sequencing:**
1. Core routing layer (Tasks 1-4): types, TinyRouterClient ONNX, DomainClassifier, CascadeRouter
2. VRAMManager + DomainModelRegistry (Tasks 5-6): quant selection, hot-reload config
3. Updated ModelRouter + chatRoutes + UnifiedMemory (Task 7): wire retention signal end-to-end
4. QuantizationPipeline (Task 8): HuggingFace → GGUF → Ollama, Python dependency check
5. Admin API (Task 9): endpoints + token auth
6. Web UI (Tasks 10-12): Models page, ModelCard, ModelInstaller, DomainAssigner
