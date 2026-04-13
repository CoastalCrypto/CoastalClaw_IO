# Coastal.AI APEX OS — Architecture Design Spec
**Date:** 2026-03-31
**Status:** Approved for implementation planning
**Scope:** Full Agent OS — application layer + OS distribution + self-improvement loop

---

## Vision

Coastal.AI is a self-improving, always-on Agent OS that runs your business 24/7,
talks to you in real-time, learns from every interaction, and rewrites its own code
when it finds a better way.

It ships as both a standalone application (Coastal.AI APEX) and as a full Linux
distribution (ClawOS) — an open-source Ubuntu-based operating system where
Coastal.AI is not an app, it is the OS.

---

## Competitive Landscape

| Capability               | AgenticCore | OpenFang | OpenClaw  | Hermes    | **Coastal.AI APEX** |
|--------------------------|-------------|----------|-----------|-----------|----------------------|
| Open source              | ✓           | ✓        | ✓         | ✓         | **✓**                |
| Full Linux distro        | ✓ (tiny)    | ✗        | ✗         | ✗         | **✓ Ubuntu LTS**     |
| Voice + wake word        | ✗           | ✗        | ✓         | ✗         | **✓**                |
| Full-duplex interruption | ✗           | ✗        | ✗         | ✗         | **✓**                |
| Self-builds own code     | ✗           | ✗        | ✗         | ✗         | **✓**                |
| Persistent skill learning| ✗           | ✗        | ✗         | ✓ partial | **✓ full loop**      |
| Multi-agent swarm        | ✗           | ✓        | partial   | partial   | **✓ + ClawTeam**     |
| Trust tier system        | ✗           | ✓        | partial   | partial   | **✓ 3 tiers**        |
| Visual desktop + voice   | ✗           | ✗        | ✗         | ✗         | **✓**                |
| Crypto/business native   | ✗           | ✗        | ✗         | ✗         | **✓ Coastal Crypto** |
| Ships as ISO + APT + AMI | ✗           | ✗        | ✗         | ✗         | **✓**                |

---

## System Architecture — Three Processes

```
┌─────────────────────────────────────────────────────────────────────┐
│                      coastal-server (Fastify)                       │
│                                                                     │
│  /api/chat  ·  /api/admin  ·  WebSocket  ·  Static UI (ClawShell)  │
│  ToolRegistry  ·  PermissionGate  ·  ActionLog  ·  AgentRegistry   │
│  ModelRouter  ·  UnifiedMemory  ·  McpAdapter                      │
│                                                                     │
│  ShellBackend (pluggable):                                          │
│    SANDBOXED  → NamespaceBackend (Linux unshare) / DockerBackend   │
│    TRUSTED    → RestrictedLocalBackend (path allowlist)            │
│    AUTONOMOUS → NativeBackend (full shell)                         │
│    FUTURE     → WasmBackend · SshBackend · DaytonaBackend          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ IPC: Unix socket (ClawOS) / named pipe (Win)
┌───────────────────────────┴─────────────────────────────────────────┐
│                      coastal-daemon                                 │
│                                                                     │
│  VoicePipeline:                                                     │
│    WakeWordDetector  →  STT (Whisper local / OpenAI Whisper API)   │
│    AgenticLoop (streaming tokens)                                   │
│    TTS (ElevenLabs primary / MOSS-TTS local fallback)              │
│    AudioPlayback  →  InterruptHandler (stop signal propagation)    │
│                                                                     │
│  ProactiveScheduler:                                                │
│    NL schedule parser ("daily at 8am" → cron)                      │
│    EventBus: email · price alerts · file changes · calendar        │
│    AgentHand runner → fires AgenticLoop without user message        │
│                                                                     │
│  SessionBroker:                                                     │
│    sessions_create · sessions_send · sessions_history · sessions_join│
└───────────────────────────┬─────────────────────────────────────────┘
                            │ git branch + ESM hot-reload
┌───────────────────────────┴─────────────────────────────────────────┐
│                      coastal-architect                              │
│                                                                     │
│  Runs nightly (or on trigger from skill-gaps.db)                   │
│  1. Read own codebase (packages/core/src/**)                       │
│  2. Read ActionLog + skill-gaps.db for failure patterns            │
│  3. Propose ONE targeted improvement                               │
│  4. Write to branch: feature/self-improve-YYYYMMDD                 │
│  5. Run: pnpm test                                                  │
│  6a. PASS → hot-reload ESM modules → merge branch → notify user    │
│  6b. FAIL → delete branch → log → skip until next cycle            │
│                                                                     │
│  On ClawOS: can also run apt upgrade, systemctl daemon-reload,     │
│  update own kernel params, propose PRs to open-source project      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1 — Pluggable Shell Execution Backends

Every `run_command` call routes through a `ShellBackend` interface. Trust tier selects the backend at startup — no runtime switching without user confirmation.

```typescript
interface ShellBackend {
  execute(cmd: string, workdir: string, sessionId: string): Promise<ShellResult>
  isAvailable(): Promise<boolean>
  name: string
}
```

| Backend              | Trust Tier    | Technology                          | Platform       |
|----------------------|---------------|--------------------------------------|----------------|
| `NamespaceBackend`   | SANDBOXED     | Linux `unshare` + cgroups v2         | ClawOS only    |
| `DockerBackend`      | SANDBOXED     | Docker per-session Alpine container  | Windows / Mac  |
| `RestrictedLocal`    | TRUSTED       | Node child_process + path allowlist  | All            |
| `NativeBackend`      | AUTONOMOUS    | Full shell, no restrictions          | All            |
| `WasmBackend`        | Future        | WASM dual-metered sandbox + watchdog | All            |
| `SshBackend`         | Future        | Remote VPS / cloud execution         | All            |

**NamespaceBackend** (ClawOS native — superior to Docker):
```bash
unshare --mount --pid --net --uts --ipc \
  --map-root-user \
  -- chroot /opt/coastal/sandbox \
  /bin/sh -c "<command>"
