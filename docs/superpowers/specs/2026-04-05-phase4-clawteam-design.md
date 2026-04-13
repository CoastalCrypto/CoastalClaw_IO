# Coastal.AI Phase 4 — ClawTeam Design Spec

**Date:** 2026-04-05
**Status:** Approved for implementation planning
**Scope:** ClawTeam multi-agent swarm · VibeVoice voice pipeline · AirLLM inference · Infinity RAG · HyperAgents meta-agent pattern

---

## Goal

Phase 4 makes Coastal.AI a full multi-agent, voice-native, retrieval-augmented AI system:

- **ClawTeam** — boss agent fans work out to specialist sub-agents in parallel; agents can spawn, communicate, and self-improve
- **VibeVoice** — replaces whisper-cpp + piper-tts with Microsoft's streaming ASR (7B, diarization) and real-time TTS (0.5B, 200ms latency), GPU-conditional with CPU fallback
- **AirLLM** — third inference backend that runs 70B models on 4GB VRAM by streaming layers from disk; fills the gap between Ollama (CPU) and vLLM (needs full VRAM fit)
- **Infinity** — AI-native vector database replaces SQLite semantic search in UnifiedMemory, enabling hybrid dense + sparse + full-text retrieval at sub-millisecond latency
- **Meta-agent pattern** (from HyperAgents research) — boss agent can write, test, and merge code patches to improve sub-agents; tracked via archive logs

Everything degrades gracefully: VibeVoice falls back to whisper-cpp + piper-tts without GPU; AirLLM is probed after vLLM in the inference chain; Infinity falls back to SQLite when not running.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Coastal.AI Core                    │
│                                                      │
│  Voice Pipeline (packages/daemon)                    │
│    openwakeword → VibeVoiceClient.transcribe()       │
│                 → LLM → VibeVoiceClient.speak()      │
│    Fallback:    whisper-cpp → piper-tts (no GPU)     │
│                                                      │
│  Inference Chain (ModelRouter)                       │
│    inferenceClient(): vLLM → AirLLM → Ollama         │
│                                                      │
│  Memory / RAG (UnifiedMemory)                        │
│    InfinityClient → semantic + hybrid search         │
│    Fallback: SQLite (no Infinity running)            │
│                                                      │
│  Multi-Agent (ClawTeam)                              │
│    BossAgent → fan-out → [SpecialistAgent × N]       │
│    MetaAgent → write/test/merge self-improvement     │
└─────────────────────────────────────────────────────┘

External services (Python, GPU-conditional):
  coastal-vibevoice.service  → VibeVoice FastAPI (port 8001)
  coastal-vllm.service       → vLLM OpenAI API  (port 8000)
  coastal-airllm.service     → AirLLM OpenAI API (port 8002)
  coastal-infinity.service   → Infinity vector DB (port 23817)
```

---

## 1. VibeVoice Voice Pipeline

### What it is

Microsoft's open-source voice AI framework (MIT license, April 2026):
- **VibeVoice-ASR-7B** — Qwen2.5-7B backbone; 50+ languages; speaker diarization; timestamps; hotword injection; 60-min single-pass
- **VibeVoice-Realtime-0.5B** — Streaming TTS; 200–300ms first-chunk latency; 11 English voices + 9 languages; diffusion head

### Why it beats the current stack

| | whisper-cpp (current) | VibeVoice-ASR |
|---|---|---|
| Diarization | No | Yes (who + when) |
| Languages | 99 | 50+ (better quality) |
| Hotwords | No | Yes |
| Long-form | Chunked | 60-min single pass |
| VRAM | ~2GB (medium) | ~14GB (7B, bfloat16) |

| | piper-tts (current) | VibeVoice-Realtime |
|---|---|---|
| First-chunk latency | ~800ms | ~200ms |
| Streaming | No (batch) | Yes |
| Voice styles | 1 per voice file | 11 English + 9 lang |
| VRAM | 0 (CPU) | ~1GB (0.5B) |

### Degradation

```
GPU present → VibeVoice-ASR (port 8001/asr) + Realtime-0.5B (port 8001/tts)
No GPU     → whisper-cpp (child process) + piper-tts (child process)  [unchanged]
```

### Node.js interface

```typescript
// packages/core/src/voice/vibevoice.ts
export class VibeVoiceClient {
  constructor(private baseUrl = 'http://127.0.0.1:8001') {}

  async isAvailable(): Promise<boolean>

  // POST /asr  — multipart audio → structured transcript
  async transcribe(audioBuffer: Buffer, sampleRate = 16000): Promise<{
    text: string
    speakers: Array<{ id: string; start: number; end: number; text: string }>
  }>

