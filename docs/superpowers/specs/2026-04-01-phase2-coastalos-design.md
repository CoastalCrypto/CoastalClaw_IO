# Coastal.AI Phase 2 — CoastalOS Design Spec

**Date:** 2026-04-01
**Status:** Implementation complete — v0.3.0-phase2-coastalos
**Scope:** coastal-architect (self-build loop) → CoastalOS (Ubuntu kiosk + browser control) → Voice Pipeline (all local)

---

## Canonical Port

`coastal-server` runs on **port 4747** (`CC_PORT=4747`). All references in this spec — kiosk URL (`http://localhost:4747`), Electron BrowserWindow, systemd service — use 4747. The APEX OS design spec (2026-03-31) mentioned port 18789 in the architecture diagram; that was a draft artifact. 4747 is canonical.

---

## Core Principle

**Everything runs locally.** No cloud APIs, no external services, no API keys required.

| Component | Solution | Forbidden |
|-----------|----------|-----------|
| STT | Whisper.cpp (local) | OpenAI Whisper API |
| TTS | Piper TTS (local) | ElevenLabs, any cloud TTS |
| LLM | Ollama (local) | Claude API, OpenAI, Anthropic |
| Memory | Mem0 local mode | Mem0 cloud |
| Browser automation | Playwright (local) | Any cloud automation service |

---

## Build Sequence

Phase 2 ships three subsystems in order — each independently testable:

1. **B — `coastal-architect`** — self-build loop (pure Node, zero new deps)
2. **C — CoastalOS** — Ubuntu 24.04 LTS kiosk + browser control tools
3. **A — Voice Pipeline** — Whisper.cpp + openWakeWord + Piper TTS

---

## Subsystem B — coastal-architect

### What It Does

A standalone process that reads its own source code, reads `skill-gaps.db` failure patterns, asks a local Ollama model to propose one targeted improvement, applies it to a git branch, runs the test suite, and merges on pass.

### Trigger Conditions

- **Nightly cron** — runs once per night at 02:00 local time
- **Skill-gaps threshold** — fires immediately when `skill-gaps.db` has ≥10 unreviewed failures
- **Manual** — `POST /api/admin/architect/run` fires an immediate cycle

### Scope — What It Can Modify

- `packages/core/src/**` — core server source
- `packages/daemon/src/**` — daemon source
- `packages/architect/src/**` — its own package (NOT the entry point or safety guards)
- `agents/**` — agent SYSTEM.md and config.json files
- `package.json` files — dependency version bumps

### Locked Paths — Never Touched

- `packages/architect/src/index.ts` — entry point
- `packages/architect/src/config.ts` — locked paths list (prevents self-unlocking)
- `packages/architect/src/patcher.ts` — the diff-apply engine; self-modification here could escalate past locked paths on next cycle
- `packages/architect/src/validator.ts` — test runner; self-modification could fake passing tests
- `packages/core/src/agents/permission-gate.ts` — security critical
- `packages/core/src/agents/action-log.ts` — audit trail integrity
- `packages/core/src/api/routes/admin.ts` — auth routes

### Dry-Run + Veto Flow

```
Trigger fires
  → planner.ts: reads skill-gaps.db + relevant source → asks Ollama for ONE unified diff
  → announcer.ts: broadcasts via WebSocket:
      { type: "architect_proposal", summary: "...", diff: "...", vetoDeadline: now+60s }
  → 60-second veto window:
      - User sends POST /api/admin/architect/veto → branch deleted, cycle ends
      - No veto → patcher.ts applies diff to branch feature/self-improve-YYYYMMDD
  → validator.ts: runs pnpm test
  → PASS:
      - git merge --no-ff feature/self-improve-YYYYMMDD
      - log to architect-log.db
      - broadcast { type: "architect_applied", summary, testsDelta }
      - send SIGUSR2 to coastal-server PID → process restarts gracefully (systemd auto-restarts)
      - Note: "hot-reload" = graceful process restart. True ESM module cache invalidation
        requires a full process restart in Node; systemd ensures zero-downtime via restart policy.
  → FAIL:
      - git branch -D feature/self-improve-YYYYMMDD
      - log failure to architect-log.db
      - mark pattern as "skip for 24h" in skill-gaps.db
```