```
Same kernel-level isolation as Docker, zero daemon overhead, instant startup.

---

## Layer 2 — Trust Tier System

Stored in `config.agentTrustLevel`. Promoted in the admin UI with explicit user confirmation. Each tier enables the next set of capabilities cumulatively.

```
SANDBOXED (default for new installs)
  Shell:    NamespaceBackend or DockerBackend
  Scope:    /workspace/session/<id> only
  Daemon:   Disabled
  Voice:    Disabled
  Architect: Disabled
  Network:  SSRF blocklist enforced, no internal addresses

TRUSTED (user unlocks — one admin UI action)
  Shell:    RestrictedLocalBackend, path allowlist
  Scope:    config.agentWorkdir + read-only host paths
  Daemon:   Enabled (schedules run, no voice yet)
  Voice:    Disabled
  Architect: Disabled (can propose only, cannot apply)
  Config:   Agents can read/write their own SYSTEM.md + config.json

AUTONOMOUS (user explicitly enables — separate confirmation)
  Shell:    NativeBackend (full host access)
  Scope:    Entire filesystem
  Daemon:   Enabled + voice pipeline active + wake word listening
  Voice:    Full-duplex with interrupt propagation
  Architect: Full self-build loop active
  Proactive: Agents can interrupt user mid-task
  Self-optimize: Can write own configs, run apt/pnpm updates (ClawOS)
