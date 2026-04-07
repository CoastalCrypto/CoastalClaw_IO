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
  <a href="#-security">Security</a>
</p>

---

## What is CoastalClaw?

CoastalClaw is an open-source **AI Agent Operating System** you deploy on your own hardware. It's not a chatbot — it's a self-improving OS that runs your business 24/7: autonomous scheduled agents, a multi-agent executive swarm, a live analytics dashboard, and a self-build loop that patches and improves its own code.

**You configure it once.** Set your agent's name, personality, and org context. Every agent in the system — COO, CFO, CTO, and your primary assistant — knows who it's working for. Multi-user access control lets your whole team collaborate with defined roles.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Multi-User Auth** | Username + password login, three roles (admin / operator / viewer), 7-day signed session tokens. First-boot wizard creates the root admin. |
| **Generic Agent Persona** | Name your agent, set its personality, describe your org. Stored in SQLite, injected into every agent soul at runtime. |
| **Live Event Dashboard** | Real-time SSE feed of all agent activity — tool calls, session start/end, token counts. Ring-buffered for reconnect replay. |
| **Analytics** | Tool call stats, success rates, avg duration, cost, top tools, 7-day sparkline, decision breakdowns. |
| **Custom Tool Builder** | Write JavaScript tool implementations in-browser. Sandboxed with `vm.runInNewContext` (no fs/process, 5s timeout). Test instantly. |
| **Output Channels** | Push agent messages to Telegram, Discord, Slack, and Zapier webhooks. Per-channel enable/disable, broadcast to all, stored encrypted. |
| **Intelligent Model Routing** | Two-stage cascade: tiny ONNX classifier first, LLM fallback only when needed. Routes by domain (COO / CFO / CTO / General) and urgency. |
| **AI Executive Suite** | Virtual COO, CFO, and CTO — domain specialists that fire autonomously on schedule. |
| **Multi-Agent Swarm** | BossAgent decomposes complex tasks, fans out to specialist agents in parallel, synthesizes a unified reply. |
| **Self-Build Loop** | `coastal-architect` reads its own source, proposes improvements, runs tests, and opens PRs automatically. |
| **NamespaceBackend** | Linux `unshare` + overlayfs + cgroups v2 sandbox — no Docker daemon needed on CoastalOS. |
| **Three Inference Backends** | Lazy probe order: vLLM (GPU) → AirLLM (layer-stream) → Ollama (CPU). Zero config required. |
| **Lossless Memory** | Every message in SQLite. Older entries promoted to Mem0 personalization before leaving the context window. |
| **Trust Tiers** | `sandboxed` → `trusted` → `autonomous`. Change at runtime. |
| **Privacy First** | Entirely local inference. No external API required. All data stays on your hardware. |

---

## 🏗 Architecture

CoastalClaw runs as three cooperating processes:

```
┌────────────────────────────────────────────────────────────────────┐
│  coastal-server  (packages/core :4747)                             │
│                                                                    │
│  UserStore (multi-user auth, scrypt, role-based sessions)          │
│  PersonaManager ──► AgentSession (soul template interpolation)     │
│                                                                    │
│  CascadeRouter ──► DomainClassifier ──► AgentRegistry             │
│       │                                      │                    │
│  TinyRouter (ONNX)              AgenticLoop ◄─┘                    │
│       │                              │                            │
│  ModelRouter                   PermissionGate                     │
│    vLLM → AirLLM → Ollama          │                             │
│                              ToolRegistry (built-in + custom JS)   │
│                                    │                              │
│                              ShellBackend                          │
│                     Namespace / Docker / Local                     │
│                                                                    │
│  EventBus (SSE, 200-event ring buffer)                             │
│  AnalyticsStore (action_log → snapshots)                           │
│  ChannelManager (Telegram / Discord / Slack / Zapier)              │
│  UnifiedMemory + InfinityClient    BossAgent + TeamChannel         │
│                                                                    │
│  /api/auth/*  /api/admin/*  /api/chat  /api/events  /api/analytics│
└──────────────┬─────────────────────────────────────────────────────┘
               │  REST + WebSocket + SSE (:4747)
    ┌──────────┼──────────┐
    │          │          │
┌───┴──────┐ ┌─┴──────────┴──────────────────────┐
│ Web UI   │ │  coastal-daemon                    │
│ React 19 │ │  ProactiveScheduler (NL cron)      │
│ Tailwind │ │  HandRunner (HTTP POST to /api/chat│
│ Vite 6   │ │  VibeVoiceClient (streaming voice) │
└──────────┘ └───────────────────────────────────┘
```

