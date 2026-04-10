# Deployment Consistency, Voice Quality, and Hardware-Scan Design

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Fix six concrete bootable-instance bugs that cause services to misbehave or not start; fix TTS sample-rate mismatch that makes voice output sound rushed and garbled; add a hardware-scan module that recommends the best Ollama model for the target device and surfaces the results in both the install scripts and the admin panel.

**Architecture:**
Three independent subsystems. Section 1 is pure config/script corrections with no new code. Section 2 adds a sample-rate protocol to the existing WebSocket TTS stream. Section 3 adds a new `hardware-scan.ts` module, one new API endpoint, and install-script changes.

**Tech Stack:** Bash, PowerShell, systemd unit files, Python 3 / FastAPI (vibevoice server), Node 22 ESM TypeScript (Fastify core), React + Tailwind v4 (admin UI).

---

## Section 1 — Deployment Consistency + Bootable Fixes

### Bugs

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `coastalos/systemd/coastal-web.service` | `After=coastalclaw-server.service` AND `Wants=coastalclaw-server.service` — both lines use the wrong unit name | Change both to `coastal-server.service` |
| 2 | `coastalos/labwc/autostart` | `chromium-browser --app=http://localhost:4747` — opens the raw API JSON instead of the web UI | Change to `http://localhost:5173` |
| 3 | `coastalos/systemd/coastal-shell.service` | `XDG_RUNTIME_DIR=/run/user/1000` — UID 1000 hardcoded; breaks if `coastal` user gets a different UID | Replace with `RuntimeDirectory=coastal` + `Environment=XDG_RUNTIME_DIR=/run/user/%U` so systemd resolves the UID |
| 4 | `coastalos/build/hooks/post-install.sh` cgroup slice | `MemoryMax=512M` — the entire `coastal.slice` is capped at 512 MB; Node.js + daemon together can exceed this causing silent OOM kills | Raise to `MemoryMax=2G` |
| 5 | `install.ps1` generated `.env.local` | Missing `CC_VRAM_BUDGET_GB=24` and `CC_ROUTER_CONFIDENCE=0.7` that `install.sh` writes | Add both lines to the PowerShell heredoc |
| 6 | `coastalos/systemd/coastal-server.service` | `CC_OLLAMA_URL`, `CC_DEFAULT_MODEL` absent — relies on code defaults rather than being explicit like the install scripts | Add `Environment=CC_OLLAMA_URL=http://127.0.0.1:11434` and `Environment=CC_DEFAULT_MODEL=llama3.2` |
| 7 | `coastalos/build/hooks/post-install.sh` | `coastal-web.service` is never enabled — the Chromium URL fix (Bug 2) would have no effect at boot | Add `systemctl enable coastal-web.service` after the existing `systemctl enable` calls |
| 8 | `packages/core/package.json` | Build script `"tsc && cp -r src/agents/souls dist/agents/souls"` uses Unix `cp` — fails silently on Windows causing the souls directory to be absent in `dist/` | Replace `cp -r` with a cross-platform Node.js inline: `node -e "require('fs').cpSync('src/agents/souls','dist/agents/souls',{recursive:true})"` |
| 9 | `install.ps1` | `$ErrorActionPreference = 'Stop'` does not catch non-zero exit codes from external processes (`pnpm build` failing exits code 1 but PowerShell continues and prints `[OK] Build complete`) | After each external command call (`pnpm install`, `pnpm build`), check `if ($LASTEXITCODE -ne 0) { Write-Fail "..." }` |

### Fixing Bug 3 — XDG_RUNTIME_DIR

`%U` in systemd unit specifiers expands to the **username string** (e.g., `coastal`), not the numeric UID. The correct fix is to write the resolved UID into the unit at install time inside `post-install.sh`:

```bash
COASTAL_UID=$(id -u coastal)
sed -i "s|XDG_RUNTIME_DIR=.*|XDG_RUNTIME_DIR=/run/user/${COASTAL_UID}|" \
  /etc/systemd/system/coastal-shell.service
systemctl daemon-reload
```

This runs after `useradd` so `coastal` exists. The service file in the repo ships with the placeholder `XDG_RUNTIME_DIR=/run/user/__COASTAL_UID__` which `post-install.sh` replaces at install time.

### No new files. All changes are in existing files.

---

## Section 2 — Voice TTS: Sample Rate + Async Fix

### Root Cause

`coastalos/vibevoice/server.py` streams raw PCM bytes over WebSocket with no metadata. `pcmToWav()` in `packages/core/src/api/routes/system.ts` hardcodes `sampleRate = 24_000`. If VibeVoice-Realtime-0.5B outputs at its native 22050 Hz, playback runs at 22050/24000 = 91.9% speed — slightly fast — plus the pitch is wrong: exactly the "rushed and garbled" symptom.

A second bug in `server.py`: `loop.run_in_executor(None, lambda: tts_model.generate(..., streamer=streamer))` fires the model generation in a thread executor **without** awaiting it. The `async for chunk in streamer` loop may race against the not-yet-started generation, producing empty or partial output.