```

**Defense layers apply at ALL tiers** (OpenFang-inspired):
- ActionLog: tamper-evident audit trail of every tool execution
- PermissionGate: non-reversible tools require approval
- SSRF blocklist: private IP ranges blocked on `http_get`
- Path traversal prevention: `..` sequences sanitized
- IterationBudget: prevents runaway agent loops (max 90 iterations default)
- Interrupt propagation: parent stop signal cancels all child AgenticLoop instances

---

## Layer 3 — Always-On Daemon with Agent Hands

`coastal-daemon` runs as a systemd service (ClawOS) or background process (Windows/Mac).

Each agent in the registry can declare a **Hand** — an autonomous capability package:

```json
// agents/cfo/config.json
{
  "id": "cfo",
  "name": "CFO Agent",
  "domain": "finance",
  "tools": ["read_file", "query_db", "http_get", "write_file"],
  "hand": {
    "enabled": true,
    "schedule": "daily at 08:00",
    "triggers": [
      "email from @coastalcrypto.info",
      "price_alert BTC > 5%",
      "file_change /workspace/financials/"
    ],
    "goal": "Monitor P&L, flag anomalies, send morning brief via voice"
  }
}
```

The `ProactiveScheduler` parses `schedule` with the LLM (natural language → cron expression), registers the job, and fires `AgenticLoop` without a user message. Results are pushed via:
- WebSocket notification → ClawShell UI
- Voice announcement (Autonomous tier)
- Email/Telegram (configured channels)

**IterationBudget** (Hermes-inspired): each Hand run gets an independent budget (default 30 iterations). Child agents spawned by a Hand share the parent's remaining budget. Budget exhaustion stops the run gracefully and logs to `skill-gaps.db`.

---

## Layer 4 — Voice Pipeline with Full-Duplex Interruption

```
[Hardware mic] → PipeWire/PulseAudio → coastal-daemon
    ↓
WakeWordDetector ("Hey Coastal")
    ↓
STT: Whisper.cpp (local, private) | OpenAI Whisper API (cloud option)
    ↓
AgenticLoop (streaming tokens via IPC to daemon)
    ↓
TTS: ElevenLabs (primary, high quality) | MOSS-TTS (local fallback, private)
    ↓
[Hardware speakers] → audio playback

INTERRUPT PATH:
User speaks mid-response
    → WakeWordDetector or VAD (voice activity detection) fires
    → InterruptHandler sends SIGSTOP to AgenticLoop + all child agents
    → Agent acknowledges: "Got it, what do you need?"
    → Resumes from new user input
```

**Voice identity**: each agent has a distinct ElevenLabs voice ID. The CFO sounds different from the General agent. Users know who's speaking without visual reference.

---

## Layer 5 — Multi-Agent Swarm with Session Tools

The existing `ModelRouter.cascade` becomes the **Boss Agent**. New session tools enable agents to coordinate:

```typescript
// Added to ToolRegistry at TRUSTED+ tier
sessions_create  — spawn new AgentSession with given agent type + initial message
sessions_send    — send message to a running session by ID
sessions_history — read another session's conversation history
sessions_join    — subscribe to another session's token stream in real-time
sessions_list    — enumerate all active sessions
```

**ClawTeam pattern** (Phase 4, HKUDS-inspired):
User sends one message → Boss Agent fans out to specialists in parallel → each specialist works in its own session → Boss merges results → single coherent response delivered to user.

```
User: "Give me a full business review"
    → Boss routes to: [CFO, ProductManager, SystemIntegrator] in parallel
        CFO:              P&L analysis (runs in session-A)
        ProductManager:   Product roadmap status (runs in session-B)
        SystemIntegrator: System health check (runs in session-C)
    → Boss: merges all three → delivers unified report + voice summary
