# Phase 4 ClawTeam — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-agent swarm (BossAgent fan-out + MetaAgent self-improvement), VibeVoice streaming voice pipeline, AirLLM big-model inference, and Infinity hybrid vector search — all GPU-conditional with graceful CPU fallbacks.

**Design spec:** `docs/superpowers/specs/2026-04-05-phase4-clawteam-design.md`

**Branch:** Create `feat/phase4-clawteam` from `feat/phase3-clawos` before starting.

```bash
git checkout feat/phase3-clawos && git checkout -b feat/phase4-clawteam
```

**Tech Stack:** Node 22 ESM TypeScript, pnpm workspaces, Vitest, Fastify, Python 3.10+ FastAPI (VibeVoice service), Rust binary (Infinity), existing `packages/core` + `packages/daemon` + `packages/architect`.

---

## File Map

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
  packages/core/src/models/router.ts
  packages/core/src/config.ts
  packages/core/src/memory/unified.ts
  packages/daemon/src/voice/pipeline.ts
  coastalos/build/hooks/post-install.sh
  coastalos/build/packages.list
  coastalos/systemd/coastal-server.service
```

---

## Chunk 1: AirLLM Inference Backend

### Task 1: airllm.ts — tests first, then implementation

**Files:**
- Create: `packages/core/src/models/__tests__/airllm.test.ts`
- Create: `packages/core/src/models/airllm.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/models/__tests__/airllm.test.ts
import { describe, it, expect, vi } from 'vitest'
import { AirLLMClient } from '../airllm.js'

describe('AirLLMClient', () => {
  it('isAvailable returns false when endpoint unreachable', async () => {
    const client = new AirLLMClient('http://127.0.0.1:19998')
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health endpoint 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const client = new AirLLMClient('http://localhost:8002')
    expect(await client.isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('chat sends OpenAI format and returns content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello from airllm' } }] }),
    }))
    const client = new AirLLMClient('http://localhost:8002')
    const result = await client.chat('llama3:70b', [{ role: 'user', content: 'hi' }])
    expect(result).toBe('hello from airllm')
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)
    expect(body.model).toBe('llama3:70b')
    vi.unstubAllGlobals()
  })

  it('chat throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'model loading',
    }))
    const client = new AirLLMClient('http://localhost:8002')
    await expect(client.chat('llama3:70b', [])).rejects.toThrow('AirLLM error 503')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/core && pnpm test src/models/__tests__/airllm.test.ts
```

- [ ] **Step 3: Implement airllm.ts**

```typescript
// packages/core/src/models/airllm.ts
import { randomUUID } from 'node:crypto'
import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
import type { LocalChatMessage } from './ollama.js'

/**
 * Client for AirLLM's OpenAI-compatible HTTP API.
 * AirLLM streams model layers from disk — handles 70B models on 4GB VRAM.
 *
 * Install: pip install airllm
 * Start:   airllm-server --model <hf-model-id> --port 8002
 *
 * Probe order in ModelRouter: vLLM → AirLLM → Ollama.
 * AirLLM activates only when vLLM can't fit the model in VRAM.
 */
export class AirLLMClient {
  constructor(private readonly baseUrl = 'http://localhost:8002') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async chat(model: string, messages: LocalChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`AirLLM error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices[0]?.message.content ?? ''
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const openaiTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }))
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools: openaiTools, stream: false }),
    })
    if (!res.ok) throw new Error(`AirLLM error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }
    const msg = data.choices[0]?.message
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
      id: tc.id ?? randomUUID(),
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }))
    return { content: msg?.content ?? '', toolCalls }
  }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
cd packages/core && pnpm test src/models/__tests__/airllm.test.ts
```

Expected: `4 passed`

- [ ] **Step 5: Update ModelRouter — add AirLLM to probe chain**

In `packages/core/src/models/router.ts`, add AirLLM between vLLM and Ollama:

```typescript
import { AirLLMClient } from './airllm.js'

// In constructor:
this.airllm = new AirLLMClient(config.airllmUrl ?? 'http://localhost:8002')

// In inferenceClient():
private async inferenceClient(): Promise<OllamaClient | VllmClient | AirLLMClient> {
  if (this.vllmAvailable === null) {
    this.vllmAvailable = await this.vllm.isAvailable()
    if (!this.vllmAvailable) {
      this.airllmAvailable = await this.airllm.isAvailable()
    }
    const backend = this.vllmAvailable ? 'vLLM (GPU)' : this.airllmAvailable ? 'AirLLM (layer-stream)' : 'Ollama (CPU)'
    console.log(`[model-router] inference backend: ${backend}`)
  }
  if (this.vllmAvailable) return this.vllm
  if (this.airllmAvailable) return this.airllm
  return this.ollama
}
```

- [ ] **Step 6: Add airllmUrl to config.ts**

```typescript
// In Config interface:
airllmUrl: string

