<p align="center">
  <img src="assets/banner.png" alt="CoastalClaw" width="100%"/>
</p>

<p align="center">
  <strong>A self-improving AI Agent OS — runs on your hardware, your data never leaves.</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#%EF%B8%8F-configuration">Configuration</a> ·
  <a href="#-api-reference">API</a> ·
  <a href="#-security">Security</a> ·
  <a href="#-roadmap">Roadmap</a>
</p>

---

## What is CoastalClaw?

CoastalClaw is an open-source **AI Agent Operating System** you deploy on your own hardware. It's not a chatbot — it's a self-improving OS that runs your business 24/7: real-time voice, autonomous scheduled agents, a multi-agent swarm, and a self-build loop that patches and improves its own code.

**You configure it.** Set your agent's name, personality, and org context once. Every agent in the system — COO, CFO, CTO, and your primary assistant — knows who it's working for.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Generic Agent Persona** | Name your agent, set its personality, describe your org. Stored in SQLite, injected into every soul at render time. Configure via API or setup wizard. |
| **Intelligent Model Routing** | Two-stage cascade: tiny ONNX classifier first, LLM fallback only when needed. Routes by domain (COO / CFO / CTO / General) and urgency. |
| **AI Executive Suite** | Virtual COO, CFO, and CTO — domain specialists that remember context across sessions and fire autonomously on schedule. |
| **Multi-Agent Swarm** | BossAgent decomposes complex tasks into parallel subtasks, fans out to specialist agents, synthesizes a unified reply. |
| **VibeVoice Pipeline** | Wake word → VibeVoice ASR (diarization + timestamps) → agent → streaming TTS. Falls back to whisper-cpp + piper on CPU. |
| **Self-Build Loop** | `coastal-architect` nightly loop reads its own source, proposes improvements, runs tests, and opens PRs automatically. MetaAgent archives every iteration. |
| **NamespaceBackend** | Linux `unshare` + overlayfs + cgroups v2 sandbox — no Docker daemon needed on ClawOS. Auto-detected on Linux, falls back to DockerBackend elsewhere. |
| **Three Inference Backends** | Lazy probe order: vLLM (GPU, fastest) → AirLLM (layer-stream, big models on small VRAM) → Ollama (CPU fallback). Zero config required. |
| **Infinity Hybrid Search** | Dense + sparse + full-text vector search via Infinity DB. Falls back to SQLite LIKE when Infinity isn't running. |
| **Lossless Memory** | Every message stored in SQLite. Older entries promoted to Mem0 personalization before they leave the context window. |
| **Trust Tiers** | `sandboxed` (Docker) → `trusted` (restricted shell) → `autonomous` (full host). Change at runtime. |
| **Agent Hands** | Agents fire on NL schedules ("daily at 08:00") or event triggers — no user required. |
| **Proactive Suggestions** | After every reply, a background thread predicts what you'll need next. |
| **Privacy First** | Entirely local inference. No external API required. All data on your hardware. |

---

## 🏗 Architecture

CoastalClaw runs as three cooperating processes:

```
┌────────────────────────────────────────────────────────────────────┐
│  coastal-server  (packages/core :4747)                             │
│                                                                    │
│  PersonaManager ──► AgentSession (soul template interpolation)    │
│                                                                    │
│  CascadeRouter ──► DomainClassifier ──► AgentRegistry             │
│       │                                      │                    │
│  TinyRouter (ONNX)              AgenticLoop ◄─┘                    │
│       │                              │                            │
│  ModelRouter                   PermissionGate                     │
│    vLLM → AirLLM → Ollama          │                             │
│                              ToolRegistry                          │
│                                    │                              │
│                              ShellBackend                          │
│                     Namespace / Docker / Local                     │
│                                                                    │
│  UnifiedMemory + InfinityClient    BossAgent + TeamChannel        │
│  ├── LosslessAdapter (SQLite)      MetaAgent (self-improve)       │
│  └── Mem0Adapter + SemanticSearch                                 │
│                                                                    │
│  POST /api/persona  ·  POST /api/chat  ·  POST /api/team/run      │
└──────────────┬─────────────────────────────────────────────────────┘
               │  REST + WebSocket (:4747)
    ┌──────────┼──────────┐
    │          │          │
┌───┴──────┐ ┌─┴──────────┴──────────────────────┐
│ Web UI   │ │  coastal-daemon                    │
│ React 19 │ │  ProactiveScheduler (NL cron)      │
│ Tailwind │ │  HandRunner (HTTP POST to /api/chat│
│ Vite 5   │ │  VibeVoiceClient (streaming voice) │
└──────────┘ └───────────────────────────────────┘
```