### Autonomous Flag

Config option `architectAutonomous: true` skips the veto window. Default: `false`. Set via Admin API or `data/.architect-autonomous` file.

### New Package Structure

```
packages/architect/
  src/
    index.ts            — entry point: cron + threshold watcher + manual trigger listener
    planner.ts          — reads skill-gaps.db + source, builds Ollama prompt, parses diff
    patcher.ts          — git branch create, apply unified diff, commit
    validator.ts        — runs pnpm test, parses pass/fail, captures test delta
    announcer.ts        — WebSocket broadcast + veto timeout
    config.ts           — LOCKED_PATHS, threshold constants, cron schedule
    __tests__/
      planner.test.ts
      patcher.test.ts   — uses temp git repo fixture
      validator.test.ts — uses mock pnpm test output
      announcer.test.ts — uses mock WebSocket
  package.json
  tsconfig.json
  vitest.config.ts
```

---

## Subsystem C — CoastalOS

### OS Foundation

- **Base**: Ubuntu 24.04 LTS (Noble Numbat)
- **Boot target**: Wayland kiosk — no GNOME, no KDE, no desktop environment
- **Kiosk compositor**: `labwc` (lightweight Wayland compositor with keybinding support via `rc.xml`)
- **Kiosk app**: Chromium `--kiosk http://localhost:4747` launched by labwc autostart
- **Terminal escape**: `Ctrl+Alt+T` → labwc keybinding in `rc.xml` spawns Alacritty terminal overlay (full Ubuntu shell, full APT access). labwc supports keybindings natively — `Cage` does not and must not be used here.
- **App installs**: Users ask agents to install apps ("install VLC") → agent runs `apt install vlc` via NativeBackend (AUTONOMOUS tier). Power users use `Ctrl+Alt+T` for direct APT.

### systemd Services

```ini
# coastal-server.service   — Fastify API + WebSocket (port 4747)
# coastal-daemon.service   — ProactiveScheduler + HandRunner + VoicePipeline
# coastal-architect.service — the work unit (triggered by timer or manual)
# coastal-architect.timer  — OnCalendar=*-*-* 02:00:00 (nightly at 02:00)
# coastal-shell.service    — labwc → Chromium kiosk
# ollama.service           — local LLM inference
```

Note: `coastal-architect` requires both a `.service` and a `.timer` unit. The `.service` does the work; the `.timer` schedules it. Both files live in `coastalos/systemd/`.

### Build Pipeline

```
coastalos/
  build/
    build.sh            — live-build or Cubic pipeline, produces coastalos-VERSION.iso
    packages.list       — node, pnpm, ollama, whisper-cpp, piper-tts, alacritty, chromium,
                          labwc, python3, python3-openwakeword, pipewire, wireplumber
    hooks/
      post-install.sh   — enable systemd services, set autologin for coastal user
  systemd/
    coastal-server.service
    coastal-daemon.service
    coastal-architect.service
    coastal-architect.timer     — nightly OnCalendar=*-*-* 02:00:00
    coastal-shell.service
  installer/
    calamares-config/   — CoastalOS branding, partitioning presets, welcome screen
  grub/
    coastal-grub-theme/ — boot screen: Coastal.AI logo, dark background
```

### Distribution Formats

| Format | Target |
|--------|--------|
| ISO | Dedicated hardware, USB install via Calamares |
| APT package | Existing Ubuntu servers (`apt install Coastal.AI`) |
| Docker image | Development, Windows users |

### Electron Shell (Windows / macOS)

For non-Linux users, a separate `packages/shell/` Electron app wraps `localhost:4747` in a frameless window. Same React UI. Ships as `.exe` (Windows NSIS) and `.dmg` (macOS) via `electron-builder`.