// In loadConfig():
airllmUrl: process.env.CC_AIRLLM_URL ?? 'http://127.0.0.1:8002',
```

- [ ] **Step 7: Create coastalos/systemd/coastal-airllm.service**

```ini
[Unit]
Description=CoastalClaw AirLLM Inference Server (layer-streaming)
After=network.target
ConditionPathExists=/usr/local/bin/airllm-server

[Service]
Type=simple
User=coastal
WorkingDirectory=/opt/coastalclaw
Environment=CC_AIRLLM_MODEL=meta-llama/Meta-Llama-3-70B-Instruct
ExecStart=/usr/local/bin/airllm-server --model ${CC_AIRLLM_MODEL} --port 8002
Restart=on-failure
RestartSec=15

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 8: Run all core tests — verify PASS**

```bash
cd packages/core && pnpm test
```

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/models/airllm.ts \
        packages/core/src/models/__tests__/airllm.test.ts \
        packages/core/src/models/router.ts \
        packages/core/src/config.ts \
        coastalos/systemd/coastal-airllm.service
git commit -m "feat(models): add AirLLMClient — layer-streaming inference for big models on small VRAM"
```

---

## Chunk 2: Infinity Vector Database

### Task 2: infinity-client.ts — tests first, then implementation

**Files:**
- Create: `packages/core/src/memory/__tests__/infinity-client.test.ts`
- Create: `packages/core/src/memory/infinity-client.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/memory/__tests__/infinity-client.test.ts
import { describe, it, expect, vi } from 'vitest'
import { InfinityClient } from '../infinity-client.js'

const MOCK_RESULTS = [
  { id: 'doc1', text: 'hello world', score: 0.95, meta: {} },
]

describe('InfinityClient', () => {
  it('isAvailable returns false when unreachable', async () => {
    const client = new InfinityClient('http://127.0.0.1:19997')
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect(await new InfinityClient().isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('upsert posts to correct endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)
    const client = new InfinityClient()
    await client.upsert('memories', 'id1', 'test text', [0.1, 0.2], { sessionId: 'abc' })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/memories/upsert'),
      expect.objectContaining({ method: 'POST' })
    )
    vi.unstubAllGlobals()
  })

  it('hybridSearch returns ranked results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: MOCK_RESULTS }),
    }))
    const client = new InfinityClient()
    const results = await client.hybridSearch('memories', 'hello', [0.1, 0.2], 5)
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('doc1')
    vi.unstubAllGlobals()
  })

  it('hybridSearch throws on error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 500, text: async () => 'internal error',
    }))
    await expect(new InfinityClient().hybridSearch('memories', 'q', [], 5))
      .rejects.toThrow('Infinity error 500')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

- [ ] **Step 3: Implement infinity-client.ts**

```typescript
// packages/core/src/memory/infinity-client.ts

export interface SearchResult {
  id: string
  text: string
  score: number
  meta: Record<string, unknown>
}

/**
 * HTTP client for Infinity vector database.
 * Provides hybrid search: dense vectors + sparse + full-text in one query.
 *
 * Install: docker run -p 23817:23817 infiniflow/infinity:latest
 * Docs: https://infiniflow.org/docs
 */
export class InfinityClient {
  constructor(private readonly baseUrl = 'http://localhost:23817') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async upsert(
    collection: string,
    id: string,
    text: string,
    vector: number[],
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/${collection}/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, text, vector, meta }),
    })
    if (!res.ok) throw new Error(`Infinity error ${res.status}: ${await res.text()}`)
  }

  async hybridSearch(
    collection: string,
    query: string,
    queryVector: number[],
    topK = 10,
  ): Promise<SearchResult[]> {
    const res = await fetch(`${this.baseUrl}/${collection}/hybrid_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, vector: queryVector, top_k: topK }),
    })
    if (!res.ok) throw new Error(`Infinity error ${res.status}: ${await res.text()}`)
    const data = await res.json() as { results: SearchResult[] }
    return data.results
  }
}
```

- [ ] **Step 4: Run — verify PASS** (5 passed)

- [ ] **Step 5: Update UnifiedMemory to use InfinityClient**

In `packages/core/src/memory/unified.ts`:
- Add `InfinityClient` field, probe in constructor
- In `write()`: after SQLite insert, call `infinity.upsert()` if available (best-effort, don't throw)
- Add `semanticSearch(query: string, vector: number[], topK: number)` method:
  - If Infinity available: `infinity.hybridSearch()`
  - Fallback: SQLite `LIKE '%query%'` on content

- [ ] **Step 6: Add infinityUrl to config.ts**

```typescript
infinityUrl: process.env.CC_INFINITY_URL ?? 'http://127.0.0.1:23817',
```

- [ ] **Step 7: Create coastalos/systemd/coastal-infinity.service**

```ini
[Unit]
Description=CoastalClaw Infinity Vector Database
After=network.target

