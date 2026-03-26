<p align="center">
  <img src="assets/banner.png" alt="Coastal Claw" width="100%"/>
</p>

<p align="center">
  <strong>Your private AI executive team — running on your hardware, your data never leaves the facility.</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-features">Features</a> ·
  <a href="#%EF%B8%8F-configuration">Configuration</a> ·
  <a href="#-security">Security</a> ·
  <a href="#-roadmap">Roadmap</a>
</p>

---

## What is Coastal Claw?

Coastal Claw is an AI agent operating system built by [Coastal Crypto](https://coastalcrypto.com). It replaces the typical 4–6 hour AI infrastructure setup with a **15–20 minute onboarding** and delivers a JARVIS-grade experience backed by on-premise GPU hardware — no AWS middleman, no per-token cloud costs, no data leaving your facility.

The flagship product is the **AI Executive Suite** — virtual COO, CFO, and CTO agents that work like a real leadership team: they remember context across sessions, route complex decisions through a multi-model consensus gate, and operate within defined budget and governance guardrails.

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

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│               Coastal Claw Core :4747                │
│                                                     │
│  CascadeRouter ──► DomainClassifier                 │
│       │               │                             │
│  TinyRouter       DomainModelRegistry               │
│  (ONNX)           (model-registry.json)             │
│       │                                             │
│  VRAMManager ──► OllamaClient                       │
│       │              │ two-layer failover            │
│  ModelRouter ◄───────┘                              │
│       │                                             │
│  UnifiedMemory                                      │
│    ├── LosslessAdapter (SQLite)                     │
│    └── Mem0Adapter (personalization)                │
│                                                     │
│  Admin API ── JWT session auth                      │
│  Quant Pipeline ── HF → GGUF → Ollama              │
└──────────┬──────────────────────────────────────────┘
           │  REST + WebSocket (:4747)
    ┌──────┴──────┐
    │  Web Portal  │  React 19 + Vite + Tailwind v4
    │  (port 5173) │  5-step onboarding, chat, model mgmt
    └─────────────┘
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
DomainModelRegistry        ← resolve(domain, urgency) → preferred model
     │
     ▼
VRAMManager                ← selectQuant(model) → fits in VRAM budget?
     │
     ▼
ModelRouter.chat()         ← primary → fallback[0] → fallback[1] → ...
     │
     ▼
UnifiedMemory.write()      ← retention signal determines persistence tier
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 22+](https://nodejs.org)
- [pnpm 9+](https://pnpm.io) — `npm install -g pnpm`
- [Ollama](https://ollama.com) — running locally on port `11434`
- At least one Ollama model pulled (e.g. `ollama pull llama3.2`)

### 1. Clone and install

```bash
git clone https://github.com/CoastalCrypto/CoastalClaw_IO.git
cd CoastalClaw_IO
pnpm install
```

### 2. Configure environment

```bash
# packages/core — create .env.local
cp packages/core/.env.example packages/core/.env.local
```

Edit `packages/core/.env.local`:

```env
CC_PORT=4747
CC_HOST=127.0.0.1
CC_DATA_DIR=./data
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.2

# Optional: restrict CORS to specific origins (comma-separated)
# CC_CORS_ORIGINS=http://localhost:5173,https://your-domain.com

# Optional: Mem0 for personalized memory
# MEM0_API_KEY=your_key_here

# Optional: VRAM budget in GB (default: 24)
# CC_VRAM_BUDGET_GB=24
```

```bash
# packages/web — create .env.local
cp packages/web/.env.example packages/web/.env.local
```

Edit `packages/web/.env.local`:

```env
VITE_CORE_PORT=4747
```

### 3. Build and run

```bash
# Build both packages
pnpm build

# Start the core service
node packages/core/dist/index.js
# → [coastal-claw] Admin token written to ./data/.admin-token
# → Server listening on http://127.0.0.1:4747

# In a second terminal — start the web portal
cd packages/web && pnpm dev
# → http://localhost:5173
```

### 4. First run

1. Open `http://localhost:5173`
2. Complete the 5-step onboarding wizard
3. Start chatting with your AI agents

### 5. Admin panel (model management)

1. Navigate to the **Models** tab in the web portal
2. Enter your admin token — find it at `./data/.admin-token` or in your `CC_ADMIN_TOKEN` env var
3. Install a model: enter a HuggingFace model ID (e.g. `mistralai/Mistral-7B-Instruct-v0.3`), select quant levels, click Install
4. Assign models to agent domains in the **Domain Assigner** table

---

## ⚙️ Configuration

### Core environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_PORT` | `4747` | Port for the core service |
| `CC_HOST` | `127.0.0.1` | Bind address |
| `CC_DATA_DIR` | `./data` | Storage root (SQLite, admin token, registry) |
| `CC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint (localhost only recommended) |
| `CC_DEFAULT_MODEL` | `llama3.2` | Fallback model when routing fails |
| `CC_ADMIN_TOKEN` | auto-generated | Admin API token — printed to `CC_DATA_DIR/.admin-token` on first run |
| `CC_CORS_ORIGINS` | `localhost:5173` | Comma-separated allowed CORS origins |
| `CC_VRAM_BUDGET_GB` | `24` | VRAM ceiling for quant selection |
| `CC_ROUTER_CONFIDENCE` | `0.7` | Minimum confidence to trust the rules-based domain classifier |
| `CC_TINY_ROUTER_MODEL` | `./data/tiny-router.onnx` | Path to the ONNX routing model |
| `CC_QUANT_ROUTER_MODEL` | `qwen2.5:0.5b` | Ollama model used for LLM domain fallback |
| `CC_LLAMA_CPP_DIR` | `./data/llama-cpp/` | llama.cpp binaries directory (auto-downloaded) |
| `MEM0_API_KEY` | — | Optional Mem0 API key for personalized memory |

### Model registry

The domain-to-model mapping lives in `CC_DATA_DIR/model-registry.json`:

```json
{
  "cfo": { "high": "qwen2.5:7b-q8_0", "medium": "qwen2.5:7b-q5_k_m", "low": "qwen2.5:7b-q4_k_m" },
  "cto": { "high": "codestral:22b-q5_k_m", "medium": "codestral:22b-q4_k_m", "low": "llama3.2:q4_k_m" },
  "coo": { "high": "llama3.1:8b-q8_0", "medium": "llama3.1:8b-q5_k_m", "low": "llama3.2:q4_k_m" },
  "general": { "high": "llama3.2:q8_0", "medium": "llama3.2:q5_k_m", "low": "llama3.2:q4_k_m" }
}
```

Manage this through the Admin UI → Domain Assigner, or via the API:

```bash
curl -X PATCH http://localhost:4747/api/admin/registry \
  -H "x-admin-session: <your-session-token>" \
  -H "Content-Type: application/json" \
  -d '{"cfo": {"high": "qwen2.5:7b-q8_0"}}'
```

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

The raw admin token never needs to leave your server environment. The web admin UI prompts for the token interactively — it's validated once at login and the session token is stored in `sessionStorage` only.

### Production deployment checklist

- [ ] Set `CC_CORS_ORIGINS` to your specific frontend domain
- [ ] Run behind a reverse proxy (nginx/caddy) with TLS
- [ ] Set `CC_ADMIN_TOKEN` to a strong random value (`openssl rand -hex 32`)
- [ ] Restrict `CC_OLLAMA_URL` to localhost — Ollama has no auth by default
- [ ] Deploy Coastal Claw behind WireGuard VPN for multi-tenant production use
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
  "reply": "Based on your last financials..."
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

### WebSocket

```
ws://localhost:4747/ws/session
```

Register a session to receive pipeline progress:
```json
{ "type": "register", "sessionId": "your-uuid" }
```

Receive progress events:
```json
{ "type": "quant_progress", "step": 3, "total": 11, "message": "Quantizing to Q4_K_M..." }
```

---

## 🧪 Testing

```bash
# Run all tests (core + web)
pnpm test

# Core tests only
cd packages/core && pnpm test

# Web tests only
cd packages/web && pnpm test
```

The suite covers: routing pipeline, memory adapters, admin API (auth, CRUD, pipeline), chat route, WebSocket session, React components (ModelCard, ModelInstaller, DomainAssigner), and the CoreClient.

---

## 🗺 Roadmap

### Phase 1 — Foundation ✅
- Coastal Claw core service (REST + WebSocket)
- Intelligent routing with CascadeRouter + VRAMManager
- LosslessAdapter (SQLite) + Mem0 memory stack
- Model quantization pipeline (HF → GGUF → Ollama)
- React web portal — onboarding wizard, chat, model management
- Admin API with session auth

### Phase 2 — Orchestration + Exec Suite
- **OpenMOSS** — self-organizing Planner / Executor / Reviewer / Patrol agents
- **CrewAI** blueprints — COO, CFO, CTO agent definitions
- **Paperclip** governance — budget caps, approval gates, audit trail
- **LLM Council** quality gate — multi-model consensus for critical decisions
- Auto-provisioning for CC facility tenants

### Phase 3 — JARVIS Electron App
- Electron desktop shell
- Three.js floating neural net main agent
- deck.gl live agent network map
- Native voice (STT/TTS) + video/image ingest
- Always-On memory consolidation agent

### Phase 4 — Intelligence + Simulation
- **ClawTeam** agent swarm — git worktree isolation per agent, dependency-aware parallel execution
- **MiroFish** simulation — test agent scenarios before deploying real agents
- Symphony proof-of-work task execution
- On-prem fine-tuning pipeline (HuggingFace Transformers + CUDA)
- True TUI (Go binary)

### Phase 5 — Production + Scale
- NemoClaw / OpenShell sandbox hardening
- Prometheus + Grafana monitoring
- Coastal Crypto website integration
- Public launch

---

## 🙏 Open Source Inspirations

Coastal Claw stands on the shoulders of the following open-source projects and research:

| Project | How we use it |
|---------|--------------|
| **[Ollama](https://github.com/ollama/ollama)** | Local inference engine. Serves all quantized models via OpenAI-compatible API. |
| **[Fastify](https://github.com/fastify/fastify)** | Core HTTP/WebSocket server. Schema-validated routes, plugin architecture. |
| **[OpenClaw](https://github.com/openclaw/openclaw)** | Design inspiration for two-layer model failover, memory-flush-before-compaction, and pluggable Context Engine patterns. |
| **[llama.cpp](https://github.com/ggerganov/llama.cpp)** | GGUF quantization engine. Powers the Q4\_K\_M / Q5\_K\_M / Q8\_0 quantization pipeline. |
| **[Mem0](https://github.com/mem0ai/mem0)** | Personalized memory layer. Promotes long-term context from session history to vector search. |
| **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** | Synchronous SQLite driver for the lossless message store. |
| **[ClawTeam / HKUDS](https://github.com/HKUDS/ClawTeam)** | Multi-agent swarm design — git worktree isolation per agent, filesystem inbox, dependency-aware task graphs. Planned for Phase 4. |
| **[CrewAI](https://github.com/crewAIInc/crewAI)** | Agent blueprint system for the Exec Suite (COO / CFO / CTO). Planned for Phase 2. |
| **[Karpathy's LLM work](https://github.com/karpathy)** | Inspiration for the LLM Council multi-model consensus gate and on-prem fine-tuning direction. |
| **[Three.js](https://github.com/mrdoob/three.js)** | WebGL engine for the JARVIS neural ball and wave visualizer (Phase 3). |
| **[deck.gl](https://github.com/visgl/deck.gl)** | WebGL2/WebGPU agent network map for the Electron JARVIS HUD (Phase 3). |
| **[React](https://github.com/facebook/react)** | Web portal UI — v19 with concurrent rendering. |
| **[Vite](https://github.com/vitejs/vite)** | Web build tooling and dev server. |
| **[Tailwind CSS](https://github.com/tailwindlabs/tailwindcss)** | v4 utility-first styling throughout the web portal. |

---

## 📂 Project Structure

```
CoastalClaw/
├── packages/
│   ├── core/                     # Fastify backend service
│   │   └── src/
│   │       ├── api/
│   │       │   ├── routes/       # chat, admin, health, ws
│   │       │   └── ws/           # WebSocket session handler
│   │       ├── memory/           # LosslessAdapter + Mem0Adapter + UnifiedMemory
│   │       ├── models/           # OllamaClient, ModelRouter, ModelRegistry, QuantizationPipeline
│   │       ├── routing/          # CascadeRouter, TinyRouter, DomainClassifier, VRAMManager
│   │       ├── config.ts
│   │       └── server.ts
│   └── web/                      # React 19 + Vite + Tailwind v4
│       └── src/
│           ├── api/              # CoreClient (chat + admin)
│           ├── components/       # ModelCard, ModelInstaller, DomainAssigner, visualizer/
│           └── pages/            # Chat, Models, onboarding steps
├── docs/
│   └── superpowers/
│       ├── specs/                # Design documents
│       └── plans/                # Implementation plans
├── assets/
│   └── logo.svg
└── README.md
```

---

## 🤝 Contributing

Coastal Claw is currently under active development by Coastal Crypto. Contributions, feedback, and issues are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit with clear messages (`git commit -m "feat: add X"`)
4. Open a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with purpose by <strong>Coastal Crypto</strong> · Privacy-first AI infrastructure
</p>