```
packages/shell/
  src/
    main.ts             — Electron main process, frameless BrowserWindow
    preload.ts          — IPC bridge (system tray, notifications)
  build/
    electron-builder.yml
  package.json
```

### Browser Control Tools

Agents get a new `browser_*` tool family at **TRUSTED+ tier**. Sandboxed agents cannot access browser tools.

**New files:**
```
packages/core/src/tools/browser/
  session-manager.ts    — BrowserSessionManager: one Playwright BrowserContext per agentId
                          Contexts persist in memory across Hand runs (cookies, login sessions)
  browser-tools.ts      — tool definitions registered in ToolRegistry
  __tests__/
    session-manager.test.ts
    browser-tools.test.ts
```

**Tool definitions:**

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to URL, return page title + status |
| `browser_read` | Extract visible text content from current page |
| `browser_click` | Click element by CSS selector or text |
| `browser_fill` | Fill form field by selector |
| `browser_screenshot` | Capture screenshot, return base64 PNG |
| `browser_close` | Close agent's browser session |

**Session lifecycle:**
- Sessions created lazily on first `browser_*` call per agent
- Sessions persist across Hand runs (login state, cookies, localStorage survive)
- Sessions destroyed on `browser_close` or `coastal-daemon` restart
- Each agent gets an isolated BrowserContext (no cookie sharing between agents)
- `coastal-daemon` registers `SIGTERM`/`SIGINT` handlers that call `BrowserSessionManager.closeAll()` before exit, ensuring all Playwright/Chromium subprocesses are terminated and no orphaned browser processes accumulate

---

## Subsystem A — Voice Pipeline

### Local-Only Stack

| Role | Library | Notes |
|------|---------|-------|
| Wake word | openWakeWord (Python subprocess) | Open source, runs locally, custom model support. Requires `python3-openwakeword` installed (included in CoastalOS `packages.list`). |
| STT | Whisper.cpp via `whisper-node` | Local, private, excellent accuracy |
| TTS | Piper TTS | Local, fast on CPU, multiple voice models |
| Audio I/O | PipeWire (Linux) / node-portaudio (Win/Mac) | PipeWire pre-installed on CoastalOS |
| VAD | Built into openWakeWord or `@ricky0123/vad-node` | Detects user speaking mid-response |

### Pipeline Flow

```
[Mic] → openWakeWord → "Hey Coastal" detected
  → Whisper.cpp: transcribe utterance → text
  → AgenticLoop.run() with streaming enabled
  → Tokens streamed to Piper TTS as sentences complete
  → Piper TTS → audio chunks → PipeWire playback

INTERRUPT PATH:
  User speaks mid-response
  → VAD fires → interrupt-handler.ts
  → activeBudget.abort() + activeSignal abort
  → AgenticLoop exits on next turn
  → Piper TTS playback stops
  → Pipeline re-enters wake-word listen mode
  → Agent processes new utterance from clean state
```

### Per-Agent Voice Identity

Each `agents/<id>/config.json` gains an optional field:
```json
{ "voiceModel": "en_US-lessac-medium" }
```

Piper `.onnx` model files shipped in CoastalOS image at `/opt/coastal/voices/`. CFO uses a different voice from General agent. Falls back to `espeak` (always present on Ubuntu) if model file missing.

### Voice is AUTONOMOUS-Tier Only

Voice pipeline activates only when `CC_TRUST_LEVEL=autonomous`. At SANDBOXED or TRUSTED, the daemon runs without voice (schedules and Hands still work, results delivered via WebSocket only).

### New Files