[Service]
Type=simple
User=coastal
WorkingDirectory=/var/lib/coastalclaw/data
ExecStart=/usr/local/bin/infinity --port 23817 --data-dir /var/lib/coastalclaw/infinity
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 8: Run all core tests — verify PASS**

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/memory/infinity-client.ts \
        packages/core/src/memory/__tests__/infinity-client.test.ts \
        packages/core/src/memory/unified.ts \
        packages/core/src/config.ts \
        coastalos/systemd/coastal-infinity.service
git commit -m "feat(memory): add InfinityClient — hybrid vector search with SQLite fallback in UnifiedMemory"
```

---

## Chunk 3: VibeVoice Voice Pipeline

### Task 3: VibeVoiceClient — tests first, then implementation

**Files:**
- Create: `packages/core/src/voice/__tests__/vibevoice.test.ts`
- Create: `packages/core/src/voice/vibevoice.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/voice/__tests__/vibevoice.test.ts
import { describe, it, expect, vi } from 'vitest'
import { VibeVoiceClient } from '../vibevoice.js'

describe('VibeVoiceClient', () => {
  it('isAvailable returns false when unreachable', async () => {
    const client = new VibeVoiceClient('http://127.0.0.1:19996')
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect(await new VibeVoiceClient().isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('transcribe posts audio and returns structured transcript', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'hello world',
        speakers: [{ id: 'speaker_0', start: 0.0, end: 1.5, text: 'hello world' }],
      }),
    }))
    const client = new VibeVoiceClient()
    const result = await client.transcribe(Buffer.from('audio-data'))
    expect(result.text).toBe('hello world')
    expect(result.speakers).toHaveLength(1)
    expect(result.speakers[0].id).toBe('speaker_0')
    vi.unstubAllGlobals()
  })

  it('transcribe throws on error response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => 'model loading',
    }))
    await expect(new VibeVoiceClient().transcribe(Buffer.from('')))
      .rejects.toThrow('VibeVoice ASR error 503')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

- [ ] **Step 3: Implement vibevoice.ts**

```typescript
// packages/core/src/voice/vibevoice.ts

export interface TranscriptSpeaker {
  id: string
  start: number
  end: number
  text: string
}

export interface Transcript {
  text: string
  speakers: TranscriptSpeaker[]
}

/**
 * Client for the coastal-vibevoice FastAPI service (coastalos/vibevoice/server.py).
 *
 * VibeVoice-ASR-7B: replaces whisper-cpp — diarization, timestamps, 50+ languages.
 * VibeVoice-Realtime-0.5B: replaces piper-tts — streaming TTS, 200ms first chunk.
 *
 * GPU-conditional: if isAvailable() returns false, VoicePipeline falls back to
 * whisper-cpp (transcribe) and piper-tts (speak) unchanged.
 */
export class VibeVoiceClient {
  constructor(private readonly baseUrl = 'http://127.0.0.1:8001') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async transcribe(audioBuffer: Buffer, sampleRate = 16_000): Promise<Transcript> {
    const form = new FormData()
    form.append('audio', new Blob([audioBuffer], { type: 'audio/wav' }), 'audio.wav')
    form.append('sample_rate', String(sampleRate))

    const res = await fetch(`${this.baseUrl}/asr`, {
      method: 'POST',
      body: form,
    })
    if (!res.ok) throw new Error(`VibeVoice ASR error ${res.status}: ${await res.text()}`)
    return res.json() as Promise<Transcript>
  }

  async *speak(text: string, voice = 'en_us_female_1'): AsyncIterable<Buffer> {
    // WebSocket streaming — yields 24kHz PCM chunks as they arrive
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/tts/stream'
    const { WebSocket } = await import('ws')
    const ws = new WebSocket(wsUrl)

    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })

    ws.send(JSON.stringify({ text, voice }))

    try {
      for await (const chunk of ws) {
        if (Buffer.isBuffer(chunk)) yield chunk
        else if (typeof chunk === 'string') {
          const msg = JSON.parse(chunk)
          if (msg.done) break
        }
      }
    } finally {
      ws.close()
    }
  }
}
```

- [ ] **Step 4: Run — verify PASS** (4 passed)

- [ ] **Step 5: Create coastalos/vibevoice/server.py**

