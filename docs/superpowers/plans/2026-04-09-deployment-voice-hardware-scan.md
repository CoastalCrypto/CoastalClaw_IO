# Deployment, Voice Quality, and Hardware Scan Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix nine deployment/bootability bugs, fix TTS sample-rate mismatch causing rushed/garbled voice, and add hardware-scan model recommender to both install scripts and the admin panel.

**Architecture:** Three independent subsystems. Chunk 1 is pure config/script edits — no new code, no tests. Chunk 2 adds a metadata protocol to the VibeVoice WebSocket stream and updates all consumers. Chunk 3 adds a new `hardware-scan.ts` module, one new API endpoint, admin UI card, and install script changes.

**Tech Stack:** Bash, PowerShell, systemd unit files, Python 3 / FastAPI (vibevoice), Node 22 ESM TypeScript (Fastify core), React + Tailwind v4 (admin UI), Vitest.

**Spec:** `docs/superpowers/specs/2026-04-09-deployment-voice-hardware-scan-design.md`

---

## Chunk 1: Deployment Fixes

### Task 1: Fix cross-platform build script in `packages/core/package.json`

**Files:**
- Modify: `packages/core/package.json:9`

The `cp -r` command does not exist on Windows. The build fails with exit code 1 but install.ps1 previously hid this. Replace with a Node.js inline cpSync call that works on all platforms.

- [ ] **Step 1: Edit the build script**

In `packages/core/package.json`, change line 9 from:
```json
"build": "tsc && cp -r src/agents/souls dist/agents/souls",
```
to:
```json
"build": "tsc && node -e \"require('fs').cpSync('src/agents/souls','dist/agents/souls',{recursive:true})\"",
```

- [ ] **Step 2: Verify the build runs on the current platform**

Run: `cd packages/core && pnpm build`
Expected: exits 0 with no error; `dist/agents/souls` directory exists after build

- [ ] **Step 3: Commit**

```bash
git add packages/core/package.json
git commit -m "fix(core): replace cp -r with Node cpSync for cross-platform souls copy"
```

---

### Task 2: Fix systemd unit name in `coastal-web.service` and add env vars to `coastal-server.service`

**Files:**
- Modify: `coastalos/systemd/coastal-web.service:3-4`
- Modify: `coastalos/systemd/coastal-server.service` (append two lines)

Two separate bugs fixed together since both are single-line systemd edits.

- [ ] **Step 1: Fix the wrong unit name in `coastal-web.service`**

In `coastalos/systemd/coastal-web.service`, change lines 3–4:
```ini
After=coastalclaw-server.service
Wants=coastalclaw-server.service
```
to:
```ini
After=coastal-server.service
Wants=coastal-server.service
```

- [ ] **Step 2: Add missing env vars to `coastal-server.service`**

In `coastalos/systemd/coastal-server.service`, after the last `Environment=` line (currently `Environment=CC_VIBEVOICE_URL=http://127.0.0.1:8001`), add:
```ini
Environment=CC_OLLAMA_URL=http://127.0.0.1:11434
Environment=CC_DEFAULT_MODEL=llama3.2
```

- [ ] **Step 3: Commit**

```bash
git add coastalos/systemd/coastal-web.service coastalos/systemd/coastal-server.service
git commit -m "fix(coastalos): correct coastal-web unit dependency name and add Ollama env vars to coastal-server"
```

---

### Task 3: Fix `coastal-shell.service` XDG_RUNTIME_DIR + `post-install.sh` UID resolution, enable coastal-web, raise MemoryMax

**Files:**
- Modify: `coastalos/systemd/coastal-shell.service:11`
- Modify: `coastalos/build/hooks/post-install.sh` (lines 47, 66, 81)

`%U` in systemd expands to the username string, not the numeric UID. `XDG_RUNTIME_DIR=/run/user/coastal` does not exist at runtime — it must be `/run/user/1000` (or whatever UID `coastal` gets). The fix: ship a placeholder in the service file and have post-install.sh replace it after `useradd` using `id -u coastal`.

- [ ] **Step 1: Replace hardcoded UID in `coastal-shell.service` with placeholder**

In `coastalos/systemd/coastal-shell.service`, change line 11:
```ini
Environment=XDG_RUNTIME_DIR=/run/user/1000
```
to:
```ini
Environment=XDG_RUNTIME_DIR=/run/user/__COASTAL_UID__
```

- [ ] **Step 2: Add UID resolution to `post-install.sh` immediately after `useradd`**

In `coastalos/build/hooks/post-install.sh`, after line 47 (`useradd -m -s /bin/bash coastal || true`), insert:
```bash
COASTAL_UID=$(id -u coastal)
sed -i "s|XDG_RUNTIME_DIR=.*|XDG_RUNTIME_DIR=/run/user/${COASTAL_UID}|" \
  /etc/systemd/system/coastal-shell.service
systemctl daemon-reload
```

- [ ] **Step 3: Raise `MemoryMax` from 512M to 2G in `post-install.sh`**

In `post-install.sh`, inside the heredoc (line 66), change:
```bash
MemoryMax=512M
```
to:
```bash
MemoryMax=2G
```

- [ ] **Step 4: Enable `coastal-web.service` in `post-install.sh`**

In `post-install.sh`, after the `systemctl enable coastal-shell.service` line (line 81), add:
```bash
systemctl enable coastal-web.service
```

- [ ] **Step 5: Commit**

```bash
git add coastalos/systemd/coastal-shell.service coastalos/build/hooks/post-install.sh
git commit -m "fix(coastalos): resolve XDG_RUNTIME_DIR UID at install time, raise MemoryMax to 2G, enable coastal-web"
```

---

### Task 4: Fix labwc autostart URL + `install.ps1` env vars and exit-code checks

**Files:**
- Modify: `coastalos/labwc/autostart:43`
- Modify: `install.ps1:111,116,125`

`autostart` opens `http://localhost:4747` (raw API JSON). It should open the web portal at `5173`. `install.ps1` is missing two env vars in the generated `.env.local`, and `$ErrorActionPreference = 'Stop'` does not catch external process non-zero exit codes.

- [ ] **Step 1: Fix Chromium URL in `coastalos/labwc/autostart`**

In `coastalos/labwc/autostart`, change line 43:
```sh
  --app=http://localhost:4747 &
```
to:
```sh
  --app=http://localhost:5173 &
```

- [ ] **Step 2: Add missing env vars to `install.ps1` generated `.env.local`**