```
packages/daemon/src/voice/
  wake-word.ts          — openWakeWord binding via child process
  stt.ts                — whisper-node wrapper, returns transcript string
  tts.ts                — Piper TTS wrapper, per-agent voice model selection, espeak fallback
  audio.ts              — PipeWire mic capture + speaker playback (Linux); portaudio (Win/Mac)
  vad.ts                — voice activity detection, fires interrupt callback
  pipeline.ts           — state machine: idle → listening → transcribing → thinking → speaking
  interrupt-handler.ts  — VAD callback → abort active IterationBudget
  __tests__/
    pipeline.test.ts    — mock audio I/O, state machine transitions
    interrupt.test.ts   — abort propagation
    tts.test.ts         — espeak fallback path
```

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Architect diff fails tests | Branch deleted, pattern logged to `architect-log.db`, skip 24h |
| Architect proposes locked path | `config.ts` check rejects before applying, logs attempt |
| Browser session expired | Tool returns `"Error: session_expired"`, agent re-auths via `browser_fill` + `browser_click` |
| Whisper.cpp not on PATH | Voice pipeline logs warning, daemon continues without voice |
| Piper model file missing | Falls back to `espeak`, logs warning |
| `Ctrl+Alt+T` in kiosk | Cage intercepts shortcut → spawns Alacritty terminal |
| APT install via agent fails | Shell tool returns error string, agent reports to user, no silent retry |
| Ollama not running (architect) | Planner returns early, logs "Ollama unavailable", skips cycle |

---

## Testing Strategy

| Package | Key Tests |
|---------|-----------|
| `packages/architect` | Planner diff parsing, patcher on temp git repo, validator pass/fail, locked-path rejection, veto timer cancellation, SIGUSR2 signal delivery |
| `packages/ui` | New `ArchitectProposal` component (shows diff summary + veto button, auto-dismisses after 60s); new WebSocket event handlers for `architect_proposal` and `architect_applied` |
| `packages/core` (browser) | BrowserSessionManager isolation, trust tier gate (sandboxed = unavailable), tool definitions registered correctly |
| `packages/daemon` (voice) | Pipeline state transitions (mock streams), interrupt abort propagation, Piper → espeak fallback |
| `packages/shell` | Electron window creation (headless), IPC bridge |
| `coastalos/` | systemd unit syntax, packages.list completeness |

All audio tests use mock streams — no mic/speaker hardware needed in CI.

---

## Updated Project Structure

```
Coastal.AI/
├── agents/                    — per-agent config (Phase 1, + voiceModel field)
├── packages/
│   ├── core/                  — Fastify server + tools (+ browser/ tools)
│   ├── daemon/                — ProactiveScheduler + HandRunner + voice/
│   ├── architect/             — self-build loop (NEW)
│   ├── shell/                 — Electron Win/Mac wrapper (NEW)
│   └── ui/                    — React 19 + Vite + Tailwind v4
├── coastalos/                 — Ubuntu ISO build pipeline (NEW)
│   ├── build/
│   ├── systemd/
│   ├── installer/
│   └── grub/
└── docs/superpowers/specs/
```

---

## Phase Roadmap Update

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 APEX | ✅ Done | ShellBackend, trust tiers, daemon, Agent Hands, learning loop |
| **Phase 2** | **In progress** | coastal-architect, CoastalOS (systemd + labwc kiosk + browser tools + Electron shell + manual `build.sh` ISO), Voice Pipeline |
| Phase 3 | Planned | NamespaceBackend (Linux `unshare`, replaces Docker on CoastalOS), automated ISO CI/CD (GitHub Actions), APT repo (`apt.Coastal.AI.io`), Calamares installer polish |
| Phase 4 | Planned | ClawTeam swarm (HKUDS), session tools, boss fan-out |
| Phase 5 | Planned | Open source launch, cloud marketplaces |

**Phase 2 vs Phase 3 ISO scope:**
- Phase 2 ships: `coastalos/` directory, systemd units, labwc config, `build.sh` manual build script, Electron Win/Mac shell, basic Calamares config. A developer can build a working ISO by running `build.sh` locally.
- Phase 3 ships: Automated GitHub Actions ISO pipeline (builds + signs ISO on every release tag), NamespaceBackend (Linux-native sandbox), polished APT package, public APT repo.

---

*Generated: 2026-04-01*
*Approved by: John (Coastal Crypto)*