### Trust Tiers

| Tier | Backend | What agents can do |
|------|---------|--------------------|
| `sandboxed` (default) | `DockerBackend` or `NamespaceBackend` (Linux) | Isolated container, workspace-only |
| `trusted` | `RestrictedLocalBackend` | Host shell, workspace directory only |
| `autonomous` | `NativeBackend` | Unrestricted host shell |

### Inference Backend Probe Order

```
Start request
    │
    ▼
vLLM available?  ──yes──► GPU inference (fastest, full VRAM)
    │ no
    ▼
AirLLM available? ──yes──► Layer-stream (70B on 4GB VRAM)
    │ no
    ▼
Ollama (always available, CPU fallback)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 22+, pnpm 9+
- [Ollama](https://ollama.com) running locally — `ollama pull llama3.2`
- Docker (optional — required for `sandboxed` tier on non-Linux)

### 1. Install

```bash
git clone https://github.com/CoastalCrypto/CoastalClaw_IO.git
cd CoastalClaw_IO
pnpm install
```

### 2. Configure

```bash
cp packages/core/.env.example packages/core/.env.local
```

Minimal config:
```env
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.2
CC_TRUST_LEVEL=sandboxed
```

### 3. Run

```bash
# Terminal 1 — core API server
node packages/core/dist/main.js
# → http://127.0.0.1:4747

# Terminal 2 — web UI
cd packages/web && pnpm dev
# → http://localhost:5173

# Terminal 3 — autonomous daemon (optional)
node packages/daemon/dist/index.js
```

### 4. Set up your agent

Open `http://localhost:5173` and complete the setup wizard — name your agent, describe your org, set a personality. This hits `PUT /api/persona` and configures every agent in the system.

Or set directly via API:
```bash
curl -X PUT http://localhost:4747/api/persona \
  -H "Content-Type: application/json" \
  -d '{
    "agentName": "JARVIS",
    "agentRole": "Executive Assistant",
    "personality": "Direct and concise. Lead with data. No filler.",
    "orgName": "Stark Industries",
    "orgContext": "Engineering and defense contractor. 12,000 employees.",
    "ownerName": "Tony"
  }'
```

---

## 🎭 Agent Persona

Every agent soul is a template. Configure once, applied everywhere.

| Field | What it does |
|-------|-------------|
| `agentName` | What your primary agent calls itself |
| `agentRole` | One-line role (e.g. "Executive Assistant") |
| `personality` | Free-text personality traits injected into the system prompt |
| `orgName` | Organization name — injected into all agent souls |
| `orgContext` | 2–4 sentence org description all agents share |
| `ownerName` | Your name — agents use this to address you |

Defaults ship as `"Assistant"` / `"Your Organization"` — functional immediately, nudges you to configure.

---

## 🤖 Agent Hands

Agents fire autonomously on schedules or event triggers:

```json
{
  "id": "cfo",
  "hand": {
    "enabled": true,
    "schedule": "daily at 08:00",
    "triggers": ["price_alert BTC > 5%"],
    "goal": "Review overnight P&L and prepare morning briefing."
  }
}
```

Schedule formats: `"daily at 08:00"`, `"every 2h"`, `"weekly on monday"`, raw cron `"0 8 * * *"`.

---