### Protocol Change

The WebSocket TTS stream adds one JSON metadata frame **before** the first PCM chunk:

```
Client connects
Server sends: {"sample_rate": 22050, "channels": 1}   ← new first frame
Server sends: <binary PCM chunk> …                     ← unchanged
Server sends: {"done": true}                           ← unchanged
```

Backwards-compatible for any future consumers that check for the metadata frame.

### Changes

**`coastalos/vibevoice/server.py`**
- Before the `async for chunk in streamer` loop, send `{"sample_rate": SAMPLE_RATE, "channels": 1}` as a text frame.
- Replace `loop.run_in_executor(None, lambda: tts_model.generate(...))` with `asyncio.create_task(asyncio.to_thread(tts_model.generate, ...))` so the task runs concurrently with the streamer iterator without a race condition.
- Add module-level constant `TTS_SAMPLE_RATE = int(os.getenv("VIBEVOICE_SAMPLE_RATE", "22050"))`.

**`packages/core/src/voice/vibevoice.ts`** — `speak()` method
- Return type changes from `AsyncIterable<Buffer>` to `AsyncIterable<{ pcm: Buffer; sampleRate: number }>`.
- **Architecture change — sequential first-read, not event-driven**: after the WebSocket `open` event, the generator must `await` the first text frame as a Promise (e.g., `ws.once('message', ...)` wrapped in a Promise) before entering the PCM-yielding loop. The metadata frame must be consumed sequentially before registering the general `ws.on('message', ...)` handler, otherwise the event loop could deliver a PCM chunk before `sampleRate` is set if the server sends both in rapid succession.
- Yield `{ pcm: chunk, sampleRate }` instead of bare `chunk`.
- Backwards compatibility: if the first text message is not valid JSON containing `sample_rate`, fall back to `sampleRate = 24000` and continue — preserving compatibility with servers that have not yet been updated.

**`packages/core/src/api/routes/system.ts`** — admin TTS endpoint
- Update the `for await` loop over `vibe.speak()` to destructure `{ pcm, sampleRate }`.
- Pass `sampleRate` to `pcmToWav(Buffer.concat(chunks), sampleRate)`.
- Collect `chunks` as `Buffer[]` from `pcm` fields.

**`packages/daemon/src/voice/vibevoice-client.ts`** — daemon's own copy of the VibeVoice client
- Apply the identical metadata-frame protocol change as `packages/core/src/voice/vibevoice.ts`.
- Return type changes from `AsyncIterable<Buffer>` to `AsyncIterable<{ pcm: Buffer; sampleRate: number }>`.

**`packages/daemon/src/voice/pipeline.ts`** — daemon voice pipeline
- Update `for await` loop to destructure `{ pcm, sampleRate }`.
- Replace the hardcoded `24_000` in `this.player.play(Buffer.concat(chunks), 24_000)` with the `sampleRate` resolved from the first metadata frame.

### No new files. Five existing files change.

---

## Section 3 — Hardware Scan + Model Recommender

### New File: `packages/core/src/models/hardware-scan.ts`

Exports two functions:

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
  model: string          // e.g. "llama3.1:8b-instruct-q4_K_M"
  reason: string         // human-readable one-liner
  sizeGb: number         // approximate download size
  tier: 'minimum' | 'recommended' | 'optimal'
}