In `install.ps1`, change line 125:
```powershell
    Set-Content $CoreEnv "CC_PORT=4747`nCC_HOST=127.0.0.1`nCC_DATA_DIR=./data`nCC_OLLAMA_URL=http://127.0.0.1:11434`nCC_DEFAULT_MODEL=llama3.2"
```
to:
```powershell
    Set-Content $CoreEnv "CC_PORT=4747`nCC_HOST=127.0.0.1`nCC_DATA_DIR=./data`nCC_OLLAMA_URL=http://127.0.0.1:11434`nCC_DEFAULT_MODEL=llama3.2`nCC_VRAM_BUDGET_GB=24`nCC_ROUTER_CONFIDENCE=0.7"
```

- [ ] **Step 3: Add `$LASTEXITCODE` checks after `pnpm install` and `pnpm build` in `install.ps1`**

In `install.ps1`, after `pnpm install` (line 111), add:
```powershell
if ($LASTEXITCODE -ne 0) { Write-Fail "pnpm install failed (exit $LASTEXITCODE)" }
```

After `pnpm build` (line 116), add:
```powershell
if ($LASTEXITCODE -ne 0) { Write-Fail "pnpm build failed (exit $LASTEXITCODE)" }
```

- [ ] **Step 4: Commit**

```bash
git add coastalos/labwc/autostart install.ps1
git commit -m "fix(install): correct Chromium kiosk URL to port 5173, add missing env vars and exit-code checks to install.ps1"
```

---

## Chunk 2: Voice TTS Sample-Rate Fix

### Task 5: Fix `coastalos/vibevoice/server.py` — metadata frame + async race

**Files:**
- Modify: `coastalos/vibevoice/server.py`

Two bugs: (1) no sample-rate metadata emitted before PCM, causing `pcmToWav` to assume 24kHz for a 22.05kHz stream (91.9% playback speed = "rushed and garbled"). (2) `loop.run_in_executor(None, lambda: ...)` fires generation without awaiting, so the `async for chunk in streamer` loop may consume an empty streamer.

- [ ] **Step 1: Add `TTS_SAMPLE_RATE` constant and fix `tts_stream`**

In `coastalos/vibevoice/server.py`, add after the `TTS_MODEL_ID` line (line 40):
```python
TTS_SAMPLE_RATE = int(os.getenv("VIBEVOICE_SAMPLE_RATE", "22050"))
```

Replace the entire `tts_stream` function (lines 86–102) with:
```python
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
    asyncio.create_task(asyncio.to_thread(tts_model.generate, **inputs, streamer=streamer))
    await ws.send_text(json.dumps({"sample_rate": TTS_SAMPLE_RATE, "channels": 1}))
    async for chunk in streamer:
        pcm = (chunk[0].cpu().numpy() * 32767).astype(np.int16).tobytes()
        await ws.send_bytes(pcm)
    await ws.send_text(json.dumps({"done": True}))
    await ws.close()
```

- [ ] **Step 2: Commit**

```bash
git add coastalos/vibevoice/server.py
git commit -m "fix(vibevoice): send sample_rate metadata frame before PCM; fix async race with create_task"
```

---

### Task 6: Fix `packages/core/src/voice/vibevoice.ts` — sequential first-read + typed return

**Files:**
- Create: `packages/core/src/voice/__tests__/vibevoice.test.ts`
- Modify: `packages/core/src/voice/vibevoice.ts:49-95`

The `speak()` method yields raw `Buffer` with no sample-rate information. The consumer (`system.ts` admin TTS) hardcodes `24_000` in `pcmToWav`. After this change, `speak()` yields `{ pcm: Buffer; sampleRate: number }`.

The implementation uses a `metadataSeen` flag rather than `ws.once` to avoid a race: both the general `ws.on('message')` handler and the metadata-wait loop are registered before any messages can arrive, so no PCM is ever dropped.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/voice/__tests__/vibevoice.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'

describe('VibeVoiceClient.speak — sample rate protocol', () => {
  let wss: WebSocketServer

  afterEach(() => new Promise<void>(res => wss?.close(() => res())))

  function startServer(handler: (ws: WebSocket) => void): Promise<number> {
    return new Promise(resolve => {
      wss = new WebSocketServer({ port: 0 })
      wss.on('connection', handler)
      wss.once('listening', () => resolve((wss.address() as AddressInfo).port))
    })
  }

  it('yields { pcm, sampleRate: 22050 } when server sends metadata frame', async () => {
    const pcmData = Buffer.alloc(100, 0x42)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(JSON.stringify({ sample_rate: 22050, channels: 1 }))
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../vibevoice.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('hello')) results.push(chunk)

    expect(results).toHaveLength(1)
    expect(results[0].sampleRate).toBe(22050)
    expect(results[0].pcm).toEqual(pcmData)
  })

  it('falls back to sampleRate 24000 when server sends no metadata frame', async () => {
    const pcmData = Buffer.alloc(50, 0x01)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../vibevoice.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('hello')) results.push(chunk)

    expect(results[0].sampleRate).toBe(24_000)
    expect(results[0].pcm).toEqual(pcmData)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd packages/core && pnpm test -- --reporter=verbose src/voice/__tests__/vibevoice.test.ts`
Expected: FAIL — `VibeVoiceClient.speak` returns `Buffer` not `{ pcm, sampleRate }`

- [ ] **Step 3: Implement the new `speak()` method**