## 🐝 Multi-Agent Swarm

```bash
curl -X POST http://localhost:4747/api/team/run \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze Q2 financials and prepare a board summary"}'
```

BossAgent decomposes the task, fans out to COO/CFO/CTO in parallel, synthesizes a single reply. All sub-agent messages flow through `TeamChannel`.

---

## ⚙️ Configuration

### Core environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_PORT` | `4747` | API server port |
| `CC_HOST` | `127.0.0.1` | Bind address |
| `CC_DATA_DIR` | `./data` | SQLite, persona, admin token, registry |
| `CC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `CC_DEFAULT_MODEL` | `llama3.2` | Fallback when routing fails |
| `CC_TRUST_LEVEL` | `sandboxed` | `sandboxed` \| `trusted` \| `autonomous` |
| `CC_AGENT_WORKDIR` | `./data/workspace` | Agent sandbox root |
| `CC_VLLM_URL` | `http://127.0.0.1:8000` | vLLM endpoint (auto-probed) |
| `CC_AIRLLM_URL` | `http://127.0.0.1:8002` | AirLLM endpoint (auto-probed) |
| `CC_INFINITY_URL` | `http://127.0.0.1:23817` | Infinity vector DB (auto-probed) |
| `CC_VIBEVOICE_URL` | `http://127.0.0.1:8001` | VibeVoice ASR+TTS (auto-probed) |
| `CC_CORS_ORIGINS` | `localhost:5173` | Comma-separated allowed CORS origins |
| `CC_VRAM_BUDGET_GB` | `24` | VRAM ceiling for quant selection |
| `MEM0_API_KEY` | — | Optional Mem0 API key |

---

## 🔒 Security

### Admin authentication

```bash
# 1. Get a session token (24h TTL)
curl -X POST http://localhost:4747/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"token": "<your-admin-token>"}'
# → {"sessionToken": "..."}

# 2. Use it on all admin endpoints
curl http://localhost:4747/api/admin/models \
  -H "x-admin-session: <sessionToken>"
```

Admin token is auto-generated on first run at `CC_DATA_DIR/.admin-token`.

### Production checklist

- [ ] Set `CC_CORS_ORIGINS` to your domain
- [ ] Run behind nginx/caddy with TLS
- [ ] Set `CC_ADMIN_TOKEN` to `openssl rand -hex 32`
- [ ] Keep `CC_OLLAMA_URL` on localhost
- [ ] Start with `sandboxed` trust tier
- [ ] Put `CC_DATA_DIR` on encrypted storage

---

## 📡 API Reference

### Persona

```
GET  /api/persona          → { persona, configured }
PUT  /api/persona          → { persona, configured }
```

### Chat

```
POST /api/chat
{ "message": "...", "sessionId": "optional-uuid" }
→ { "sessionId": "...", "reply": "...", "domain": "cfo" }
```

### Team (multi-agent)

```
POST /api/team/run
{ "task": "..." }
→ { "reply": "...", "subtaskCount": 3, "subtasks": [...] }
```

### Admin (require `x-admin-session`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Exchange token for session |
| `GET` | `/api/admin/models` | List installed models |
| `POST` | `/api/admin/models/add` | Start quantization pipeline |
| `DELETE` | `/api/admin/models/:id` | Remove model variant |
| `GET` | `/api/admin/registry` | Domain-model assignments |
| `PATCH` | `/api/admin/registry` | Update assignments |
| `GET/PATCH` | `/api/admin/trust-level` | Get/set trust tier |

### WebSocket

```
ws://localhost:4747/ws/session
→ { "type": "register", "sessionId": "..." }

Events:
{ "type": "proactive_suggestion", "suggestion": "..." }
{ "type": "approval_request", "approvalId": "...", "toolName": "...", "cmd": "..." }
{ "type": "quant_progress", "step": 3, "total": 11, "message": "..." }
```

---

## 🧪 Testing