### Trust Tiers

| Tier | Backend | What agents can do |
|------|---------|--------------------|
| `sandboxed` (default) | `DockerBackend` or `NamespaceBackend` (Linux) | Isolated container, workspace-only |
| `trusted` | `RestrictedLocalBackend` | Host shell, workspace directory only |
| `autonomous` | `NativeBackend` | Unrestricted host shell |

### User Roles

| Role | Access |
|------|--------|
| `admin` | Full access — all pages, user management, models, tools, channels |
| `operator` | Chat, dashboard, analytics — no user or model management |
| `viewer` | Chat and dashboard only |

---

## 🚀 Quick Start

### What you need

- Mac or Linux (Windows: use WSL2)
- A terminal
- Internet connection for the first model download (~2 GB)

### One-line install

```bash
curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/install.sh | bash
```

The installer handles Git, Node.js, Ollama, the AI model, dependencies, and launches the app. When it finishes:

```
  ✔  Coastal Claw is running!

  Web portal:  http://127.0.0.1:5173
  Core API:    http://127.0.0.1:4747
```

Your browser opens to `http://127.0.0.1:5173`. On first load you'll create your admin account, then complete the persona setup wizard.

---

### Ubuntu / Debian — APT install

```bash
curl -fsSL https://CoastalCrypto.github.io/CoastalClaw_IO/setup.sh | sudo bash
```

Adds the signed APT repo and installs `coastalclaw` as a system service.

---

### Stop / start

```bash
# Kill (if started from installer)
kill $(cat /tmp/coastal-claw-core.pid /tmp/coastal-claw-web.pid)

# APT install
sudo systemctl stop coastalclaw
sudo systemctl start coastalclaw
```

---

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Browser doesn't open | Go to `http://127.0.0.1:5173` manually |
| "Port already in use" | `kill $(cat /tmp/coastal-claw-core.pid)` |
| Slow first response | AI model loading — normal on first run |
| Logs | `tail -f /tmp/coastal-claw-core.log` |

---

## 💿 CoastalOS — Bootable USB

CoastalOS is a dedicated Linux image that runs CoastalClaw as a complete operating system. Boot from a thumb drive — no installation required.

### What you need