```

---

## Layer 6 — Persistent Learning + Automatic Skill Creation

After every completed `AgenticLoop` run, a **background review thread** (Hermes-inspired) inspects the conversation without blocking the response:

1. Did the agent invent a multi-step approach it will need again?
   → Automatically creates a new Hand config in `agents/<domain>/hands/<name>.json`

2. Did a tool call fail in a recognizable pattern?
   → Logs to `skill-gaps.db` with the failure signature for `coastal-architect` to review

3. Did the user correct the agent mid-conversation?
   → Appends constraint to `agents/<domain>/SYSTEM.md`: `"LEARNED 2026-03-31: user prefers X over Y"`

4. Did this session produce a reusable prompt pattern?
   → Registers it in `agents/shared/patterns.db` for all agents to reference

`mem0` (already integrated) handles cross-session recall. Skills and constraints accumulate automatically — the agents get better at their jobs without any user configuration.

---

## Layer 7 — Self-Build Loop (The Differentiator)

`coastal-architect` is a process that runs nightly (or triggered by `skill-gaps.db` reaching a threshold):

```
1. Read codebase:  packages/core/src/**  (own source)
2. Read evidence:  skill-gaps.db + ActionLog (what's breaking, what's slow)
3. Propose change: ONE targeted improvement per cycle
   Examples:
     - "Tool X fails 40% of the time with args Y — fix input validation"
     - "Agents repeatedly ask for Z but no tool exists — create it"
     - "PermissionGate takes 200ms — optimize the SQL query"
4. Write branch:   git checkout -b feature/self-improve-YYYYMMDD
5. Implement:      writes/edits the identified file(s)
6. Test:           pnpm test --filter=@coastal/core
7a. PASS:
     - Hot-reload changed ESM modules (Node 22 --experimental-vm-modules)
     - git merge --no-ff feature/self-improve-YYYYMMDD
     - Log: "Architect improved X — test coverage +N%, latency -Nms"
     - Notify user via ClawShell + voice (Autonomous tier)
7b. FAIL:
     - git branch -D feature/self-improve-YYYYMMDD
     - Log failure signature to architect-log.db
     - Skip this pattern until next cycle
8. (ClawOS only):
     - Can also run: apt upgrade --only-upgrade Coastal.AI-*
     - Can update: systemd service files + daemon-reload
     - Can propose: PRs to the public Coastal.AI GitHub repo
```

**Safety constraints on self-build:**
- Never modifies `coastal-architect` itself (prevents recursive self-modification without review)
- Never modifies auth, PermissionGate, or ActionLog (security-critical paths are locked)
- All changes go through the test suite — no test pass = no merge
- Full git history is the audit trail — every self-improvement is a signed commit
- User can disable with one toggle in admin UI

---

## Layer 8 — ClawShell Visual Desktop UI

ClawOS boots into **ClawShell** — a lightweight Electron or browser-kiosk application (not GNOME/KDE) that renders the existing React frontend in fullscreen:

```
┌─────────────────────────────────────────────────────────────────┐
│ Coastal.AI OS                              🔴 LIVE  09:14 AM   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  CFO Agent   │  │   General    │  │ Product Mgr  │          │
│  │  ● Active    │  │  ● Listening │  │   ○ Idle     │          │
│  │  Finance     │  │  All domains │  │  Roadmap     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  09:14  CFO: "Morning brief ready. P&L up 3.2% WoW."     │  │
│  │  09:12  Daemon: BTC alert fired (+5.1%) — CFO notified   │  │
│  │  09:08  Architect: "Improved query_db latency by 40ms"   │  │
│  │  08:00  CFO Hand: Daily brief generated                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────┐                           │
│  │  🎤  [Hold to speak / wake word] │   [📋 Tasks]  [⚙️ Admin] │
│  └──────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

ClawShell communicates with `coastal-server` over localhost WebSocket — the same connection the browser-based UI uses. No new backend code required for the desktop UI.

---

## ClawOS Distribution

### Base: Ubuntu 24.04 LTS (Noble Numbat)
Chosen for: 5-year LTS support, widest hardware compatibility, large package ecosystem, Canonical's AI tooling investment.

### Build toolchain
- **Cubic** or **live-build** for ISO generation (CI/CD pipeline produces new ISO on each release)
- **Calamares** graphical installer (installs ClawOS onto hardware from USB)
- **GitHub Actions** builds and signs ISOs on every release tag

### Pre-installed
```
Node.js 22 LTS          — coastal-server, coastal-daemon, coastal-architect
pnpm                    — package management
Ollama                  — local LLM inference (models downloaded on first boot)
Whisper.cpp             — local STT (voice privacy by default)
MOSS-TTS                — local TTS fallback
PipeWire                — audio pipeline
nginx                   — reverse proxy for web dashboard
git                     — version control (required for self-build loop)
curl, wget, jq, htop    — system utilities for agents
```

### systemd services (auto-start on boot)
```ini
coastal-server.service      — API + WebSocket (port 18789)
coastal-daemon.service      — voice + proactive agents
coastal-architect.service   — self-build loop (nightly timer)
ollama.service              — local LLM server
```

### Distribution formats
| Format         | Command / URL                                | Target                          |
|----------------|----------------------------------------------|---------------------------------|
| **ISO**        | Download from releases.Coastal.AI.io        | Dedicated hardware, USB install |
| **OVA/VMDK**   | Download + import to VirtualBox / VMware     | Windows / Mac developers        |
| **APT package**| `apt install Coastal.AI`                    | Existing Ubuntu servers         |
| **Cloud AMI**  | AWS Marketplace / GCP Marketplace            | Cloud-hosted agent servers      |
| **Docker image**| `docker run Coastal.AI/apex`               | Development, Windows users      |

---

## Agent Directory Structure

```
agents/
  cfo/
    SYSTEM.md          — persona, expertise, constraints (auto-updated by learning loop)
    config.json        — tools, hand schedule, triggers
    hands/             — auto-generated reusable Hand configs
  general/
    SYSTEM.md
    config.json
  product_manager/
    SYSTEM.md
    config.json
  shared/
    patterns.db        — cross-agent learned prompt patterns
    skill-gaps.db      — failure patterns → architect input
    self-build.log     — architect improvement history
```

---

## Phase Roadmap

### Phase 1 — Coastal.AI APEX (current session target)
- [ ] Pluggable `ShellBackend` interface replacing `execSync` in `shell.ts`
- [ ] `DockerBackend` implementation (Windows/Mac sandbox)
- [ ] `NativeBackend` implementation (Autonomous tier)
- [ ] Trust tier config in `config.ts` + admin UI toggle
- [ ] `PermissionGate` extended with tier-aware checks
- [ ] `coastal-daemon` process scaffold (IPC channel + ProactiveScheduler)
- [ ] Per-agent `config.json` + `SYSTEM.md` in `agents/` directory
- [ ] Agent Hand runner (fires AgenticLoop on schedule)
- [ ] `IterationBudget` tracker in `AgenticLoop`
- [ ] Interrupt propagation (parent → child agent stop signal)
- [ ] Background review thread (post-loop learning)
- [ ] `skill-gaps.db` failure pattern logging

### Phase 2 — Voice + Self-Build
- [ ] `VoicePipeline` in `coastal-daemon` (wake word + STT + TTS)
- [ ] Full-duplex interrupt handler
- [ ] `coastal-architect` process (self-build loop)
- [ ] ESM hot-reload for self-improved modules
- [ ] Per-agent voice identity (ElevenLabs voice IDs)
- [ ] ClawShell desktop UI (Electron kiosk)

### Phase 3 — ClawOS
- [ ] Ubuntu 24.04 LTS base + systemd services
- [ ] `NamespaceBackend` (Linux unshare, replaces Docker on ClawOS)
- [ ] Cubic/live-build ISO build pipeline (GitHub Actions)
- [ ] Calamares installer
- [ ] First public ISO release

### Phase 4 — ClawTeam Swarm
- [ ] Session tools (`sessions_create/send/history/join/list`)
- [ ] Boss Agent fan-out / merge pattern
- [ ] HKUDS ClawTeam integration
- [ ] Parallel multi-agent execution with shared IterationBudget

### Phase 5 — Open Source Launch
- [ ] Public GitHub release under MIT license
- [ ] APT repository (apt.Coastal.AI.io)
- [ ] AWS / GCP Marketplace listings
- [ ] `coastal-architect` submits self-improvement PRs to public repo

### Phase 6 — Hardware Profiles + Edge AI Devices
- [ ] Pluggable LLM inference backend interface (mirrors ShellBackend pattern)
- [ ] `OllamaBackend` — current, easy setup (default)
- [ ] `PowerInferBackend` — sparse hot/cold neuron inference, 175B+ on consumer GPU
- [ ] `LlamaCppBackend` — direct GGUF, edge-optimized, zero daemon overhead
- [ ] Hardware profile config (`hardwareProfile`, `inferenceBackend`, `unifiedMemoryGb`)
- [ ] ClawOS ARM64 build pipeline (Tiiny AI Pocket Lab, Jetson AGX Orin, Apple Silicon)
- [ ] ClawOS x86_64 Infplane Hilbert optimized build
- [ ] Auto-detection: reads hardware spec at boot, selects optimal inference backend
- [ ] Sparse activation flags: `sparseActivation: true` maps to PowerInfer TurboSparse
- [ ] Target: 120B model on Tiiny AI Pocket Lab (80GB unified memory, $1,399)
- [ ] Target: 260B model on next-gen unified memory devices (160GB+, ~2027)

---

## Layer 9 — Pluggable LLM Inference Backends (Phase 6)

The same pluggability pattern used for ShellBackend applies to LLM inference. `ModelRouter` gains an `InferenceBackend` interface:

```typescript
interface InferenceBackend {
  readonly name: string
  isAvailable(): Promise<boolean>
  chat(model: string, messages: ChatMessage[], tools: ToolDefinition[]): Promise<ChatResponse>
  listModels(): Promise<string[]>
}
```

| Backend           | Hardware Target                       | Max Model Size | Notes                                  |
|-------------------|---------------------------------------|----------------|----------------------------------------|
| `OllamaBackend`   | Any (current default)                 | ~70B           | Easy setup, HTTP API                   |
| `PowerInferBackend` | RTX 4090 + large RAM                | 175B–260B+     | Sparse inference, hot/cold neuron split|
| `LlamaCppBackend` | CPU / unified memory / edge devices  | 120B+ (Q4)     | Direct GGUF, ARM64 optimized           |
| `VllmBackend`     | Multi-GPU server                      | 405B+          | Batched inference, high throughput     |

Hardware profile in `config.json`:
```json
{
  "hardwareProfile": "tiinyai-pocket-lab",
  "inferenceBackend": "powerinfer",
  "unifiedMemoryGb": 80,
  "sparseActivation": true,
  "maxModelParams": "120b",
  "modelBits": 4
}
```

---

## Edge Device Targets

| Device                    | Memory       | AI Compute  | Max Model  | ClawOS Build  | Status       |
|---------------------------|-------------|-------------|------------|---------------|--------------|
| **Tiiny AI Pocket Lab**   | 80GB LPDDR5X | 190 TOPS    | 120B       | ARM64         | Available now ($1,399) |
| **Infplane Hilbert**      | TBD          | Server-grade | 200B+     | x86_64        | 2026         |
| **NVIDIA DGX Spark**      | 128GB unified | 1 PFLOP    | 200B       | x86_64        | Available now |
| **Ryzen AI Max+ mini-PC** | 96–128GB     | ~100 TOPS   | 100–120B  | x86_64        | Available now |
| **Next-gen Tiiny AI**     | 160GB+       | 300+ TOPS   | 260B       | ARM64         | ~2027        |

**The pocket vision:** A Tiiny AI Pocket Lab in your pocket — your entire Coastal Crypto AI team (CFO, CTO, Product Manager) running locally on a 300g device. No cloud. No subscription. No data leaving your hands. Voice conversations via earbuds. 120B model. $1,399.

PowerInfer's TurboSparse technique (starred by CoastalCrypto) is the key enabler: by computing only activated neurons per token, it runs 175B models on 24GB VRAM via hot/cold neuron splitting — making 260B feasible on 80GB unified memory with Q4 quantization.

---

## What Makes This the Best in Class

1. **First open-source AI OS with a full self-build loop** — agents that improve their own code
2. **First to combine voice + full-duplex interruption + visual desktop** in a single open-source project
3. **Trust tiers** let it serve both paranoid and power users from the same codebase
4. **Native Linux namespaces** on ClawOS give better isolation than Docker with zero overhead
5. **Pluggable shell + inference backends** — same architecture on Windows, Mac, ClawOS, Tiiny AI, DGX Spark
6. **Ships as ISO + APT + AMI + Docker + ARM64** — widest distribution of any agent OS project
7. **Coastal Crypto native** — CFO, trading, and crypto domain knowledge built in from day one
8. **Pocket AI company** — 120B model, 300g device, zero cloud dependency, always-on voice team

---

*Generated by Coastal.AI brainstorming session 2026-03-31*
*Approved by: John (CoastalCrypto)*