```bash
pnpm test                              # all packages
pnpm --filter @coastal-claw/core test  # 197 tests
pnpm --filter @coastal-claw/daemon test
MOCK_NAMESPACE=1 pnpm test            # skip real Linux namespace tests
```

---

## 🗺 Roadmap

| Phase | Status | Tag | What shipped |
|-------|--------|-----|-------------|
| Foundation | ✅ | `v0.1.0-phase1` | CascadeRouter, LosslessMemory, model quant pipeline, web portal |
| APEX OS | ✅ | `v0.2.0-phase1-apex` | ShellBackend tiers, trust system, Agent Hands, daemon, skill-gaps loop |
| CoastalOS | ✅ | `v0.3.0-phase2-coastalos` | Voice pipeline, architect self-build, Electron kiosk |
| ClawOS Native | ✅ | `v0.4.0-phase3-clawos` | NamespaceBackend, VllmClient, ISO build + GitHub Actions CI |
| ClawTeam | ✅ | `v0.5.0-phase4-clawteam` | AirLLM, Infinity, VibeVoice, BossAgent swarm, MetaAgent, generic persona |
| **Launch** | 🔜 | `v1.0.0` | APT repo, cloud AMI, open source, public docs |

---

## 📂 Project Structure

```
CoastalClaw_IO/
├── agents/                     # Per-agent config (runtime overrides)
│   ├── cfo/config.json + SYSTEM.md
│   └── coo/ cto/ general/ ...
├── packages/
│   ├── core/                   # Fastify API server (:4747)
│   │   └── src/
│   │       ├── main.ts         # Server entry point
│   │       ├── lib.ts          # Side-effect-free library exports
│   │       ├── persona/        # PersonaManager — configurable agent identity
│   │       ├── agents/         # AgenticLoop, BossAgent, MetaAgent, TeamChannel
│   │       │   └── souls/      # Soul templates with {{persona.*}} tokens
│   │       ├── models/         # ModelRouter (vLLM→AirLLM→Ollama), AirLLMClient, VllmClient
│   │       ├── memory/         # UnifiedMemory + InfinityClient hybrid search
│   │       ├── voice/          # VibeVoiceClient
│   │       ├── tools/backends/ # Namespace / Docker / RestrictedLocal / Native
│   │       └── api/routes/     # chat, persona, team, admin, agents
│   ├── daemon/                 # coastal-daemon: voice + proactive scheduler
│   ├── architect/              # Self-build loop: Planner, Patcher, Validator
│   ├── shell/                  # Electron kiosk (ClawShell)
│   └── web/                    # React 19 + Tailwind + Vite
├── coastalos/                  # ClawOS ISO build
│   ├── build/                  # live-build config, packages.list, post-install.sh
│   ├── systemd/                # All service units
│   └── vibevoice/              # Python FastAPI VibeVoice service
├── docs/superpowers/           # Design specs and implementation plans
└── .github/workflows/          # ISO build + QEMU smoke test CI
```

---

## 🙏 Open Source Inspirations

| Project | How we use it |
|---------|--------------|
| **[Ollama](https://github.com/ollama/ollama)** | Local inference engine |
| **[Fastify](https://github.com/fastify/fastify)** | HTTP/WebSocket server |
| **[vLLM](https://github.com/vllm-project/vllm)** | GPU-accelerated inference |
| **[AirLLM](https://github.com/lyogavin/airllm)** | Layer-streaming inference for large models |
| **[Infinity](https://github.com/infiniflow/infinity)** | Hybrid vector database |
| **[llama.cpp](https://github.com/ggerganov/llama.cpp)** | GGUF quantization engine |
| **[Mem0](https://github.com/mem0ai/mem0)** | Personalized memory layer |
| **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** | Synchronous SQLite driver |
| **[HyperAgents](https://arxiv.org/abs/2603.19461)** | MetaAgent self-improvement pattern |

---

## 🤝 Contributing

1. Fork the repo
2. `git checkout -b feat/your-feature`
3. `pnpm test` — keep it green
4. Open a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