  // WebSocket /tts/stream  — text → async audio chunk iterator
  async *speak(text: string, voice?: string): AsyncIterable<Buffer>
}
```

### Python service

`coastalos/vibevoice/server.py` — FastAPI wrapper around VibeVoice models:
- `POST /asr` — accepts audio/wav multipart, returns JSON transcript
- `WS /tts/stream` — accepts text, streams 24kHz PCM chunks

`coastalos/systemd/coastal-vibevoice.service` — runs as `coastal` user, GPU-conditional enable.

---

## 2. AirLLM Inference Backend

### What it is

`lyogavin/airllm` (Apache 2.0, 15K stars, Python/PyTorch) — runs 70B models on 4GB GPU by streaming model layers from disk with 4-bit block quantization. No distillation, no pruning.

### Why it matters

| Scenario | vLLM | AirLLM | Ollama |
|---|---|---|---|
| 7B model, 8GB VRAM | ✅ | ✅ | ✅ |
| 70B model, 8GB VRAM | ❌ (OOM) | ✅ (streams) | ❌ |
| 70B model, no GPU | ❌ | ❌ | ✅ (slow) |

AirLLM fills the "big model, small GPU" case — exactly what Vessel-class hardware hits with 7B+ models and 8–12GB consumer GPUs.

### Inference probe chain (updated)

```typescript
// ModelRouter.inferenceClient(): probes in order, caches result
1. VllmClient.isAvailable()     → vLLM (fastest, needs model to fit in VRAM)
2. AirLLMClient.isAvailable()   → AirLLM (slower, handles any size on small VRAM)
3. OllamaClient (always)        → Ollama (CPU fallback)
```

### Node.js interface

```typescript
// packages/core/src/models/airllm.ts
export class AirLLMClient {
  constructor(private baseUrl = 'http://127.0.0.1:8002') {}

  async isAvailable(): Promise<boolean>  // GET /health
  async chat(model: string, messages: LocalChatMessage[]): Promise<string>
  async chatWithTools(model, messages, tools): Promise<{ content, toolCalls }>
}
```

`coastalos/systemd/coastal-airllm.service` — GPU-conditional, serves OpenAI-compatible API on port 8002 via `airllm-server` CLI.

---

## 3. Infinity Vector Database (RAG)

### What it is

`infiniflow/infinity` (Apache 2.0, 4.5K stars, Rust+C++) — AI-native vector DB with hybrid search: dense vectors + sparse vectors + full-text + tensors. Sub-millisecond queries. Single binary.

### Why it improves UnifiedMemory

Current `UnifiedMemory` uses SQLite for everything — keyword search only. Infinity adds:
- **Semantic search** — embed queries + stored memories, rank by cosine similarity
- **Hybrid search** — dense + sparse + BM25 in one query (better recall than any alone)
- **Reranking** — ColBERT re-ranks top-K results before returning
- **Scale** — 1ms on 33M documents vs. SQLite full-table scan

### Integration

```typescript
// packages/core/src/memory/infinity-client.ts
export class InfinityClient {
  constructor(private baseUrl = 'http://127.0.0.1:23817') {}

  async isAvailable(): Promise<boolean>
  async upsert(collection: string, id: string, text: string, vector: number[], meta: Record<string, unknown>): Promise<void>
  async search(collection: string, query: string, queryVector: number[], topK = 10): Promise<SearchResult[]>
  async hybridSearch(collection: string, query: string, queryVector: number[], topK = 10): Promise<SearchResult[]>
}
```

`UnifiedMemory` gains an `InfinityClient` alongside SQLite:
- `write()` → SQLite (persistence) + Infinity upsert (semantic index)
- `queryHistory()` → unchanged (SQLite, structured)
- `semanticSearch()` → NEW: InfinityClient.hybridSearch(), falls back to SQLite LIKE

Embeddings generated locally via a small embedding model (nomic-embed-text via Ollama).

`coastalos/systemd/coastal-infinity.service` — always-on (no GPU needed), single binary.

---

## 4. ClawTeam Multi-Agent Swarm

### What it is

Boss-fan-out multi-agent architecture inspired by HyperAgents (facebookresearch, CC BY-NC-SA — architecture only, no code import).

**Note on HyperAgents license:** CC BY-NC-SA 4.0 prohibits commercial use. We implement the architectural pattern independently in TypeScript — no code from that repo enters this codebase.

### Architecture

```
BossAgent
  ├── receives task from user / AgenticLoop
  ├── decomposes into subtasks (via LLM planning prompt)
  ├── fans out to N SpecialistAgents in parallel
  ├── collects results + synthesizes reply
  └── optionally invokes MetaAgent for self-improvement

SpecialistAgent (extends AgentSession)
  ├── runs its own AgenticLoop with scoped tools
  ├── communicates results back to BossAgent via TeamChannel
  └── bounded by iteration budget + namespace sandbox

MetaAgent
  ├── reads skill-gaps.db (existing, from packages/architect)
  ├── asks LLM to propose a code fix (diff format)
  ├── creates git branch, applies diff, runs pnpm test
  ├── merges on pass, archives experiment to meta-archive.db
  └── reports outcome to BossAgent
```

### TeamChannel

Lightweight in-process message bus connecting Boss and Specialists:

```typescript
// packages/core/src/agents/team-channel.ts
export class TeamChannel {
  post(from: string, to: string, payload: TeamMessage): void
  subscribe(agentId: string, cb: (msg: TeamMessage) => void): () => void
  broadcast(from: string, payload: TeamMessage): void
}
```

### BossAgent

```typescript
// packages/core/src/agents/boss-agent.ts
export class BossAgent {
  constructor(
    private router: ModelRouter,
    private registry: AgentRegistry,
    private channel: TeamChannel,
    private toolRegistry: ToolRegistry,
  ) {}