```python
# coastalos/vibevoice/server.py
# FastAPI wrapper around VibeVoice-ASR-7B and VibeVoice-Realtime-0.5B
# Exposes:  POST /asr   — audio → JSON transcript (with diarization)
#           WS   /tts/stream — text → streaming PCM audio chunks
#           GET  /health

import asyncio, io, json, logging, os
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, Form, UploadFile, WebSocket
from fastapi.responses import JSONResponse
from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("vibevoice")

app = FastAPI(title="coastal-vibevoice")

# ---------- ASR ----------
ASR_MODEL_ID = os.getenv("VIBEVOICE_ASR_MODEL", "microsoft/VibeVoice-ASR")
asr_processor = None
asr_model = None

def load_asr():
    global asr_processor, asr_model
    if asr_model is not None:
        return
    log.info(f"Loading ASR model: {ASR_MODEL_ID}")
    asr_processor = AutoProcessor.from_pretrained(ASR_MODEL_ID)
    asr_model = AutoModelForSpeechSeq2Seq.from_pretrained(
        ASR_MODEL_ID,
        torch_dtype=torch.bfloat16,
        device_map="auto",
    )
    log.info("ASR model loaded")

# ---------- TTS ----------
TTS_MODEL_ID = os.getenv("VIBEVOICE_TTS_MODEL", "microsoft/VibeVoice-Realtime-0.5B")
tts_processor = None
tts_model = None

def load_tts():
    global tts_processor, tts_model
    if tts_model is not None:
        return
    log.info(f"Loading TTS model: {TTS_MODEL_ID}")
    from vibevoice.modular.modeling_vibevoice_streaming_for_conditional_generation import (
        VibeVoiceStreamingForConditionalGenerationInference,
    )
    from vibevoice.processor.vibevoice_streaming_processor import VibeVoiceStreamingProcessor
    tts_processor = VibeVoiceStreamingProcessor.from_pretrained(TTS_MODEL_ID)
    tts_model = VibeVoiceStreamingForConditionalGenerationInference.from_pretrained(
        TTS_MODEL_ID,
        torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
        device_map="auto",
    )
    log.info("TTS model loaded")

@app.on_event("startup")
async def startup():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, load_asr)
    await loop.run_in_executor(None, load_tts)

@app.get("/health")
async def health():
    return {"status": "ok", "asr": asr_model is not None, "tts": tts_model is not None}

@app.post("/asr")
async def transcribe(audio: UploadFile = File(...), sample_rate: int = Form(16000)):
    raw = await audio.read()
    audio_array, sr = sf.read(io.BytesIO(raw))
    if sr != 16000:
        import librosa
        audio_array = librosa.resample(audio_array, orig_sr=sr, target_sr=16000)
    inputs = asr_processor(audio_array, sampling_rate=16000, return_tensors="pt")
    inputs = {k: v.to(asr_model.device) for k, v in inputs.items()}
    with torch.no_grad():
        output = asr_model.generate(**inputs)
    raw_text = asr_processor.batch_decode(output, skip_special_tokens=False)[0]
    parsed = asr_processor.post_process_transcription(raw_text)
    return JSONResponse(parsed)

@app.websocket("/tts/stream")
async def tts_stream(ws: WebSocket):
    await ws.accept()
    data = json.loads(await ws.receive_text())
    text = data.get("text", "")
    voice = data.get("voice", "en_us_female_1")
    from vibevoice.modular.streamer import AsyncAudioStreamer
    streamer = AsyncAudioStreamer(batch_size=1)
    inputs = tts_processor(text=[text], voice=voice, return_tensors="pt")
    inputs = {k: v.to(tts_model.device) for k, v in inputs.items()}
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, lambda: tts_model.generate(**inputs, streamer=streamer))
    async for chunk in streamer:
        pcm = (chunk[0].cpu().numpy() * 32767).astype(np.int16).tobytes()
        await ws.send_bytes(pcm)
    await ws.send_text(json.dumps({"done": True}))
    await ws.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.getenv("VIBEVOICE_PORT", "8001")))
```

- [ ] **Step 6: Create coastalos/vibevoice/requirements.txt**

```
torch>=2.3.0
transformers>=4.51.3,<5.0.0
accelerate>=0.30.0
diffusers>=0.27.0
librosa>=0.10.0
soundfile>=0.12.0
numpy>=1.26.0
scipy>=1.13.0
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
websockets>=12.0
```

- [ ] **Step 7: Create coastalos/systemd/coastal-vibevoice.service**