export function scanHardware(dataDir: string): HardwareSummary
export function recommendModels(hw: HardwareSummary): ModelRecommendation[]
```

`scanHardware` reuses the same `/proc/meminfo`, `nvidia-smi`, and `df -B1` logic already in `system.ts` (extracted to shared helpers). On Windows, it uses `powershell -Command "Get-CimInstance Win32_ComputerSystem"` for RAM and `powershell -Command "Get-CimInstance Win32_VideoController"` for VRAM via `execSync` with a `try/catch` fallback. (`wmic` is removed on Windows 11 and must not be used.)

**Recommendation tiers** (VRAM takes precedence over RAM when a GPU is present):

| Condition | Recommended model | Size | Tier |
|---|---|---|---|
The function always returns **exactly three entries** — one per tier — so the UI can present a clear three-option choice. The `minimum` entry is **always RAM-derived** regardless of GPU presence (it represents the fallback that will run on any machine). The `recommended` and `optimal` entries use VRAM tiers when a GPU is present, otherwise RAM tiers.

| Condition | Tier | Recommended model | Size |
|---|---|---|---|
| — (always) | minimum | `tinyllama` if RAM < 4 GB, else `llama3.2:1b` | 0.6–1.3 GB |
| VRAM ≥ 12 GB | optimal | `llama3.1:8b-instruct-q8_0` | ~8.5 GB |
| VRAM ≥ 8 GB | optimal | `llama3.1:8b-instruct-q4_K_M` | ~4.7 GB |
| VRAM ≥ 4 GB, < 8 GB | optimal | `llama3.2` | ~2.0 GB |
| VRAM ≥ 8 GB | recommended | `llama3.1:8b-instruct-q4_K_M` | ~4.7 GB |
| VRAM ≥ 4 GB, < 8 GB | recommended | `llama3.2` | ~2.0 GB |
| RAM ≥ 32 GB (no GPU) | optimal | `llama3.1:8b-instruct-q8_0` | ~8.5 GB |
| RAM ≥ 16 GB (no GPU) | optimal | `llama3.1:8b-instruct-q4_K_M` | ~4.7 GB |
| RAM ≥ 8 GB (no GPU) | optimal | `llama3.2` | ~2.0 GB |
| RAM ≥ 16 GB (no GPU) | recommended | `llama3.1:8b-instruct-q4_K_M` | ~4.7 GB |
| RAM ≥ 8 GB (no GPU) | recommended | `llama3.2` | ~2.0 GB |
| RAM < 8 GB (no GPU) | recommended | `llama3.2:1b` | ~1.3 GB |

**Edge case — VRAM present but < 4 GB**: treat as "no GPU" for the purpose of `recommended` and `optimal` tier selection (i.e., fall back to RAM-only rows for those two tiers). `minimum` is always RAM-derived regardless. This ensures the function always returns exactly three entries.

The install scripts use the `recommended` tier model by default.

### New API Endpoint

`GET /api/admin/hardware-scan` (admin-gated, registered in `system.ts`)

Response:
```json
{
  "hardware": { "ramGb": 32, "freeRamGb": 20, "cpuCores": 16, "vramGb": 8, "gpuName": "NVIDIA RTX 3070", "diskFreeGb": 450, "dataDir": "/var/lib/coastalclaw/data" },
  "recommendations": [
    { "model": "llama3.2:1b",                       "reason": "Minimum viable — fits in 4 GB RAM",    "sizeGb": 1.3, "tier": "minimum" },
    { "model": "llama3.1:8b-instruct-q4_K_M",       "reason": "Best balance for 8 GB VRAM",          "sizeGb": 4.7, "tier": "recommended" },
    { "model": "llama3.1:8b-instruct-q8_0",         "reason": "Near-full quality — requires 12 GB VRAM", "sizeGb": 8.5, "tier": "optimal" }
  ]
}
```

### Admin Panel UI (existing admin page)

Add a **Hardware** card to the system stats section in the admin panel. It shows:
- RAM, VRAM, CPU cores, free disk
- Three model recommendation rows (minimum / recommended / optimal) with size and reason
- "Install" button per row that calls the existing `POST /api/admin/models/add` or `ollama pull` flow

The card auto-loads on page visit (one fetch to `/api/admin/hardware-scan`). No polling.

### Install Script Changes

**`install.sh`** — replace the unconditional `ollama pull llama3.2` block (step ⑦) with:
1. Call `GET /api/admin/hardware-scan` against the freshly-started server, or run the scan inline using bash `/proc/meminfo` + `nvidia-smi` parsing.
2. Display the three recommendation tiers.
3. Prompt: `Press Enter to install [recommended model] or type a different model name: `
4. Pull the chosen model.

**`install.ps1`** — same logic in PowerShell using `Get-CimInstance Win32_ComputerSystem` for RAM, `nvidia-smi` for VRAM.

### Files Changed / Created

| Action | Path |
|---|---|
| **Create** | `packages/core/src/models/hardware-scan.ts` |
| **Modify** | `packages/core/src/api/routes/system.ts` — add `/api/admin/hardware-scan` endpoint |
| **Modify** | `install.sh` — replace hardcoded `ollama pull` with scan + prompt |
| **Modify** | `install.ps1` — same |
| **Modify** | Admin UI component (existing system stats / admin panel page) — add Hardware card |

---

## Error Handling

- **`scanHardware` on Windows**: `wmic` and PowerShell calls wrapped in `try/catch`; returns `vramGb: null`, `gpuName: null` on failure — recommendation falls back to RAM-only tiers.
- **Scan endpoint unavailable during install**: if the server isn't up yet, install scripts run the scan inline in bash/PS1 rather than calling the API.
- **VibeVoice metadata frame missing** (old server): `vibevoice.ts` checks if the first message is text and valid JSON with `sample_rate`; if not, falls back to 24000 Hz to preserve backwards compatibility.
- **`MemoryMax=2G` still too low for heavy workloads**: the slice limit is advisory, not a hard ceiling; systemd will log an OOM event rather than silently kill, giving operators visibility.

---

## Testing

- **Section 1**: smoke-test the ISO build with the corrected service files; confirm `coastal-web.service` starts after `coastal-server.service`; confirm Chromium opens the correct URL.
- **Section 2**: unit test `speak()` against a mock WebSocket server that emits the metadata frame; assert returned `sampleRate` matches. Integration test: compare before/after PCM → WAV round-trip durations.
- **Section 3**: unit test `scanHardware()` with mocked `/proc/meminfo` and `nvidia-smi` output; unit test `recommendModels()` for each tier boundary; API test `GET /api/admin/hardware-scan` returns correct shape.