  async run(task: string, sessionId: string): Promise<BossResult>
  private async decompose(task: string): Promise<SubTask[]>
  private async fanOut(subtasks: SubTask[]): Promise<SubResult[]>
  private async synthesize(results: SubResult[]): Promise<string>
}
```

### MetaAgent

Extends the existing `packages/architect` self-build loop with iteration tracking and archive logging:

```typescript
// packages/core/src/agents/meta-agent.ts
export class MetaAgent {
  async improve(skillGap: SkillGap): Promise<MetaResult>
  // Writes to meta-archive.db: iteration, patch, test result, merged/rejected
}
```

---

## 5. Key Design Decisions

### Why not import HyperAgents?

CC BY-NC-SA license. The self-improving agent loop pattern, meta-agent concept, and archive-based experiment logging are all described in their paper (arxiv 2603.19461). We implement these concepts independently.

### Why AirLLM as a probe, not default?

Layer-streaming inference is 3–5× slower than vLLM for small models that fit in VRAM. The probe order (vLLM → AirLLM → Ollama) ensures we use the fastest available backend, and AirLLM only activates when vLLM can't run (model too large for VRAM).

### Why Infinity alongside SQLite, not replacing it?

SQLite is the source of truth for structured data (session history, agent registry, action logs). Infinity is the semantic index. They serve different query patterns. The SQLite fallback ensures UnifiedMemory works with zero extra services.

### Why a separate coastal-vibevoice.service?

VibeVoice-ASR (7B) and vLLM both need significant VRAM. Keeping them as separate services allows selective enable — a box with 24GB VRAM can run both; 8GB boxes choose one. The GPU-conditional logic in `post-install.sh` handles this at ISO build time.

### Port assignments

| Service | Port |
|---------|------|
| coastal-server (Fastify) | 4747 |
| coastal-vllm | 8000 |
| coastal-vibevoice | 8001 |
| coastal-airllm | 8002 |
| coastal-infinity | 23817 |

---

## 6. File Map

```
CREATE:
  packages/core/src/voice/vibevoice.ts
  packages/core/src/voice/__tests__/vibevoice.test.ts
  packages/core/src/models/airllm.ts
  packages/core/src/models/__tests__/airllm.test.ts
  packages/core/src/memory/infinity-client.ts
  packages/core/src/memory/__tests__/infinity-client.test.ts
  packages/core/src/agents/team-channel.ts
  packages/core/src/agents/__tests__/team-channel.test.ts
  packages/core/src/agents/boss-agent.ts
  packages/core/src/agents/__tests__/boss-agent.test.ts
  packages/core/src/agents/meta-agent.ts
  packages/core/src/agents/__tests__/meta-agent.test.ts
  coastalos/vibevoice/server.py
  coastalos/vibevoice/requirements.txt
  coastalos/systemd/coastal-vibevoice.service
  coastalos/systemd/coastal-airllm.service
  coastalos/systemd/coastal-infinity.service

MODIFY:
  packages/core/src/models/router.ts          (add AirLLMClient to probe chain)
  packages/core/src/config.ts                 (add airllmUrl, infinityUrl, vibeVoiceUrl)
  packages/core/src/memory/unified.ts         (add InfinityClient, semanticSearch())
  packages/daemon/src/voice/pipeline.ts       (VibeVoiceClient swap, CPU fallback)
  coastalos/build/hooks/post-install.sh       (VibeVoice + AirLLM + Infinity install)
  coastalos/build/packages.list               (add python3-venv, rust toolchain for Infinity)
  coastalos/systemd/coastal-server.service    (add INFINITY_URL, VIBEVOICE_URL env)
```

---

## 7. Testing Strategy

All new clients follow the established pattern:
- Mock `fetch` / stub globals for unit tests (no live service required)
- `MOCK_*` env vars for integration boundaries (same as `MOCK_NAMESPACE`)
- Real service tests tagged in separate `*-integration.test.ts` files, skipped without service

```bash
# Unit tests (always pass, no services needed)
pnpm test

# With real services (Infinity + VibeVoice running)
INFINITY_URL=http://localhost:23817 VIBEVOICE_URL=http://localhost:8001 pnpm test
```

---

## External Repos — Integration Summary

| Repo | License | Stars | Role in Phase 4 |
|------|---------|-------|-----------------|
| microsoft/VibeVoice | MIT | — (new) | ASR + TTS, replaces whisper-cpp + piper on GPU |
| lyogavin/airllm | Apache 2.0 | 15K | 3rd inference backend, big models on small VRAM |
| infiniflow/infinity | Apache 2.0 | 4.5K | Hybrid vector search, RAG layer in UnifiedMemory |
| facebookresearch/HyperAgents | CC BY-NC-SA | 2K | Architecture reference only — no code import |
| danveloper/flash-moe | Unknown | 3K | Skipped — Apple Silicon only |