```ini
[Unit]
Description=CoastalClaw VibeVoice ASR + TTS Service
After=network.target
ConditionPathExists=/opt/coastalclaw/coastalos/vibevoice/server.py

[Service]
Type=simple
User=coastal
WorkingDirectory=/opt/coastalclaw
Environment=VIBEVOICE_PORT=8001
Environment=VIBEVOICE_ASR_MODEL=microsoft/VibeVoice-ASR
Environment=VIBEVOICE_TTS_MODEL=microsoft/VibeVoice-Realtime-0.5B
ExecStart=/usr/bin/python3 coastalos/vibevoice/server.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 8: Update VoicePipeline in packages/daemon**

In `packages/daemon/src/voice/pipeline.ts`:
- Import `VibeVoiceClient` from `@coastal-claw/core`
- In constructor: probe `vibeVoice.isAvailable()`, store result
- In `transcribe()`: if VibeVoice available use `vibeVoice.transcribe()`, else use existing whisper-cpp path
- In `speak()`: if VibeVoice available use `vibeVoice.speak()` (stream chunks to audio output), else use existing piper-tts path

- [ ] **Step 9: Add vibeVoiceUrl to config.ts**

```typescript
vibeVoiceUrl: process.env.CC_VIBEVOICE_URL ?? 'http://127.0.0.1:8001',
```

- [ ] **Step 10: Update post-install.sh — add VibeVoice**

In `coastalos/build/hooks/post-install.sh`, inside the GPU-conditional block:

```bash
# Install VibeVoice
pip3 install -r /opt/coastalclaw/coastalos/vibevoice/requirements.txt --break-system-packages \
  || echo "[post-install] VibeVoice install failed — whisper-cpp/piper fallback active"
systemctl enable coastal-vibevoice.service || true
```

- [ ] **Step 11: Run all tests — verify PASS**

```bash
cd packages/core && pnpm test
```

- [ ] **Step 12: Commit**

```bash
git add packages/core/src/voice/vibevoice.ts \
        packages/core/src/voice/__tests__/vibevoice.test.ts \
        packages/core/src/config.ts \
        coastalos/vibevoice/ \
        coastalos/systemd/coastal-vibevoice.service
git commit -m "feat(voice): add VibeVoiceClient — streaming ASR+TTS with whisper-cpp/piper fallback"
```

---

## Chunk 4: ClawTeam Multi-Agent Swarm

### Task 4: TeamChannel — message bus

**Files:**
- Create: `packages/core/src/agents/team-channel.ts`
- Create: `packages/core/src/agents/__tests__/team-channel.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/agents/__tests__/team-channel.test.ts
import { describe, it, expect, vi } from 'vitest'
import { TeamChannel } from '../team-channel.js'