In `packages/core/src/voice/vibevoice.ts`, replace `speak()` (lines 49–95) with:
```typescript
async *speak(text: string, voice = 'en_us_female_1'): AsyncIterable<{ pcm: Buffer; sampleRate: number }> {
  const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/tts/stream'
  const { WebSocket } = await import('ws')
  const ws = new WebSocket(wsUrl)

  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })

  ws.send(JSON.stringify({ text, voice }))

  const chunks: Buffer[] = []
  let sampleRate = 24_000       // fallback for servers without metadata frame
  let metadataSeen = false
  let done = false
  let error: unknown = null
  let notify: (() => void) | null = null

  ws.on('message', (data: Buffer | string) => {
    if (Buffer.isBuffer(data)) {
      if (!metadataSeen) {
        // Old server — first message is raw PCM, no metadata frame
        metadataSeen = true
      }
      chunks.push(data)
    } else {
      try {
        const msg = JSON.parse(data.toString()) as { sample_rate?: number; done?: boolean }
        if (!metadataSeen && typeof msg.sample_rate === 'number') {
          sampleRate = msg.sample_rate
          metadataSeen = true
        } else if (msg.done) {
          done = true
        }
      } catch { /* ignore non-JSON */ }
    }
    notify?.()
  })

  ws.on('error', (err) => { error = err; done = true; notify?.() })
  ws.on('close', () => { done = true; notify?.() })

  // Wait for the metadata frame (or the first PCM chunk in backwards-compat mode)
  while (!metadataSeen && !done) {
    await new Promise<void>(resolve => { notify = resolve })
    notify = null
  }

  try {
    while (!done || chunks.length > 0) {
      if (chunks.length > 0) {
        yield { pcm: chunks.shift()!, sampleRate }
      } else if (!done) {
        await new Promise<void>(resolve => { notify = resolve })
        notify = null
      }
    }
    if (error) throw error
  } finally {
    ws.close()
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `cd packages/core && pnpm test -- --reporter=verbose src/voice/__tests__/vibevoice.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Run full core test suite — no regressions**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/voice/__tests__/vibevoice.test.ts packages/core/src/voice/vibevoice.ts
git commit -m "feat(core/voice): add sample-rate metadata protocol to VibeVoiceClient.speak"
```

---

### Task 7: Fix `packages/daemon/src/voice/vibevoice-client.ts` and `pipeline.ts`

**Files:**
- Create: `packages/daemon/src/__tests__/voice/vibevoice-client.test.ts`
- Modify: `packages/daemon/src/voice/vibevoice-client.ts:43-88`
- Modify: `packages/daemon/src/voice/pipeline.ts:139-144`

The daemon has its own copy of the VibeVoice client (to avoid importing the HTTP server). It needs the same metadata-frame change. `pipeline.ts` hardcodes `24_000` in `this.player.play(...)`.

- [ ] **Step 1: Write the failing test for the daemon client**

Create `packages/daemon/src/__tests__/voice/vibevoice-client.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'