- USB drive **8 GB or larger** (will be erased)
- Latest ISO from the [Releases page](https://github.com/CoastalCrypto/CoastalClaw_IO/releases)

### Write the ISO

**Mac:**

```bash
diskutil list                                  # find your USB (e.g. /dev/disk2)
diskutil unmountDisk /dev/disk2
sudo dd if=~/Downloads/coastalos-1.0.0.iso of=/dev/rdisk2 bs=4m status=progress
diskutil eject /dev/disk2
```

**Linux:**

```bash
lsblk                                          # find your USB (e.g. /dev/sdb)
sudo dd if=~/Downloads/coastalos-1.0.0.iso of=/dev/sdb bs=4M status=progress oflag=sync
```

**Windows:** Use [Balena Etcher](https://etcher.balena.io) — open it, select the ISO, select the drive, click Flash.

### Boot

Restart with the USB plugged in. Press `F12` / `F11` / `F9` / `Option ⌥` to open the boot menu and select your USB drive. CoastalOS boots in ~30–60 seconds, starts the server, and opens the interface fullscreen.

**Notes:**
- Your data (memory, persona, users) is stored on the USB — take it anywhere
- The AI model (~2 GB) is downloaded on first boot — internet required
- Nothing is written to the host machine's disk
- Requires UEFI firmware (most machines from 2012 onward)

---

## 🎭 Agent Persona

Configure once, applied to all agents.

| Field | Description |
|-------|-------------|
| `agentName` | What your primary agent calls itself |
| `agentRole` | One-line role (e.g. "Executive Assistant") |
| `personality` | Free-text traits injected into every system prompt |
| `orgName` | Organization name — shared across all agent souls |
| `orgContext` | 2–4 sentence org description all agents share |
| `ownerName` | Your name — agents address you by this |

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

BossAgent decomposes the task, fans out to COO/CFO/CTO in parallel, synthesizes a single reply.

---

## 📣 Output Channels

Push agent messages to external services. Configured in the **Channels** tab of the portal.

| Channel | Config |
|---------|--------|
| Telegram | Bot token + Chat ID |
| Discord | Webhook URL (+ optional bot name) |
| Slack | Webhook URL (+ optional channel, bot name, icon) |
| Zapier | Catch hook URL |

All config is stored encrypted. Channels can be tested individually or broadcast to all enabled at once. Agents can send messages via the channel manager programmatically.

---

## 🔧 Custom Tools

Write JavaScript tool implementations directly in the browser. Tools run in a restricted sandbox (`vm.runInNewContext` — no `fs`, `process`, or network). Test instantly with JSON args before saving.

Tools are available to the agent after a server restart.

---

## ⚙️ Configuration

### Core environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_PORT` | `4747` | API server port |
| `CC_HOST` | `127.0.0.1` | Bind address |
| `CC_DATA_DIR` | `./data` | SQLite, persona, admin token |
| `CC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `CC_DEFAULT_MODEL` | `llama3.2` | Fallback model |
| `CC_TRUST_LEVEL` | `sandboxed` | `sandboxed` \| `trusted` \| `autonomous` |
| `CC_AGENT_WORKDIR` | `./data/workspace` | Agent sandbox root |
| `CC_VLLM_URL` | `http://127.0.0.1:8000` | vLLM endpoint (auto-probed) |
| `CC_AIRLLM_URL` | `http://127.0.0.1:8002` | AirLLM endpoint (auto-probed) |
| `CC_INFINITY_URL` | `http://127.0.0.1:23817` | Infinity vector DB (auto-probed) |
| `CC_VIBEVOICE_URL` | `http://127.0.0.1:8001` | VibeVoice ASR+TTS (auto-probed) |
| `CC_CORS_ORIGINS` | `localhost:5173` | Comma-separated allowed CORS origins |
| `CC_VRAM_BUDGET_GB` | `24` | VRAM ceiling for quant selection |
| `MEM0_API_KEY` | — | Optional Mem0 cloud memory key |

---

## 🔒 Security

### Multi-user authentication

```bash
# First-time setup: create admin account (browser wizard, or API)
curl -X POST http://localhost:4747/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Login
curl -X POST http://localhost:4747/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
# → {"sessionToken": "u:...", "user": {"id": "...", "username": "admin", "role": "admin"}}

# Use the token on admin endpoints
curl http://localhost:4747/api/admin/channels \
  -H "x-admin-session: u:..."
```

Session tokens are HMAC-SHA256 signed, 7-day TTL. Passwords are stored with scrypt (N=32768, r=8, p=1).

### Legacy admin token (CLI / API automation)

```bash
# Stored at CC_DATA_DIR/.admin-token on first run
curl -X POST http://localhost:4747/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"token": "<your-admin-token>"}'
# → {"sessionToken": "..."}
```

### Production checklist

- [ ] Set `CC_CORS_ORIGINS` to your domain
- [ ] Run behind nginx/caddy with TLS
- [ ] Set `CC_ADMIN_TOKEN` to `openssl rand -hex 32`
- [ ] Keep `CC_OLLAMA_URL` on localhost
- [ ] Start with `sandboxed` trust tier
- [ ] Put `CC_DATA_DIR` on encrypted storage

---

## 📡 API Reference

### Auth

```
GET  /api/auth/setup               → { needsSetup: boolean }
POST /api/auth/setup               { username, password } → { sessionToken, user }
POST /api/auth/login               { username, password } → { sessionToken, user }
GET  /api/auth/me                  → { user }
```

### Persona

```
GET  /api/persona                  → { persona, configured }
PUT  /api/persona                  → { persona, configured }
```

### Chat

```
POST /api/chat
  { "message": "...", "sessionId": "optional-uuid" }
  → { sessionId, reply, domain, model }

POST /api/chat/stream              (SSE)
  event: domain   data: { domain }
  event: token    data: { token }
  event: reply    data: { reply }
  event: approval data: { approvalId, toolName, cmd }
  event: done     data: { sessionId, domain }
  event: error    data: { message }
```

### Sessions

```
GET    /api/sessions?limit=20      → [{ id, title, created_at, updated_at }]
PUT    /api/sessions/:id           { title }
DELETE /api/sessions/:id
```

### Events (SSE)

```
GET /api/events                    text/event-stream
  Replays last 50 events on connect, then streams live.
  event: agent  data: { type, ts, sessionId, agentId, ... }

  Event types:
    tool_call_start  — { toolName, args }
    tool_call_end    — { toolName, durationMs, decision, success }
    session_start    — { }
    session_complete — { }
    token_counted    — { tokens }
```

### Analytics

```
GET /api/analytics
  → {
      totalToolCalls, totalSessions, avgDurationMs, overallSuccessRate,
      topTools: [{ name, calls, successRate }],
      last7Days: [{ date, calls, successRate }],
      decisionBreakdown: { approve, deny, always_allow, ... }
    }
```

### Custom Tools (admin)

```
GET    /api/admin/tools            → [tool]
POST   /api/admin/tools            { name, description, parameters, implBody }
PATCH  /api/admin/tools/:id        { name?, description?, parameters?, implBody?, enabled? }
DELETE /api/admin/tools/:id
POST   /api/admin/tools/test       { implBody, parameters?, args? } → { output, success }
```

### Output Channels (admin)

```
GET    /api/admin/channels         → [channel]
POST   /api/admin/channels         { type, name, config }
PATCH  /api/admin/channels/:id     { name?, config?, enabled? }
DELETE /api/admin/channels/:id
POST   /api/admin/channels/:id/test   { message? } → { success, error? }
POST   /api/admin/channels/broadcast  { message }  → [{ id, name, success }]
```

### Users (admin)

```
GET    /api/admin/users            → [user]
POST   /api/admin/users            { username, password, role? }
PATCH  /api/admin/users/:id        { username?, password?, role? }
DELETE /api/admin/users/:id
```

### Team (multi-agent)

```
POST /api/team/run
  { "task": "..." }
  → { reply, subtaskCount, subtasks: [{ subtaskId, reply }] }
```

### Upload

```
POST /api/upload  (multipart/form-data, field: "file")
  Allowed: text/plain, text/markdown, text/csv, application/json, application/xml, text/html
  Max: 5 MB
  → { filename, mimeType, size, text }
```

### System (admin)

```
GET  /api/system/stats             → { cpu, mem, disk, gpu, models, uptime }
GET  /api/admin/logs?service=...&lines=100
POST /api/admin/update             (async: git pull → build → restart)
GET/PATCH /api/admin/trust-level
```

### Models (admin)

```
GET    /api/admin/models           → [ModelGroup]
POST   /api/admin/models/add       { hfModelId, quants, sessionId }
DELETE /api/admin/models/:quantId
GET    /api/admin/registry         → domain-model assignments
PATCH  /api/admin/registry         { domain: { urgency: modelId } }
```

### WebSocket

```
ws://localhost:4747/ws/session
→ { type: "register", sessionId: "..." }

Events pushed to clients:
  { type: "proactive_suggestion", suggestion }
  { type: "approval_request", approvalId, toolName, cmd }
  { type: "quant_progress", step, total, message }
  { type: "architect_proposal", summary, diff, vetoDeadline }
  { type: "architect_applied", summary }
```

---

## 🧪 Testing

```bash
pnpm test                          # all packages (197 tests)
pnpm --filter core test
pnpm --filter daemon test
MOCK_NAMESPACE=1 pnpm test         # skip Linux namespace tests
```

---

## 📂 Project Structure

```
CoastalClaw_IO/
├── packages/
│   ├── core/                      # Fastify API server (:4747)
│   │   └── src/
│   │       ├── users/             # UserStore — multi-user auth, scrypt, session tokens
│   │       ├── channels/          # ChannelManager — Telegram/Discord/Slack/Zapier
│   │       ├── tools/custom/      # CustomToolLoader — in-browser JS sandbox
│   │       ├── events/            # EventBus — SSE ring buffer
│   │       ├── analytics/         # AnalyticsStore — action_log snapshots
│   │       ├── persona/           # PersonaManager
│   │       ├── agents/            # AgenticLoop, BossAgent, MetaAgent, TeamChannel
│   │       │   └── souls/         # Soul templates with {{persona.*}} tokens
│   │       ├── models/            # ModelRouter, AirLLMClient, VllmClient
│   │       ├── memory/            # UnifiedMemory + InfinityClient
│   │       ├── voice/             # VibeVoiceClient
│   │       ├── tools/backends/    # Namespace / Docker / RestrictedLocal / Native
│   │       └── api/routes/        # All HTTP routes
│   ├── web/                       # React 19 + Tailwind + Vite 6
│   │   └── src/
│   │       ├── pages/             # Chat, Dashboard, Analytics, Tools, Channels, Users, ...
│   │       ├── components/        # NavBar, animations
│   │       ├── context/           # AuthContext
│   │       ├── hooks/             # useEventStream (SSE)
│   │       └── api/               # CoreClient
│   ├── daemon/                    # coastal-daemon: voice + proactive scheduler
│   ├── architect/                 # Self-build loop: Planner, Patcher, Validator
│   └── shell/                     # Electron kiosk (ClawShell)
├── coastalos/                     # CoastalOS ISO build
│   ├── build/                     # live-build config, packages.list
│   ├── systemd/                   # Service units
│   └── vibevoice/                 # Python FastAPI ASR+TTS service
├── agents/                        # Per-agent runtime config
│   └── cfo/ coo/ cto/ general/
└── .github/workflows/             # CI: test, build .deb, ISO build, APT publish
```

---

## 🗺 Roadmap

| Phase | Status | What shipped |
|-------|--------|-------------|
| Foundation | ✅ | CascadeRouter, LosslessMemory, model quant pipeline, web portal |
| APEX OS | ✅ | ShellBackend tiers, trust system, Agent Hands, daemon |
| CoastalOS | ✅ | Voice pipeline, architect self-build, Electron kiosk |
| ClawOS Native | ✅ | NamespaceBackend, VllmClient, ISO build + CI |
| ClawTeam | ✅ | AirLLM, Infinity, VibeVoice, BossAgent swarm, MetaAgent, persona |
| v1.0.0 Launch | ✅ | APT repo, SSE streaming, signed packages, security audit |
| **v1.1.0** | ✅ | Live dashboard, analytics, custom tool builder, output channels, multi-user auth |

---

## 🙏 Open Source Inspirations

| Project | How we use it |
|---------|--------------|
| **[Ollama](https://github.com/ollama/ollama)** | Local inference engine |
| **[Fastify](https://github.com/fastify/fastify)** | HTTP/WebSocket server |
| **[vLLM](https://github.com/vllm-project/vllm)** | GPU-accelerated inference |
| **[AirLLM](https://github.com/lyogavin/airllm)** | Layer-streaming for large models on small VRAM |
| **[Infinity](https://github.com/infiniflow/infinity)** | Hybrid vector database |
| **[llama.cpp](https://github.com/ggerganov/llama.cpp)** | GGUF quantization |
| **[Mem0](https://github.com/mem0ai/mem0)** | Personalized memory layer |
| **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** | Synchronous SQLite driver |

---

## 🤝 Contributing

1. Fork the repo
2. `git checkout -b feat/your-feature`
3. `pnpm test` — keep all 197 tests green
4. Open a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