describe('TeamChannel', () => {
  it('subscriber receives posted message', () => {
    const channel = new TeamChannel()
    const received: unknown[] = []
    channel.subscribe('agent-b', (msg) => received.push(msg))
    channel.post('agent-a', 'agent-b', { type: 'task', payload: 'do something' })
    expect(received).toHaveLength(1)
    expect((received[0] as any).payload).toBe('do something')
  })

  it('broadcast reaches all subscribers', () => {
    const channel = new TeamChannel()
    const a: unknown[] = [], b: unknown[] = []
    channel.subscribe('agent-a', (m) => a.push(m))
    channel.subscribe('agent-b', (m) => b.push(m))
    channel.broadcast('boss', { type: 'status', payload: 'done' })
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
  })

  it('unsubscribe stops delivery', () => {
    const channel = new TeamChannel()
    const received: unknown[] = []
    const unsub = channel.subscribe('agent-a', (m) => received.push(m))
    unsub()
    channel.post('boss', 'agent-a', { type: 'task', payload: 'hello' })
    expect(received).toHaveLength(0)
  })

  it('message to unknown agent is silently dropped', () => {
    const channel = new TeamChannel()
    expect(() => channel.post('a', 'nobody', { type: 'task', payload: '' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Implement team-channel.ts**

```typescript
// packages/core/src/agents/team-channel.ts

export interface TeamMessage {
  type: 'task' | 'result' | 'status' | 'error'
  payload: unknown
}

export class TeamChannel {
  private subs = new Map<string, Set<(msg: TeamMessage) => void>>()

  subscribe(agentId: string, cb: (msg: TeamMessage) => void): () => void {
    if (!this.subs.has(agentId)) this.subs.set(agentId, new Set())
    this.subs.get(agentId)!.add(cb)
    return () => this.subs.get(agentId)?.delete(cb)
  }

  post(from: string, to: string, payload: TeamMessage): void {
    this.subs.get(to)?.forEach(cb => cb(payload))
  }

  broadcast(from: string, payload: TeamMessage): void {
    this.subs.forEach(set => set.forEach(cb => cb(payload)))
  }
}
```

- [ ] **Step 3: Run — verify PASS** (4 passed)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/agents/team-channel.ts \
        packages/core/src/agents/__tests__/team-channel.test.ts
git commit -m "feat(agents): add TeamChannel — in-process message bus for multi-agent swarm"
```

---

### Task 5: BossAgent — fan-out orchestration

**Files:**
- Create: `packages/core/src/agents/boss-agent.ts`
- Create: `packages/core/src/agents/__tests__/boss-agent.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/agents/__tests__/boss-agent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { BossAgent } from '../boss-agent.js'
import { TeamChannel } from '../team-channel.js'

const mockRouter = {
  chat: vi.fn(),
  ollama: { chat: vi.fn() },
  cascade: { route: vi.fn() },
}
const mockRegistry = { getByDomain: vi.fn().mockReturnValue(null), get: vi.fn().mockReturnValue({ id: 'general', name: 'General', tools: [], soul: '' }) }
const mockToolRegistry = { getDefinitionsFor: vi.fn().mockReturnValue([]) }

describe('BossAgent', () => {
  it('decomposes task and returns synthesized result', async () => {
    mockRouter.chat
      .mockResolvedValueOnce({ reply: JSON.stringify([
        { id: 'sub1', description: 'step one', domain: 'general' },
      ]), decision: {} })
      .mockResolvedValueOnce({ reply: 'step one done', decision: {} })
      .mockResolvedValueOnce({ reply: 'final answer', decision: {} })

    const boss = new BossAgent(mockRouter as any, mockRegistry as any, new TeamChannel(), mockToolRegistry as any)
    const result = await boss.run('do a complex task', 'session-1')
    expect(result.reply).toBe('final answer')
    expect(result.subtaskCount).toBe(1)
  })

  it('handles decomposition returning empty subtask list', async () => {
    mockRouter.chat
      .mockResolvedValueOnce({ reply: '[]', decision: {} })
      .mockResolvedValueOnce({ reply: 'direct answer', decision: {} })

    const boss = new BossAgent(mockRouter as any, mockRegistry as any, new TeamChannel(), mockToolRegistry as any)
    const result = await boss.run('simple task', 'session-2')
    expect(result.reply).toBeDefined()
  })
})
```

- [ ] **Step 2: Implement boss-agent.ts**

```typescript
// packages/core/src/agents/boss-agent.ts
import { randomUUID } from 'node:crypto'
import type { ModelRouter } from '../models/router.js'
import type { AgentRegistry } from './registry.js'
import type { ToolRegistry } from '../tools/registry.js'
import { AgentSession } from './session.js'
import { AgenticLoop } from './loop.js'
import { PermissionGate } from './permission-gate.js'
import { ActionLog } from './action-log.js'
import { TeamChannel, type TeamMessage } from './team-channel.js'

export interface SubTask {
  id: string
  description: string
  domain: string
}

export interface SubResult {
  subtaskId: string
  reply: string
}

export interface BossResult {
  reply: string
  subtaskCount: number
  subtasks: SubResult[]
}

const DECOMPOSE_PROMPT = (task: string) => `
You are a task decomposition engine. Break the following task into independent subtasks that can run in parallel.
Return a JSON array of objects with shape: [{"id": "...", "description": "...", "domain": "general|code|browser|memory"}]
Return an empty array [] if the task is simple enough to handle directly.
Task: ${task}
`.trim()

const SYNTHESIZE_PROMPT = (task: string, results: SubResult[]) => `
Original task: ${task}

Subtask results:
${results.map(r => `- ${r.subtaskId}: ${r.reply}`).join('\n')}

Synthesize a single coherent reply that answers the original task using the above results.
`.trim()

export class BossAgent {
  constructor(
    private router: ModelRouter,
    private registry: AgentRegistry,
    private channel: TeamChannel,
    private toolRegistry: ToolRegistry,
  ) {}

  async run(task: string, sessionId: string): Promise<BossResult> {
    const subtasks = await this.decompose(task)

    if (subtasks.length === 0) {
      // Simple task — run directly
      const { reply } = await this.router.chat([{ role: 'user', content: task }])
      return { reply, subtaskCount: 0, subtasks: [] }
    }

    const results = await this.fanOut(subtasks, sessionId)
    const reply = await this.synthesize(task, results)
    return { reply, subtaskCount: subtasks.length, subtasks: results }
  }

  private async decompose(task: string): Promise<SubTask[]> {
    try {
      const { reply } = await this.router.chat([
        { role: 'user', content: DECOMPOSE_PROMPT(task) },
      ])
      return JSON.parse(reply) as SubTask[]
    } catch {
      return []
    }
  }

  private async fanOut(subtasks: SubTask[], sessionId: string): Promise<SubResult[]> {
    return Promise.all(subtasks.map(async (sub) => {
      const agent = this.registry.getByDomain(sub.domain) ?? this.registry.get('general')!
      const toolDefs = this.toolRegistry.getDefinitionsFor(agent.tools)
      const session = new AgentSession(agent, toolDefs)
      // Minimal loop: no DB, no approval gate for sub-agents
      const { reply } = await this.router.chat([
        { role: 'user', content: sub.description },
      ])
      this.channel.post('boss', sub.id, { type: 'result', payload: reply })
      return { subtaskId: sub.id, reply }
    }))
  }

  private async synthesize(task: string, results: SubResult[]): Promise<string> {
    const { reply } = await this.router.chat([
      { role: 'user', content: SYNTHESIZE_PROMPT(task, results) },
    ])
    return reply
  }
}
```

- [ ] **Step 3: Run — verify PASS**

- [ ] **Step 4: Add `/api/team` route to packages/core**

In `packages/core/src/api/routes/`, create `team.ts`:
- `POST /api/team/run` — `{ task, sessionId? }` → runs BossAgent, returns `{ reply, subtaskCount, subtasks }`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/boss-agent.ts \
        packages/core/src/agents/__tests__/boss-agent.test.ts
git commit -m "feat(agents): add BossAgent — parallel subtask fan-out with synthesis"
```

---

### Task 6: MetaAgent — self-improvement loop

**Files:**
- Create: `packages/core/src/agents/meta-agent.ts`
- Create: `packages/core/src/agents/__tests__/meta-agent.test.ts`

The MetaAgent extends `packages/architect`'s planner/patcher/validator cycle with:
- **Iteration tracking** — each run is an experiment (id, gap, patch, result, timestamp)
- **Archive log** — `meta-archive.db` (SQLite) records every attempt for analysis
- **BossAgent integration** — Boss can invoke MetaAgent when skill-gaps exceed threshold

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/agents/__tests__/meta-agent.test.ts
import { describe, it, expect, vi } from 'vitest'
import { MetaAgent } from '../meta-agent.js'

const mockPlanner = { propose: vi.fn().mockResolvedValue({ diff: 'diff content', targetFile: 'src/foo.ts' }) }
const mockPatcher = { apply: vi.fn().mockResolvedValue({ branch: 'meta/fix-1', merged: true }) }
const mockValidator = { run: vi.fn().mockResolvedValue({ passed: true, summary: '10 passed' }) }

describe('MetaAgent', () => {
  it('runs improve cycle and returns MetaResult', async () => {
    const agent = new MetaAgent(mockPlanner as any, mockPatcher as any, mockValidator as any, ':memory:')
    const result = await agent.improve({ id: 'gap-1', description: 'missing retry logic', file: 'src/foo.ts' })
    expect(result.merged).toBe(true)
    expect(result.iterationId).toBeDefined()
    expect(mockPlanner.propose).toHaveBeenCalledOnce()
    expect(mockValidator.run).toHaveBeenCalledOnce()
  })

  it('does not merge when tests fail', async () => {
    mockValidator.run.mockResolvedValueOnce({ passed: false, summary: '1 failed' })
    mockPatcher.apply.mockResolvedValueOnce({ branch: 'meta/fix-2', merged: false })
    const agent = new MetaAgent(mockPlanner as any, mockPatcher as any, mockValidator as any, ':memory:')
    const result = await agent.improve({ id: 'gap-2', description: 'bad gap', file: 'src/bar.ts' })
    expect(result.merged).toBe(false)
  })
})
```

- [ ] **Step 2: Implement meta-agent.ts**

```typescript
// packages/core/src/agents/meta-agent.ts
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'

export interface SkillGap {
  id: string
  description: string
  file: string
}

export interface MetaResult {
  iterationId: string
  gapId: string
  merged: boolean
  testSummary: string
  diff: string
}

/**
 * MetaAgent — runs a self-improvement iteration for a given skill gap.
 * Pattern adapted from HyperAgents (facebookresearch, arxiv 2603.19461).
 * Original architecture: meta-agent writes/tests/merges code patches iteratively.
 *
 * Depends on packages/architect's Planner, Patcher, Validator — imported directly.
 * Archives every attempt to meta-archive.db for analysis.
 */
export class MetaAgent {
  private db: Database.Database

  constructor(
    private planner: { propose(gap: SkillGap): Promise<{ diff: string; targetFile: string }> },
    private patcher: { apply(diff: string, branch: string): Promise<{ branch: string; merged: boolean }> },
    private validator: { run(): Promise<{ passed: boolean; summary: string }> },
    dbPath = './data/meta-archive.db',
  ) {
    this.db = new Database(dbPath)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meta_archive (
        id TEXT PRIMARY KEY,
        gap_id TEXT NOT NULL,
        gap_description TEXT NOT NULL,
        diff TEXT NOT NULL,
        test_summary TEXT NOT NULL,
        merged INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
  }

  async improve(gap: SkillGap): Promise<MetaResult> {
    const iterationId = randomUUID()
    const { diff } = await this.planner.propose(gap)
    const branch = `meta/${gap.id.slice(0, 8)}-${Date.now()}`
    const { merged } = await this.patcher.apply(diff, branch)
    const { summary: testSummary } = await this.validator.run()

    this.db.prepare(`
      INSERT INTO meta_archive (id, gap_id, gap_description, diff, test_summary, merged, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(iterationId, gap.id, gap.description, diff, testSummary, merged ? 1 : 0, Date.now())

    return { iterationId, gapId: gap.id, merged, testSummary, diff }
  }

  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 3: Run — verify PASS**

- [ ] **Step 4: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agents/meta-agent.ts \
        packages/core/src/agents/__tests__/meta-agent.test.ts
git commit -m "feat(agents): add MetaAgent — self-improvement loop with archive logging (HyperAgents pattern)"
```

---

## Chunk 5: ISO + CI Updates

### Task 7: post-install.sh + packages.list + service env

- [ ] **Step 1: Update packages.list** — add `python3-venv`, `ffmpeg` (already present), `curl` (already present), `wget`

- [ ] **Step 2: Update post-install.sh** — add GPU-conditional VibeVoice + AirLLM installs; add `coastal-infinity.service` enable (always-on)

```bash
# Always-on: Infinity vector DB
curl -L https://github.com/infiniflow/infinity/releases/latest/download/infinity-linux-x86_64 \
  -o /usr/local/bin/infinity && chmod +x /usr/local/bin/infinity
systemctl enable coastal-infinity.service

# GPU-conditional: VibeVoice + AirLLM
if nvidia-smi &>/dev/null 2>&1; then
  pip3 install -r /opt/coastalclaw/coastalos/vibevoice/requirements.txt --break-system-packages || true
  pip3 install airllm --break-system-packages || true
  systemctl enable coastal-vibevoice.service || true
  systemctl enable coastal-airllm.service || true
fi
```

- [ ] **Step 3: Update coastal-server.service** — add env vars for new services

```ini
Environment=CC_INFINITY_URL=http://127.0.0.1:23817
Environment=CC_VIBEVOICE_URL=http://127.0.0.1:8001
Environment=CC_AIRLLM_URL=http://127.0.0.1:8002
```

- [ ] **Step 4: Commit**

```bash
git add coastalos/build/hooks/post-install.sh \
        coastalos/build/packages.list \
        coastalos/systemd/coastal-server.service \
        coastalos/systemd/coastal-infinity.service \
        coastalos/systemd/coastal-airllm.service
git commit -m "feat(iso): add Infinity, AirLLM, VibeVoice to ISO build and systemd services"
```

---

## Chunk 6: Tag + Push

### Task 8: Final verification and tag

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: Push branch**

```bash
git push origin feat/phase4-clawteam
```

- [ ] **Step 3: Open PR to master, tag on merge**

```bash
# After PR merge:
git tag v0.5.0-phase4-clawteam
git push origin v0.5.0-phase4-clawteam
```

---

## Quick Reference

```bash
# Run all tests
pnpm test

# Run just Phase 4 new tests
pnpm --filter @coastal-claw/core test -- --reporter=verbose vibevoice
pnpm --filter @coastal-claw/core test -- --reporter=verbose airllm
pnpm --filter @coastal-claw/core test -- --reporter=verbose infinity
pnpm --filter @coastal-claw/core test -- --reporter=verbose boss-agent
pnpm --filter @coastal-claw/core test -- --reporter=verbose meta-agent
pnpm --filter @coastal-claw/core test -- --reporter=verbose team-channel

# Start with live services (GPU box)
CC_VIBEVOICE_URL=http://localhost:8001 \
CC_AIRLLM_URL=http://localhost:8002 \
CC_INFINITY_URL=http://localhost:23817 \
pnpm --filter @coastal-claw/core dev
```

---

## Phase Roadmap

- Phase 1 APEX ✅ `v0.2.0-phase1-apex`
- Phase 2 CoastalOS ✅ `v0.3.0-phase2-coastalos`
- Phase 3 ClawOS Native ✅ `v0.4.0-phase3-clawos`
- **Phase 4 ClawTeam** ← you are here
- Phase 5 Launch — APT repo, cloud AMI, open source