describe('VibeVoiceClient (daemon) — sample rate protocol', () => {
  let wss: WebSocketServer

  afterEach(() => new Promise<void>(res => wss?.close(() => res())))

  function startServer(handler: (ws: WebSocket) => void): Promise<number> {
    return new Promise(resolve => {
      wss = new WebSocketServer({ port: 0 })
      wss.on('connection', handler)
      wss.once('listening', () => resolve((wss.address() as AddressInfo).port))
    })
  }

  it('yields { pcm, sampleRate: 22050 } when server sends metadata frame', async () => {
    const pcmData = Buffer.alloc(64, 0x10)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(JSON.stringify({ sample_rate: 22050, channels: 1 }))
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../../voice/vibevoice-client.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('test')) results.push(chunk)

    expect(results).toHaveLength(1)
    expect(results[0].sampleRate).toBe(22050)
    expect(results[0].pcm).toEqual(pcmData)
  })

  it('falls back to sampleRate 24000 when no metadata frame', async () => {
    const pcmData = Buffer.alloc(32, 0x20)
    const port = await startServer(ws => {
      ws.once('message', () => {
        ws.send(pcmData)
        ws.send(JSON.stringify({ done: true }))
      })
    })

    const { VibeVoiceClient } = await import('../../voice/vibevoice-client.js')
    const client = new VibeVoiceClient(`http://127.0.0.1:${port}`)
    const results: Array<{ pcm: Buffer; sampleRate: number }> = []
    for await (const chunk of client.speak('test')) results.push(chunk)

    expect(results[0].sampleRate).toBe(24_000)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd packages/daemon && pnpm test -- --reporter=verbose src/__tests__/voice/vibevoice-client.test.ts`
Expected: FAIL

- [ ] **Step 3: Apply identical metadata-frame change to `vibevoice-client.ts`**

In `packages/daemon/src/voice/vibevoice-client.ts`, replace `speak()` (lines 43–88) with the identical implementation as in Task 6 Step 3. The only diff from the core version is the `(err: unknown)` type annotation on the error handler — keep that intact:

```typescript
async *speak(text: string, voice = 'en_us_female_1'): AsyncIterable<{ pcm: Buffer; sampleRate: number }> {
  const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/tts/stream'
  const { WebSocket } = await import('ws')
  const ws = new WebSocket(wsUrl)

  await new Promise<void>((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })

  ws.send(JSON.stringify({ text, voice }))

  const chunks: Buffer[] = []
  let sampleRate = 24_000
  let metadataSeen = false
  let done = false
  let error: unknown = null
  let notify: (() => void) | null = null

  ws.on('message', (data: Buffer | string) => {
    if (Buffer.isBuffer(data)) {
      if (!metadataSeen) metadataSeen = true
      chunks.push(data)
    } else {
      try {
        const msg = JSON.parse(data.toString()) as { sample_rate?: number; done?: boolean }
        if (!metadataSeen && typeof msg.sample_rate === 'number') {
          sampleRate = msg.sample_rate
          metadataSeen = true
        } else if (msg.done) {
          done = true
        }
      } catch { /* ignore non-JSON */ }
    }
    notify?.()
  })

  ws.on('error', (err: unknown) => { error = err; done = true; notify?.() })
  ws.on('close', () => { done = true; notify?.() })

  while (!metadataSeen && !done) {
    await new Promise<void>(resolve => { notify = resolve })
    notify = null
  }

  try {
    while (!done || chunks.length > 0) {
      if (chunks.length > 0) {
        yield { pcm: chunks.shift()!, sampleRate }
      } else if (!done) {
        await new Promise<void>(resolve => { notify = resolve })
        notify = null
      }
    }
    if (error) throw error
  } finally {
    ws.close()
  }
}
```

- [ ] **Step 4: Fix `pipeline.ts` to use sampleRate from the stream**

In `packages/daemon/src/voice/pipeline.ts`, replace lines 139–144:
```typescript
      const chunks: Buffer[] = []
      for await (const chunk of this.vibeVoice.speak(reply)) {
        chunks.push(chunk)
      }
      await this.player.play(Buffer.concat(chunks), 24_000)
```
with:
```typescript
      const chunks: Buffer[] = []
      let resolvedSampleRate = 24_000
      for await (const { pcm, sampleRate } of this.vibeVoice.speak(reply)) {
        chunks.push(pcm)
        resolvedSampleRate = sampleRate
      }
      await this.player.play(Buffer.concat(chunks), resolvedSampleRate)
```

- [ ] **Step 5: Run daemon test — expect PASS**

Run: `cd packages/daemon && pnpm test -- --reporter=verbose src/__tests__/voice/vibevoice-client.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run full daemon test suite — no regressions**

Run: `cd packages/daemon && pnpm test`
Expected: All tests pass (including existing pipeline.test.ts)

- [ ] **Step 7: Commit**

```bash
git add packages/daemon/src/__tests__/voice/vibevoice-client.test.ts \
        packages/daemon/src/voice/vibevoice-client.ts \
        packages/daemon/src/voice/pipeline.ts
git commit -m "feat(daemon/voice): add sample-rate metadata protocol to daemon VibeVoiceClient; use dynamic sampleRate in pipeline"
```

---

### Task 8: Fix `system.ts` admin TTS endpoint — use actual sampleRate

**Files:**
- Modify: `packages/core/src/api/routes/system.ts:175-187`

The `POST /api/admin/tts` endpoint collects chunks from `vibe.speak()` then calls `pcmToWav(Buffer.concat(chunks))` without passing a sample rate — it defaults to 24000. After Task 6, `speak()` yields `{ pcm, sampleRate }` objects.

- [ ] **Step 1: Update the admin TTS endpoint**

In `packages/core/src/api/routes/system.ts`, replace lines 175–187:
```typescript
  // POST /api/admin/tts — synthesise speech via VibeVoice, return WAV
  fastify.post<{ Body: { text: string; voice: string } }>('/api/admin/tts', async (req, reply) => {
    const { text, voice } = req.body ?? {}
    if (!text || !voice) return reply.status(400).send({ error: 'text and voice required' })
    const vibe = new VibeVoiceClient()
    const chunks: Buffer[] = []
    for await (const chunk of vibe.speak(text, voice)) {
      chunks.push(chunk)
    }
    const wav = pcmToWav(Buffer.concat(chunks))
    reply.header('Content-Type', 'audio/wav')
    return reply.send(wav)
  })
```
with:
```typescript
  // POST /api/admin/tts — synthesise speech via VibeVoice, return WAV
  fastify.post<{ Body: { text: string; voice: string } }>('/api/admin/tts', async (req, reply) => {
    const { text, voice } = req.body ?? {}
    if (!text || !voice) return reply.status(400).send({ error: 'text and voice required' })
    const vibe = new VibeVoiceClient()
    const chunks: Buffer[] = []
    let sampleRate = 24_000
    for await (const { pcm, sampleRate: sr } of vibe.speak(text, voice)) {
      chunks.push(pcm)
      sampleRate = sr
    }
    const wav = pcmToWav(Buffer.concat(chunks), sampleRate)
    reply.header('Content-Type', 'audio/wav')
    return reply.send(wav)
  })
```

- [ ] **Step 2: Run core tests — no regressions**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/api/routes/system.ts
git commit -m "fix(core/api): pass actual sampleRate from VibeVoice stream to pcmToWav in admin TTS endpoint"
```

---

## Chunk 3: Hardware Scan + Model Recommender

### Task 9: Create `packages/core/src/models/hardware-scan.ts` + unit tests

**Files:**
- Create: `packages/core/src/models/__tests__/hardware-scan.test.ts`
- Create: `packages/core/src/models/hardware-scan.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/models/__tests__/hardware-scan.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('scanHardware', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.restoreAllMocks())

  it('reads RAM and GPU from Linux /proc/meminfo + nvidia-smi', async () => {
    const procMeminfo = [
      'MemTotal:       33554432 kB',
      'MemFree:         4194304 kB',
      'Buffers:          524288 kB',
      'Cached:          2097152 kB',
      'SReclaimable:     262144 kB',
    ].join('\n')
    vi.doMock('node:fs', () => ({
      readFileSync: (p: string) => {
        if (p === '/proc/meminfo') return procMeminfo
        throw new Error('ENOENT')
      },
      existsSync: () => false,
    }))
    vi.doMock('node:child_process', () => ({
      execSync: (cmd: string) => {
        if (cmd.includes('nvidia-smi') && cmd.includes('memory.total')) return '8192\n'
        if (cmd.includes('nvidia-smi') && cmd.includes('name')) return 'NVIDIA RTX 3070, 8192, 7000, 45\n'
        if (cmd.includes('df -B1')) return '/dev/sda1  500G  50G  450G  10% /\n'
        throw new Error('not found')
      },
    }))
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const { scanHardware } = await import('../hardware-scan.js')
    const hw = scanHardware('/var/lib/coastalclaw/data')

    expect(hw.ramGb).toBeGreaterThan(30)
    expect(hw.vramGb).toBe(8)
    expect(hw.gpuName).toContain('RTX 3070')
    expect(hw.dataDir).toBe('/var/lib/coastalclaw/data')
  })

  it('returns null vramGb when nvidia-smi is absent', async () => {
    const procMeminfo = 'MemTotal: 8388608 kB\nMemFree: 4194304 kB\nBuffers: 0 kB\nCached: 0 kB\nSReclaimable: 0 kB\n'
    vi.doMock('node:fs', () => ({
      readFileSync: (p: string) => {
        if (p === '/proc/meminfo') return procMeminfo
        throw new Error('ENOENT')
      },
    }))
    vi.doMock('node:child_process', () => ({
      execSync: (cmd: string) => {
        if (cmd.includes('df -B1')) return '/dev/sda1  100G  20G  80G  20% /\n'
        throw new Error('command not found')
      },
    }))
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const { scanHardware } = await import('../hardware-scan.js')
    const hw = scanHardware('/data')

    expect(hw.vramGb).toBeNull()
    expect(hw.gpuName).toBeNull()
    expect(hw.ramGb).toBeGreaterThan(7)
  })
})

describe('recommendModels', () => {
  it('always returns exactly 3 entries with tiers minimum/recommended/optimal', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const hw = { ramGb: 16, freeRamGb: 8, cpuCores: 8, vramGb: null, gpuName: null, diskFreeGb: 100, dataDir: '/data' }
    const recs = recommendModels(hw)
    expect(recs).toHaveLength(3)
    expect(recs.map(r => r.tier)).toEqual(['minimum', 'recommended', 'optimal'])
  })

  it('minimum is always llama3.2:1b when RAM >= 4 GB', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 8, freeRamGb: 4, cpuCores: 4, vramGb: null, gpuName: null, diskFreeGb: 50, dataDir: '/data' })
    expect(recs[0].tier).toBe('minimum')
    expect(recs[0].model).toBe('llama3.2:1b')
  })

  it('minimum is tinyllama when RAM < 4 GB', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 3, freeRamGb: 1, cpuCores: 2, vramGb: null, gpuName: null, diskFreeGb: 20, dataDir: '/data' })
    expect(recs[0].model).toBe('tinyllama')
  })

  it('VRAM >= 12 GB: optimal = q8_0', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 32, freeRamGb: 16, cpuCores: 16, vramGb: 12, gpuName: 'RTX 3090', diskFreeGb: 200, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.1:8b-instruct-q8_0')
  })

  it('VRAM 8-11 GB: optimal = q4_K_M', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 32, freeRamGb: 16, cpuCores: 8, vramGb: 8, gpuName: 'RTX 3070', diskFreeGb: 200, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.1:8b-instruct-q4_K_M')
    expect(recs.find(r => r.tier === 'recommended')?.model).toBe('llama3.1:8b-instruct-q4_K_M')
  })

  it('VRAM 4-7 GB: optimal + recommended = llama3.2', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 16, freeRamGb: 8, cpuCores: 8, vramGb: 6, gpuName: 'RTX 2060', diskFreeGb: 100, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.2')
    expect(recs.find(r => r.tier === 'recommended')?.model).toBe('llama3.2')
  })

  it('VRAM < 4 GB: falls back to RAM tiers', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 32, freeRamGb: 20, cpuCores: 8, vramGb: 2, gpuName: 'GTX 1050', diskFreeGb: 100, dataDir: '/data' })
    // 32GB RAM no-GPU path
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.1:8b-instruct-q8_0')
  })

  it('RAM >= 32 GB (no GPU): optimal = q8_0', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 64, freeRamGb: 40, cpuCores: 32, vramGb: null, gpuName: null, diskFreeGb: 500, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.1:8b-instruct-q8_0')
  })

  it('RAM 16-31 GB (no GPU): optimal = q4_K_M, recommended = q4_K_M', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 16, freeRamGb: 10, cpuCores: 8, vramGb: null, gpuName: null, diskFreeGb: 200, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.1:8b-instruct-q4_K_M')
    expect(recs.find(r => r.tier === 'recommended')?.model).toBe('llama3.1:8b-instruct-q4_K_M')
  })

  it('RAM 8-15 GB (no GPU): optimal + recommended = llama3.2', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 8, freeRamGb: 4, cpuCores: 4, vramGb: null, gpuName: null, diskFreeGb: 100, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'optimal')?.model).toBe('llama3.2')
    expect(recs.find(r => r.tier === 'recommended')?.model).toBe('llama3.2')
  })

  it('RAM < 8 GB (no GPU): recommended = llama3.2:1b', async () => {
    const { recommendModels } = await import('../hardware-scan.js')
    const recs = recommendModels({ ramGb: 6, freeRamGb: 2, cpuCores: 2, vramGb: null, gpuName: null, diskFreeGb: 50, dataDir: '/data' })
    expect(recs.find(r => r.tier === 'recommended')?.model).toBe('llama3.2:1b')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd packages/core && pnpm test -- --reporter=verbose src/models/__tests__/hardware-scan.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `hardware-scan.ts`**

Create `packages/core/src/models/hardware-scan.ts`:
```typescript
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export interface HardwareSummary {
  ramGb: number
  freeRamGb: number
  cpuCores: number
  vramGb: number | null
  gpuName: string | null
  diskFreeGb: number
  dataDir: string
}

export interface ModelRecommendation {
  model: string
  reason: string
  sizeGb: number
  tier: 'minimum' | 'recommended' | 'optimal'
}

// ── Linux helpers ────────────────────────────────────────────────

function readMemInfoLinux(): { totalGb: number; freeGb: number } | null {
  try {
    const raw = readFileSync('/proc/meminfo', 'utf8')
    const parse = (key: string) => {
      const m = raw.match(new RegExp(`${key}:\\s+(\\d+)`))
      return m ? Number(m[1]) * 1024 : 0
    }
    const total = parse('MemTotal')
    const free  = parse('MemFree')
    const bufs  = parse('Buffers')
    const cache = parse('Cached')
    const srec  = parse('SReclaimable')
    return {
      totalGb: total / (1024 ** 3),
      freeGb: (free + bufs + cache + srec) / (1024 ** 3),
    }
  } catch { return null }
}

function readGpuNvidia(): { name: string; vramGb: number } | null {
  try {
    const out = execSync(
      'nvidia-smi --query-gpu=name,memory.total,memory.used,utilization.gpu --format=csv,noheader,nounits',
      { timeout: 2000 }
    ).toString().trim()
    const parts = out.split(',').map(s => s.trim())
    if (parts.length < 2) return null
    const [name, vramMb] = parts
    return { name, vramGb: Number(vramMb) / 1024 }
  } catch { return null }
}

function readDiskLinux(path: string): number {
  try {
    const out = execSync(`df -B1 "${path}" 2>/dev/null | tail -1`, { timeout: 2000 }).toString().trim()
    const [, , , free] = out.split(/\s+/).map(Number)
    return (free ?? 0) / (1024 ** 3)
  } catch { return 0 }
}

function readCpuCores(): number {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors"',
        { timeout: 3000 }
      ).toString().trim()
      return Number(out) || 1
    }
    const out = execSync('nproc 2>/dev/null || grep -c processor /proc/cpuinfo', { timeout: 2000 }).toString().trim()
    return Number(out) || 1
  } catch { return 1 }
}

// ── Windows helpers (no wmic — removed in Windows 11) ────────────

function readMemInfoWindows(): { totalGb: number; freeGb: number } | null {
  try {
    const totalOut = execSync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"',
      { timeout: 3000 }
    ).toString().trim()
    const freeOut = execSync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory"',
      { timeout: 3000 }
    ).toString().trim()
    const totalBytes = Number(totalOut)
    const freeKb     = Number(freeOut)
    if (!totalBytes) return null
    return {
      totalGb: totalBytes / (1024 ** 3),
      freeGb:  freeKb / (1024 ** 2),
    }
  } catch { return null }
}

function readGpuWindows(): { name: string; vramGb: number } | null {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1 -ExpandProperty Name,AdapterRAM | ConvertTo-Json"',
      { timeout: 3000 }
    ).toString().trim()
    const obj = JSON.parse(out) as { Name?: string; AdapterRAM?: number }
    if (!obj.AdapterRAM) return null
    return { name: obj.Name ?? 'Unknown GPU', vramGb: obj.AdapterRAM / (1024 ** 3) }
  } catch { return null }
}

function readDiskWindows(path: string): number {
  try {
    const drive = path.match(/^[A-Za-z]:/)?.[0] ?? 'C:'
    const out = execSync(
      `powershell -NoProfile -Command "(Get-PSDrive ${drive.replace(':', '')} | Select-Object -ExpandProperty Free)"`,
      { timeout: 3000 }
    ).toString().trim()
    return Number(out) / (1024 ** 3)
  } catch { return 0 }
}

// ── Public API ───────────────────────────────────────────────────

export function scanHardware(dataDir: string): HardwareSummary {
  const isWindows = process.platform === 'win32'
  const mem  = isWindows ? readMemInfoWindows() : readMemInfoLinux()
  const gpu  = readGpuNvidia() ?? (isWindows ? readGpuWindows() : null)
  const disk = isWindows ? readDiskWindows(dataDir) : readDiskLinux(dataDir)

  return {
    ramGb:     Math.round((mem?.totalGb ?? 0) * 10) / 10,
    freeRamGb: Math.round((mem?.freeGb  ?? 0) * 10) / 10,
    cpuCores:  readCpuCores(),
    vramGb:    gpu ? Math.round(gpu.vramGb * 10) / 10 : null,
    gpuName:   gpu?.name ?? null,
    diskFreeGb: Math.round(disk * 10) / 10,
    dataDir,
  }
}

export function recommendModels(hw: HardwareSummary): ModelRecommendation[] {
  // Minimum: always RAM-derived regardless of GPU
  const minimum: ModelRecommendation = hw.ramGb < 4
    ? { model: 'tinyllama',    reason: 'Minimum viable — fits in < 4 GB RAM',  sizeGb: 0.6, tier: 'minimum' }
    : { model: 'llama3.2:1b', reason: 'Minimum viable — fits in 4 GB RAM',    sizeGb: 1.3, tier: 'minimum' }

  // Use GPU tiers only when VRAM >= 4 GB
  const hasUsableGpu = hw.vramGb !== null && hw.vramGb >= 4

  let recommended: ModelRecommendation
  let optimal: ModelRecommendation

  if (hasUsableGpu) {
    const v = hw.vramGb!
    recommended = v >= 8
      ? { model: 'llama3.1:8b-instruct-q4_K_M', reason: 'Best balance for 8 GB VRAM',     sizeGb: 4.7, tier: 'recommended' }
      : { model: 'llama3.2',                     reason: 'Best balance for 4–8 GB VRAM',    sizeGb: 2.0, tier: 'recommended' }
    optimal = v >= 12
      ? { model: 'llama3.1:8b-instruct-q8_0',   reason: 'Near-full quality — 12 GB VRAM', sizeGb: 8.5, tier: 'optimal' }
      : v >= 8
        ? { model: 'llama3.1:8b-instruct-q4_K_M', reason: 'Best quality for 8 GB VRAM',   sizeGb: 4.7, tier: 'optimal' }
        : { model: 'llama3.2',                     reason: 'Best for 4–8 GB VRAM',          sizeGb: 2.0, tier: 'optimal' }
  } else {
    // No GPU or VRAM < 4 GB — use RAM tiers
    const r = hw.ramGb
    recommended = r >= 16
      ? { model: 'llama3.1:8b-instruct-q4_K_M', reason: 'Best balance for 16+ GB RAM',    sizeGb: 4.7, tier: 'recommended' }
      : r >= 8
        ? { model: 'llama3.2',                   reason: 'Best balance for 8+ GB RAM',      sizeGb: 2.0, tier: 'recommended' }
        : { model: 'llama3.2:1b',                reason: 'Lightweight — fits in < 8 GB RAM', sizeGb: 1.3, tier: 'recommended' }
    optimal = r >= 32
      ? { model: 'llama3.1:8b-instruct-q8_0',   reason: 'Near-full quality — 32+ GB RAM', sizeGb: 8.5, tier: 'optimal' }
      : r >= 16
        ? { model: 'llama3.1:8b-instruct-q4_K_M', reason: 'Best quality for 16+ GB RAM',  sizeGb: 4.7, tier: 'optimal' }
        : r >= 8
          ? { model: 'llama3.2',                 reason: 'Best for 8+ GB RAM',              sizeGb: 2.0, tier: 'optimal' }
          : { model: 'llama3.2:1b',              reason: 'Lightweight — fits in < 8 GB RAM', sizeGb: 1.3, tier: 'optimal' }
  }

  return [minimum, recommended, optimal]
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd packages/core && pnpm test -- --reporter=verbose src/models/__tests__/hardware-scan.test.ts`
Expected: PASS (all 10 tests)

- [ ] **Step 5: Run full core test suite**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/models/hardware-scan.ts packages/core/src/models/__tests__/hardware-scan.test.ts
git commit -m "feat(core/models): add hardware-scan module with scanHardware and recommendModels"
```

---

### Task 10: Add `GET /api/admin/hardware-scan` endpoint to `system.ts`

**Files:**
- Modify: `packages/core/src/api/routes/system.ts`

Register a new admin-gated endpoint that calls `scanHardware` + `recommendModels` and returns a JSON response.

- [ ] **Step 1: Add the import and endpoint**

In `packages/core/src/api/routes/system.ts`, add the import at the top (after existing imports):
```typescript
import { scanHardware, recommendModels } from '../../models/hardware-scan.js'
```

Inside `systemRoutes()`, after the existing `/api/admin/update` route, add:
```typescript
  // GET /api/admin/hardware-scan — scan hardware and recommend Ollama models
  fastify.get('/api/admin/hardware-scan', async (_req, reply) => {
    const hardware = scanHardware(config.dataDir)
    const recommendations = recommendModels(hardware)
    return reply.send({ hardware, recommendations })
  })
```

- [ ] **Step 2: Run core tests — no regressions**

Run: `cd packages/core && pnpm test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/api/routes/system.ts
git commit -m "feat(core/api): add GET /api/admin/hardware-scan endpoint"
```

---

### Task 11: Add `getHardwareScan()` to `client.ts` and Hardware card to `System.tsx`

**Files:**
- Modify: `packages/web/src/api/client.ts` (add types + method)
- Modify: `packages/web/src/pages/System.tsx` (add Hardware card)

- [ ] **Step 1: Add types and method to `client.ts`**

In `packages/web/src/api/client.ts`, add after the `SystemStats` interface (after line 64):
```typescript
export interface HardwareSummary {
  ramGb: number
  freeRamGb: number
  cpuCores: number
  vramGb: number | null
  gpuName: string | null
  diskFreeGb: number
  dataDir: string
}

export interface ModelRecommendation {
  model: string
  reason: string
  sizeGb: number
  tier: 'minimum' | 'recommended' | 'optimal'
}

export interface HardwareScan {
  hardware: HardwareSummary
  recommendations: ModelRecommendation[]
}
```

Add the method to `CoreClient`, after `getSystemStats()` (after line 220):
```typescript
  async getHardwareScan(): Promise<HardwareScan> {
    const res = await fetch(`${this.baseUrl}/api/admin/hardware-scan`, {
      headers: this.adminHeaders(),
    })
    if (!res.ok) throw new Error(`Hardware scan failed (${res.status})`)
    return res.json()
  }
```

- [ ] **Step 2: Add Hardware card to `System.tsx`**

In `packages/web/src/pages/System.tsx`, update the import from `../api/client`:
```typescript
import { coreClient, type SystemStats, type HardwareScan, type ModelRecommendation } from '../api/client'
```

Add state and fetch after the existing `useEffect` for `checkUpdate` (after line 84):
```typescript
  const [hwScan, setHwScan] = useState<HardwareScan | null>(null)
  const [hwLoading, setHwLoading] = useState(false)
  const [hwError, setHwError] = useState('')

  useEffect(() => {
    setHwLoading(true)
    coreClient.getHardwareScan()
      .then(setHwScan)
      .catch(() => setHwError('Hardware scan unavailable'))
      .finally(() => setHwLoading(false))
  }, [])
```

Add the Hardware card in the JSX, after the `</div>` closing the stats grid (after line 221):
```tsx
        {/* Hardware + Model Recommendations */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Hardware &amp; Model Recommendations</h2>
          {hwLoading && <p className="text-gray-500 text-sm font-mono">Scanning hardware...</p>}
          {hwError && <p className="text-red-400 text-sm">{hwError}</p>}
          {hwScan && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-4">
              {/* Hardware summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm font-mono">
                <div><span className="text-gray-500">RAM</span><br /><span className="text-white">{hwScan.hardware.ramGb} GB</span></div>
                <div><span className="text-gray-500">Free</span><br /><span className="text-white">{hwScan.hardware.freeRamGb} GB</span></div>
                <div><span className="text-gray-500">CPU</span><br /><span className="text-white">{hwScan.hardware.cpuCores} cores</span></div>
                <div><span className="text-gray-500">VRAM</span><br /><span className="text-white">{hwScan.hardware.vramGb != null ? `${hwScan.hardware.vramGb} GB` : 'None'}</span></div>
                {hwScan.hardware.gpuName && (
                  <div className="col-span-2"><span className="text-gray-500">GPU</span><br /><span className="text-white">{hwScan.hardware.gpuName}</span></div>
                )}
                <div className="col-span-2"><span className="text-gray-500">Disk free</span><br /><span className="text-white">{hwScan.hardware.diskFreeGb} GB</span></div>
              </div>

              {/* Model recommendations */}
              <div className="space-y-2">
                {hwScan.recommendations.map((rec: ModelRecommendation) => (
                  <div key={rec.tier} className="flex items-center gap-3 p-3 rounded border border-gray-800 bg-gray-950">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                      rec.tier === 'optimal'      ? 'bg-green-900/50 text-green-400 border border-green-800' :
                      rec.tier === 'recommended'  ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-800' :
                                                    'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>{rec.tier}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-mono text-white truncate">{rec.model}</div>
                      <div className="text-xs text-gray-500">{rec.reason} · {rec.sizeGb} GB</div>
                    </div>
                    <button
                      onClick={() => coreClient.pullOllamaModel(rec.model, crypto.randomUUID())}
                      className="text-xs px-3 py-1.5 bg-cyan-900/30 hover:bg-cyan-900/60 border border-cyan-800 text-cyan-400 rounded font-mono transition-colors flex-shrink-0"
                    >
                      Install
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 3: Build the web package to check TypeScript**

Run: `cd packages/web && pnpm build`
Expected: exits 0 with no type errors

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/api/client.ts packages/web/src/pages/System.tsx
git commit -m "feat(web): add hardware scan types, client method, and Hardware card to System page"
```

---

### Task 12: Update `install.sh` model pull → inline hardware scan + prompt

**Files:**
- Modify: `install.sh` (lines 197–215, step ⑦)

The server is not running at step ⑦, so the scan must be done inline with bash. Replace the unconditional `ollama pull llama3.2` block.

- [ ] **Step 1: Replace step ⑦ in `install.sh`**

In `install.sh`, replace lines 197–215:
```bash
# ── Pull default model ───────────────────────────────────────
step "⑦ Pulling default model (llama3.2)"

# Start Ollama in background if not already running
if ! ollama list &>/dev/null; then
  info "Starting Ollama service..."
  ollama serve &>/dev/null &
  OLLAMA_PID=$!
  sleep 3
  info "Ollama started (PID ${OLLAMA_PID})"
fi

if ollama list 2>/dev/null | grep -q "llama3.2"; then
  success "llama3.2 already pulled"
else
  info "Pulling llama3.2 (~2 GB)..."
  ollama pull llama3.2
  success "llama3.2 ready"
fi
```
with:
```bash
# ── Select and pull Ollama model ─────────────────────────────
step "⑦ Selecting Ollama model"

# Inline hardware scan (server not running yet)
_RAM_KB=$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}')
_RAM_GB=$(( ${_RAM_KB:-0} / 1024 / 1024 ))
_FREE_KB=$(grep MemAvailable /proc/meminfo 2>/dev/null | awk '{print $2}')
_FREE_GB=$(( ${_FREE_KB:-0} / 1024 / 1024 ))

_VRAM_MB=""
if command -v nvidia-smi &>/dev/null; then
  _VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 | tr -d ' ')
fi
_VRAM_GB=$(( ${_VRAM_MB:-0} / 1024 ))

# Compute recommendation tiers (mirrors recommendModels in hardware-scan.ts)
_MINIMUM="llama3.2:1b"
[[ ${_RAM_GB:-0} -lt 4 ]] && _MINIMUM="tinyllama"

if [[ -n "$_VRAM_MB" && $_VRAM_GB -ge 4 ]]; then
  _RECOMMENDED=$( [[ $_VRAM_GB -ge 8 ]] && echo "llama3.1:8b-instruct-q4_K_M" || echo "llama3.2" )
  _OPTIMAL=$(     [[ $_VRAM_GB -ge 12 ]] && echo "llama3.1:8b-instruct-q8_0" || \
                  [[ $_VRAM_GB -ge 8  ]] && echo "llama3.1:8b-instruct-q4_K_M" || echo "llama3.2" )
else
  _RECOMMENDED=$( [[ $_RAM_GB -ge 16 ]] && echo "llama3.1:8b-instruct-q4_K_M" || \
                  [[ $_RAM_GB -ge 8  ]] && echo "llama3.2" || echo "llama3.2:1b" )
  _OPTIMAL=$(     [[ $_RAM_GB -ge 32 ]] && echo "llama3.1:8b-instruct-q8_0" || \
                  [[ $_RAM_GB -ge 16 ]] && echo "llama3.1:8b-instruct-q4_K_M" || \
                  [[ $_RAM_GB -ge 8  ]] && echo "llama3.2" || echo "$_RECOMMENDED" )
fi

info "Hardware: ${_RAM_GB} GB RAM, ${_FREE_GB} GB free${_VRAM_MB:+, ${_VRAM_GB} GB VRAM}"
echo ""
echo "  Model recommendations:"
printf "  %-12s %s\n"  "minimum"     "$_MINIMUM"
printf "  %-12s %s  %s\n" "recommended" "$_RECOMMENDED" "<-- default"
printf "  %-12s %s\n"  "optimal"     "$_OPTIMAL"
echo ""

# Start Ollama in background if not already running
if ! ollama list &>/dev/null; then
  info "Starting Ollama service..."
  ollama serve &>/dev/null &
  OLLAMA_PID=$!
  sleep 3
fi

read -r -p "  Press Enter to install [${_RECOMMENDED}] or type a different model name: " _CHOSEN_MODEL
_CHOSEN_MODEL="${_CHOSEN_MODEL:-$_RECOMMENDED}"

if ollama list 2>/dev/null | grep -qF "${_CHOSEN_MODEL}"; then
  success "${_CHOSEN_MODEL} already pulled"
else
  info "Pulling ${_CHOSEN_MODEL}..."
  ollama pull "$_CHOSEN_MODEL"
  success "${_CHOSEN_MODEL} ready"
fi
```

- [ ] **Step 2: Commit**

```bash
git add install.sh
git commit -m "feat(install.sh): replace hardcoded llama3.2 pull with inline hardware scan and model selection prompt"
```

---

### Task 13: Update `install.ps1` model pull → inline hardware scan + prompt

**Files:**
- Modify: `install.ps1` (lines 136–145, step 7)

- [ ] **Step 1: Replace step 7 in `install.ps1`**

In `install.ps1`, replace lines 136–145:
```powershell
# ── Pull default model ────────────────────────────────────────
Write-Step "7) Pulling default model (llama3.2)"
$ollamaList = ollama list 2>$null
if ($ollamaList -match "llama3\.2") {
    Write-Ok "llama3.2 already pulled"
} else {
    Write-Info "Pulling llama3.2 (~2 GB)..."
    ollama pull llama3.2
    Write-Ok "llama3.2 ready"
}
```
with:
```powershell
# ── Select and pull Ollama model ──────────────────────────────
Write-Step "7) Selecting Ollama model"

# Inline hardware scan (server not running yet; no wmic on Windows 11)
$RamGB = 0; $FreeGB = 0; $VramGB = 0
try {
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
    $RamGB = [int][math]::Round($cs.TotalPhysicalMemory / 1GB)
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $FreeGB = [int][math]::Round($os.FreePhysicalMemory / 1MB)
} catch {}
try {
    $nvsmi = nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null | Select-Object -First 1
    if ($nvsmi -match '^\d+') { $VramGB = [int][math]::Round([int]$nvsmi / 1024) }
} catch {}
if ($VramGB -eq 0) {
    try {
        $vc = Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue |
              Where-Object { $_.AdapterRAM -gt 0 } | Select-Object -First 1
        if ($vc) { $VramGB = [int][math]::Round($vc.AdapterRAM / 1GB) }
    } catch {}
}

$MinModel = if ($RamGB -lt 4) { "tinyllama" } else { "llama3.2:1b" }
if ($VramGB -ge 4) {
    $RecModel = if ($VramGB -ge 8) { "llama3.1:8b-instruct-q4_K_M" } else { "llama3.2" }
    $OptModel = if ($VramGB -ge 12) { "llama3.1:8b-instruct-q8_0" } `
                elseif ($VramGB -ge 8) { "llama3.1:8b-instruct-q4_K_M" } `
                else { "llama3.2" }
} else {
    $RecModel = if ($RamGB -ge 16) { "llama3.1:8b-instruct-q4_K_M" } `
                elseif ($RamGB -ge 8) { "llama3.2" } else { "llama3.2:1b" }
    $OptModel = if ($RamGB -ge 32) { "llama3.1:8b-instruct-q8_0" } `
                elseif ($RamGB -ge 16) { "llama3.1:8b-instruct-q4_K_M" } `
                elseif ($RamGB -ge 8) { "llama3.2" } else { $RecModel }
}

Write-Info "Hardware: $RamGB GB RAM, $FreeGB GB free$(if ($VramGB -gt 0) { ", $VramGB GB VRAM" })"
Write-Host ""
Write-Host "  Model recommendations:" -ForegroundColor White
Write-Host "  minimum     $MinModel" -ForegroundColor DarkGray
Write-Host "  recommended $RecModel  <-- default" -ForegroundColor Cyan
Write-Host "  optimal     $OptModel" -ForegroundColor White
Write-Host ""

$ChosenModel = Read-Host "  Press Enter to install [$RecModel] or type a different model name"
if (-not $ChosenModel) { $ChosenModel = $RecModel }

$OllamaList = ollama list 2>$null
if ($OllamaList -match [regex]::Escape($ChosenModel)) {
    Write-Ok "$ChosenModel already pulled"
} else {
    Write-Info "Pulling $ChosenModel..."
    ollama pull $ChosenModel
    if ($LASTEXITCODE -ne 0) { Write-Fail "ollama pull $ChosenModel failed (exit $LASTEXITCODE)" }
    Write-Ok "$ChosenModel ready"
}
```

- [ ] **Step 2: Commit**

```bash
git add install.ps1
git commit -m "feat(install.ps1): replace hardcoded llama3.2 pull with inline hardware scan and model selection prompt"
```

---

## Final Review

After all 13 tasks are complete:

- [ ] Run `cd packages/core && pnpm test` — all pass
- [ ] Run `cd packages/daemon && pnpm test` — all pass
- [ ] Run `pnpm build` from repo root — exits 0 on both Linux and Windows
- [ ] Use `superpowers:finishing-a-development-branch` to decide integration approach
