<p align="center">
  <img src="assets/banner.png" alt="Coastal Claw" width="100%"/>
</p>

<p align="center">
  <strong>A self-improving AI Agent OS — running on your hardware, your data never leaves the facility.</strong>
</p>

<p align="center">
  <a href="https://docs.coastalcryptomining.com"><strong>📖 Documentation</strong></a> ·
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-features">Features</a> ·
  <a href="#%EF%B8%8F-configuration">Configuration</a> ·
  <a href="#-security">Security</a> ·
  <a href="#-roadmap">Roadmap</a>
</p>

---

## What is Coastal Claw?

Coastal Claw is an AI **Agent Operating System** built by [Coastal Crypto](https://coastalcryptomining.com). It's not just an agent chatbot — it's a self-improving, always-on OS that runs your business 24/7, with real-time voice, proactive Agent Hands, and a self-build loop that can fix and improve itself.

The **AI Executive Suite** — virtual COO, CFO, and CTO agents — works like a real leadership team: they remember context across sessions, route complex decisions through a multi-model consensus gate, operate within defined governance guardrails, and fire autonomously on schedules and event triggers without any human intervention.

**Phase 1 APEX is complete** — pluggable shell sandbox, trust tiers, Agent Hands, daemon scaffold, and the learning loop are all live.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Intelligent Model Routing** | Two-stage cascade: tiny ONNX classifier first, LLM fallback only when needed. Routes by domain (COO / CFO / CTO / General) and urgency. |
| **Two-Layer Failover** | Primary model → quant-level siblings → general domain fallback. Never a dead request. |
| **Lossless Memory** | Every conversation stored in SQLite DAG. Nothing is ever lost. Older entries automatically promoted to Mem0 personalization before they leave the active context window. |
| **Model Quantization Pipeline** | Install any HuggingFace model in Q4\_K\_M / Q5\_K\_M / Q8\_0. Download → GGUF → Ollama → registry in one API call. Progress streamed live over WebSocket. |
| **Admin UI** | Web-based model manager with session-authenticated login, quant selector, domain-urgency model assigner, and live install progress bar. |
| **Privacy First** | Runs entirely on local hardware. Ollama for inference, no external API required. WireGuard VPN per client tenant in production. |
| **VRAM-Aware Scheduling** | VRAMManager queries Ollama's running models and selects the largest quant that fits within your configured VRAM budget. |
| **Pluggable ShellBackend** ✅ NEW | Three execution tiers: DockerBackend (sandboxed), RestrictedLocalBackend (trusted), NativeBackend (autonomous). Same codebase on Win/Mac/Linux. |
| **Trust Tiers** ✅ NEW | SANDBOXED → TRUSTED → AUTONOMOUS. Change at runtime via Admin API or `data/.trust-level` file. No restart required. |
| **Agent Hands** ✅ NEW | Every agent has a `hand` block in its `config.json` — natural language schedule, event triggers, fires AgenticLoop without user interaction. |
| **Proactive Daemon** ✅ NEW | `coastal-daemon` process auto-registers enabled Hands, parses NL cron ("daily at 08:00"), fires HTTP requests to the server on schedule. |
| **IterationBudget** ✅ NEW | Replaces raw `MAX_TURNS` — supports `abort()` for interrupt propagation, parent-to-child cancellation via AbortSignal. |
| **Learning Loop** ✅ NEW | Background review thread records tool failures into `skill-gaps.db` after every agentic loop. Foundation for self-improvement. |

---

## 🏗 Architecture

Coastal Claw APEX runs as three cooperating processes:

```
┌──────────────────────────────────────────────────────────────────┐
│  coastal-server  (packages/core :4747)                           │
│                                                                  │
│  CascadeRouter ──► DomainClassifier ──► AgentRegistry           │
│       │                                      │                  │
│  TinyRouter (ONNX)              AgenticLoop ◄─┘                  │
│       │                              │                          │
│  DomainModelRegistry         PermissionGate                     │
│       │                              │                          │
│  VRAMManager ──► OllamaClient   ToolRegistry                    │
│       │              │               │                          │
│  ModelRouter ◄───────┘          ShellBackend (tier-aware)       │
│                                      │                          │
│  UnifiedMemory                  SkillGapsLog ◄── BackgroundReview│
│    ├── LosslessAdapter (SQLite)                                  │
│    └── Mem0Adapter (personalization)                            │
│                                                                  │
│  Admin API ── JWT session auth ── trust-level control           │
└──────────────┬───────────────────────────────────────────────────┘
               │  REST + WebSocket (:4747)
    ┌──────────┼──────────┐
    │          │          │
┌───┴──────┐ ┌─┴──────────┴──────────────┐
│ Web UI   │ │  coastal-daemon            │
│ React 19 │ │  ProactiveScheduler        │
│ + Tailwind│ │  HandRunner (HTTP POST)   │
│ Vite 5   │ │  reads agents/*/config.json│
└──────────┘ └────────────────────────────┘
```

### Trust Tiers

| Tier | Backend | What agents can do |
|------|---------|--------------------|
| `sandboxed` (default) | `DockerBackend` — Alpine container, no network, 256 MB RAM | Workspace-only commands in isolated container |
| `trusted` | `RestrictedLocalBackend` — host shell, workspace-only | Commands inside `CC_AGENT_WORKDIR` only |
| `autonomous` | `NativeBackend` — full host shell | Unrestricted shell access |

Change trust level at runtime:
```bash
curl -X PATCH http://localhost:4747/api/admin/trust-level \
  -H "x-admin-session: <token>" \
  -H "Content-Type: application/json" \
  -d '{"level": "trusted"}'
# Restart coastal-server to apply
```

### Routing Pipeline

```
User message
     │
     ▼
TinyRouter (ONNX)          ← signals: urgency, retention, actionability
     │
     ▼
DomainClassifier           ← rules pass (keywords) → LLM fallback
     │
     ▼
AgentRegistry              ← file-based overrides: agents/<id>/config.json + SYSTEM.md
     │
     ▼
AgenticLoop                ← IterationBudget, AbortSignal
     │            │
     ▼            ▼
ToolRegistry   PermissionGate
     │
     ▼
ShellBackend               ← tier-aware (Docker / RestrictedLocal / Native)
     │
     ▼
BackgroundReview           ← SkillGapsLog records tool failures → skill-gaps.db
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- [pnpm 9+](https://pnpm.io) — `npm install -g pnpm`
- [Ollama](https://ollama.com) — running locally on port `11434`
- At least one Ollama model pulled (e.g. `ollama pull llama3.2`)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — optional, required for SANDBOXED trust tier

### 1. Clone and install

```bash
git clone https://github.com/CoastalCrypto/CoastalClaw_IO.git
cd CoastalClaw_IO
pnpm install
```

### 2. Configure environment

```bash
cp packages/core/.env.example packages/core/.env.local
```

Edit `packages/core/.env.local`:

```env
CC_PORT=4747
CC_HOST=127.0.0.1
CC_DATA_DIR=./data
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.2

# Trust tier: sandboxed (Docker) | trusted (restricted shell) | autonomous (full shell)
CC_TRUST_LEVEL=sandboxed

# Agent workspace — agents are restricted to this directory in trusted tier
CC_AGENT_WORKDIR=./data/workspace

# Optional: Mem0 for personalized memory
# MEM0_API_KEY=your_key_here
```

```bash
cp packages/web/.env.example packages/web/.env.local
# Edit: VITE_CORE_PORT=4747
```

### 3. Build and run

```bash
pnpm build

# Terminal 1 — core server
node packages/core/dist/index.js
# → Server listening on http://127.0.0.1:4747

# Terminal 2 — web portal
cd packages/web && pnpm dev
# → http://localhost:5173

# Terminal 3 — proactive daemon (optional)
node packages/daemon/dist/index.js
# → coastal-daemon started — registered N hand jobs
```

### 4. First run

1. Open `http://localhost:5173`
2. Complete the 5-step onboarding wizard
3. Start chatting with your AI agents

### 5. Admin panel

1. Navigate to the **Models** tab
2. Enter your admin token — find it at `./data/.admin-token`
3. Install a model: enter a HuggingFace model ID, select quant levels, click Install
4. Assign models to agent domains in the **Domain Assigner** table

---

## 🤖 Agent Hands

Every agent can have a `hand` block in `agents/<id>/config.json` that fires the agent autonomously on a schedule or event trigger — no user required.

```json
{
  "id": "cfo",
  "tools": ["read_file", "query_db", "http_get"],
  "hand": {
    "enabled": true,
    "schedule": "daily at 08:00",
    "triggers": ["price_alert BTC > 5%"],
    "goal": "Review overnight P&L, check BTC price movement, and prepare morning briefing."
  }
}
```

Supported schedule formats: `"daily at 08:00"`, `"every 2h"`, `"weekly on monday"`, or raw cron `"0 8 * * *"`.

Per-agent system prompts live in `agents/<id>/SYSTEM.md` and override the database soul at runtime.

---

## ⚙️ Configuration

### Core environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_PORT` | `4747` | Port for the core service |
| `CC_HOST` | `127.0.0.1` | Bind address |
| `CC_DATA_DIR` | `./data` | Storage root (SQLite, admin token, registry) |
| `CC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `CC_DEFAULT_MODEL` | `llama3.2` | Fallback model when routing fails |
| `CC_ADMIN_TOKEN` | auto-generated | Admin API token — printed to `CC_DATA_DIR/.admin-token` on first run |
| `CC_CORS_ORIGINS` | `localhost:5173` | Comma-separated allowed CORS origins |
| `CC_VRAM_BUDGET_GB` | `24` | VRAM ceiling for quant selection |
| `CC_TRUST_LEVEL` | `sandboxed` | Shell execution tier: `sandboxed` \| `trusted` \| `autonomous` |
| `CC_AGENT_WORKDIR` | `./data/workspace` | Workspace root agents are restricted to |
| `CC_ROUTER_CONFIDENCE` | `0.7` | Minimum confidence to trust the rules-based domain classifier |
| `MEM0_API_KEY` | — | Optional Mem0 API key for personalized memory |

### Daemon environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_SERVER_URL` | `http://localhost:4747` | coastal-server base URL for HandRunner HTTP calls |
| `CC_DAEMON_INTERVAL_MS` | `60000` | Scheduler tick interval in milliseconds |

---

## 🔒 Security

### Admin authentication

The admin API uses a two-step session flow:

1. **Obtain a session token** (24h TTL):
   ```bash
   curl -X POST http://localhost:4747/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"token": "<your-admin-token>"}'
   # → {"sessionToken": "..."}
   ```

2. **Use the session token** on all admin endpoints via `x-admin-session` header.

### Production deployment checklist

- [ ] Set `CC_CORS_ORIGINS` to your specific frontend domain
- [ ] Run behind a reverse proxy (nginx/caddy) with TLS
- [ ] Set `CC_ADMIN_TOKEN` to a strong random value (`openssl rand -hex 32`)
- [ ] Restrict `CC_OLLAMA_URL` to localhost — Ollama has no auth by default
- [ ] Start with `CC_TRUST_LEVEL=sandboxed` (requires Docker Desktop)
- [ ] Only promote to `trusted` or `autonomous` when you understand the implications
- [ ] Deploy behind WireGuard VPN for multi-tenant production use
- [ ] Ensure `CC_DATA_DIR` is on encrypted storage

---

## 📡 API Reference

### Chat

```
POST /api/chat
Content-Type: application/json

{
  "message": "What's our current burn rate?",
  "sessionId": "optional-uuid",
  "model": "optional-model-override"
}
```

Response:
```json
{
  "sessionId": "uuid",
  "reply": "Based on your last financials...",
  "domain": "cfo"
}
```

### Admin endpoints (require `x-admin-session` header)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Exchange admin token for session token |
| `GET` | `/api/admin/models` | List all installed models grouped by base |
| `POST` | `/api/admin/models/add` | Start quantization pipeline |
| `DELETE` | `/api/admin/models/:quantId` | Remove a model variant |
| `GET` | `/api/admin/registry` | Get domain-model assignments |
| `PATCH` | `/api/admin/registry` | Update domain-model assignments |
| `GET` | `/api/admin/trust-level` | Get current trust tier |
| `PATCH` | `/api/admin/trust-level` | Set trust tier (restart required to apply) |

### WebSocket

```
ws://localhost:4747/ws/session
```

Register a session to receive pipeline progress and proactive suggestions:
```json
{ "type": "register", "sessionId": "your-uuid" }
```

Receive events:
```json
{ "type": "quant_progress", "step": 3, "total": 11, "message": "Quantizing to Q4_K_M..." }
{ "type": "proactive_suggestion", "suggestion": "Review overnight P&L", "sessionId": "..." }
{ "type": "approval_request", "approvalId": "...", "agentName": "cfo", "toolName": "run_command", "cmd": "..." }
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Core tests only (134 tests)
cd packages/core && pnpm test

# Daemon tests only (6 tests)
cd packages/daemon && pnpm test
```

The suite covers: routing pipeline, memory adapters, admin API (auth, CRUD, pipeline, trust-level), chat route, WebSocket session, ShellBackend (native, restricted-local, docker), AgenticLoop (IterationBudget, AbortSignal, skill-gaps), Agent Registry file overrides, ProactiveScheduler (NL cron parsing, minute-level matching), HandRunner, React components.

---

## 🗺 Roadmap

### Phase 0 — Foundation ✅
- Coastal Claw core service (REST + WebSocket)
- Intelligent routing with CascadeRouter + VRAMManager
- LosslessAdapter (SQLite) + Mem0 memory stack
- Model quantization pipeline (HF → GGUF → Ollama)
- React web portal — onboarding wizard, chat, model management
- Admin API with session auth

### Phase 1 — APEX OS Scaffold ✅ `v0.2.0-phase1-apex`
- **Pluggable ShellBackend**: DockerBackend (sandboxed) + RestrictedLocalBackend (trusted) + NativeBackend (autonomous)
- **Trust tier system**: `sandboxed | trusted | autonomous` with Admin API + file-based override
- **IterationBudget**: Replaces `MAX_TURNS`, supports `abort()` and AbortSignal propagation
- **SkillGapsLog**: SQLite `skill-gaps.db` recording tool failure patterns
- **BackgroundReviewThread**: Non-blocking post-loop review that feeds SkillGapsLog
- **Agent Hands**: NL cron schedule + event triggers per agent — fires AgenticLoop autonomously
- **coastal-daemon**: Standalone process with ProactiveScheduler + HandRunner
- **agents/ directory**: 9 agents × `config.json` + `SYSTEM.md` at project root
- **AgentRegistry file overrides**: Runtime tools/soul/hand config from filesystem

### Phase 2 — Voice Pipeline
- Wake word detection → Whisper STT → AgenticLoop → ElevenLabs TTS
- Full-duplex voice with interruption (personaplex-mlx pattern)
- `coastal-daemon` voice integration
- ClawShell Electron kiosk with visual desktop + voice UI

### Phase 3 — Self-Build + ClawOS
- `coastal-architect` nightly self-build loop (reads own source, proposes improvements, runs tests, hot-reloads)
- NamespaceBackend (Linux `unshare` — ClawOS native alternative to Docker)
- ClawOS Ubuntu 24.04 LTS distribution — ISO + APT package + Cloud AMI + Docker image
- Cubic/live-build pipeline

### Phase 4 — ClawTeam Swarm
- HKUDS/ClawTeam integration — boss agent fan-out/merge
- Session tools for agent-to-agent communication
- Per-agent git worktree isolation
- Dependency-aware parallel execution graph

### Phase 5 — Open Source Launch
- APT repository
- Cloud marketplace listings (AWS AMI, GCP, Azure)
- `coastal-architect` submits PRs to its own repo
- Public launch

---

## 🙏 Open Source Inspirations

| Project | How we use it |
|---------|--------------|
| **[Ollama](https://github.com/ollama/ollama)** | Local inference engine. Serves all quantized models via OpenAI-compatible API. |
| **[Fastify](https://github.com/fastify/fastify)** | Core HTTP/WebSocket server. Schema-validated routes, plugin architecture. |
| **[OpenClaw](https://github.com/openclaw/openclaw)** | Gateway pattern, Docker-per-session, ElevenLabs voice, session tools inspiration. |
| **[Hermes Agent](https://github.com/nousresearch/hermes-agent)** | Pluggable backends (6 types), IterationBudget, automatic skill creation, background review thread, NL cron patterns. |
| **[OpenFang](https://github.com/RightNow-AI/openfang)** | WASM dual-metered sandbox, defense layers, autonomous Hands, kernel RBAC concepts. |
| **[llama.cpp](https://github.com/ggerganov/llama.cpp)** | GGUF quantization engine. Powers the Q4\_K\_M / Q5\_K\_M / Q8\_0 pipeline. |
| **[Mem0](https://github.com/mem0ai/mem0)** | Personalized memory layer. Cross-session context promoted from SQLite to vector search. |
| **[ClawTeam / HKUDS](https://github.com/HKUDS/ClawTeam)** | Phase 4 multi-agent swarm: boss fan-out/merge, git worktree isolation per agent. |
| **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** | Synchronous SQLite driver for lossless message store and skill-gaps.db. |

---

## 📂 Project Structure

```
CoastalClaw/
├── agents/                           # Per-agent config (override DB at runtime)
│   ├── cfo/
│   │   ├── config.json               # tools, modelPref, hand (schedule + goal)
│   │   └── SYSTEM.md                 # domain soul — overrides DB soulPath
│   ├── cto/ coo/ general/ ...        # 9 agents total
│   └── ...
├── packages/
│   ├── core/                         # Fastify backend service (:4747)
│   │   └── src/
│   │       ├── agents/
│   │       │   ├── loop.ts           # AgenticLoop — IterationBudget, AbortSignal
│   │       │   ├── iteration-budget.ts
│   │       │   ├── skill-gaps.ts     # SQLite skill-gaps.db
│   │       │   ├── learning-thread.ts# BackgroundReviewThread
│   │       │   ├── registry.ts       # file-override support
│   │       │   └── permission-gate.ts
│   │       ├── tools/
│   │       │   ├── backends/         # ShellBackend interface + implementations
│   │       │   │   ├── types.ts      # ShellBackend interface, ShellResult
│   │       │   │   ├── native.ts     # NativeBackend (full shell)
│   │       │   │   ├── restricted-local.ts # RestrictedLocalBackend
│   │       │   │   ├── docker.ts     # DockerBackend (sandboxed container)
│   │       │   │   └── index.ts      # createBackend(trustLevel, allowedPaths)
│   │       │   └── registry.ts       # ToolRegistry — backend injection
│   │       ├── api/routes/
│   │       │   ├── chat.ts           # POST /api/chat + proactive thread
│   │       │   └── admin.ts          # trust-level PATCH/GET endpoints
│   │       ├── memory/               # LosslessAdapter + Mem0Adapter
│   │       ├── models/               # OllamaClient, ModelRouter, QuantizationPipeline
│   │       └── config.ts             # TrustLevel, loadConfig()
│   ├── daemon/                       # coastal-daemon process
│   │   └── src/
│   │       ├── scheduler.ts          # ProactiveScheduler — NL cron, setInterval
│   │       ├── hand-runner.ts        # HandRunner — HTTP POST to /api/chat
│   │       └── index.ts              # loadHandJobs, SIGTERM/SIGINT handlers
│   └── ui/                           # React 19 + Vite + Tailwind v4
│       └── src/
│           ├── api/                  # CoreClient (chat + admin)
│           ├── components/           # ModelCard, ModelInstaller, DomainAssigner
│           └── pages/                # Chat, Models, onboarding steps
├── docs/
│   └── superpowers/
│       ├── specs/                    # Design documents
│       └── plans/                   # Implementation plans
└── README.md
```

---

## 🤝 Contributing

Coastal Claw is under active development by Coastal Crypto. Contributions, feedback, and issues are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit with clear messages (`git commit -m "feat: add X"`)
4. Open a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with purpose by <strong>Coastal Crypto</strong> · Privacy-first AI Agent OS
</p>
