<p align="center">
  <img src="assets/banner.png" alt="CoastalClaw" width="100%"/>
</p>

<p align="center">
  <strong>A self-improving AI Agent OS — runs on your hardware, your data never leaves.</strong>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-first-boot-walkthrough">Walkthrough</a> ·
  <a href="#-features">Features</a> ·
  <a href="#-coastalos--bootable-usb">CoastalOS</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#%EF%B8%8F-configuration">Configuration</a> ·
  <a href="#-api-reference">API</a>
</p>

---

## What is CoastalClaw?

CoastalClaw is an open-source **AI Agent Operating System** you run on your own computer or server. Your data stays entirely on your hardware — nothing is sent to any cloud.

Think of it as a private AI command center: chat with intelligent agents, set them on automated schedules, build custom tools, and manage everything through a clean web interface.

**Who is this for?**
- People who want a private, local alternative to cloud AI services
- Teams that want shared AI agents with role-based access
- Developers who want to build and automate with AI tools
- Anyone who wants to run AI on their own hardware

---

## ✨ Features

| Feature | What it does |
|---------|-------------|
| **Chat** | Talk to AI agents that know your organization, remember past conversations, and can use tools |
| **Agent Voice** | Each agent can speak responses aloud — choose from browser voices or the built-in VibeVoice engine |
| **Skills Library** | Save reusable prompt templates with fill-in variables, triggered with `/command` shortcuts in chat |
| **Scheduled Agents** | Set agents to run automatically on a cron schedule — daily briefings, alerts, reports |
| **Multi-Agent Swarm** | Send complex tasks to a team of specialist agents (COO, CFO, CTO) that work in parallel |
| **Live Dashboard** | Real-time feed of all agent activity with built-in cron job management |
| **Analytics** | Tool call stats, success rates, cost tracking, 7-day trends |
| **Custom Tools** | Write JavaScript tools in the browser — agents call them automatically |
| **Output Channels** | Push agent messages to Telegram, Discord, Slack, or Zapier |
| **Multi-User Auth** | Username + password login with three roles: admin, operator, viewer |
| **Self-Build Loop** | The system can read its own code, propose improvements, and open pull requests |
| **Privacy First** | Entirely local inference — no external API required |

---

## 🚀 Quick Start

### Before you begin — what you need

| Requirement | Why |
|-------------|-----|
| Mac or Linux computer | Windows users: use [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) |
| Terminal / command line | To run the install script |
| ~3 GB free disk space | For the AI model and app |
| Internet connection | For first-time setup only — downloads the AI model |

> **New to terminals?** On Mac, press `Cmd + Space`, type "Terminal", and press Enter. On Linux, press `Ctrl + Alt + T`.

---

### Step 1 — Run the installer

**Mac / Linux** — open Terminal and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/install.sh | bash
```

**Windows** — open **PowerShell as Administrator** (`Right-click Start → Windows PowerShell (Admin)`) and paste:

```powershell
irm https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/install.ps1 | iex
```

> **Windows tip:** Don't use the regular `curl` command in PowerShell — it's a different tool that doesn't work with this installer. Use the `irm ... | iex` command above instead.

The installer will automatically:
- Install Git (if needed)
- Install Node.js (if needed)
- Install Ollama (the local AI engine)
- Download the AI model (~2 GB — this takes a few minutes on first run)
- Install CoastalClaw and its dependencies
- Start the app

When it finishes you'll see:

```
  ✔  Coastal Claw is running!

  Web portal:  http://127.0.0.1:5173
  Core API:    http://127.0.0.1:4747
```

Your browser will open automatically. If it doesn't, go to **http://127.0.0.1:5173** manually.

---

### Step 2 — Create your admin account

The first time you open CoastalClaw you'll see a setup screen. Choose a username and password — this creates your admin account.

> Write down your password somewhere safe. There is no "forgot password" recovery built in yet.

---

### Step 3 — Set up your persona

After logging in, the **Persona Setup** wizard will appear. Fill in:

- **Agent name** — what you want your AI assistant to call itself (e.g. "Aria")
- **Your name** — so the agent addresses you personally
- **Organization name** — your company or project name
- **Organization description** — 2–3 sentences about what your org does

This is saved once and injected into every agent in the system. You can change it anytime in **Settings**.

---

That's it. You're up and running.

---

## 🗺 First Boot Walkthrough

Here's a quick tour of the main areas:

### Chat

<p align="center">
  <img src="docs/screenshots/chat.png" alt="Chat interface" width="80%"/>
</p>

The main chat window. Type a message and press Enter. The agent responds with its name and voice (if configured).

**Tips:**
- Type `/` to browse your saved skills (prompt shortcuts)
- The agent remembers previous conversations in the same session
- Upload files (text, CSV, JSON) with the paperclip button

---

### Dashboard

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard" width="80%"/>
</p>

The **Dashboard** shows a live feed of everything happening — every tool call, session, and agent action in real time.

The top section shows your **Scheduled Jobs** (cron tasks). You can:
- Create a new scheduled task (e.g. "every day at 9am, summarize the news")
- Run any job immediately with the Play button
- Pause or delete jobs

---

### Agents

<p align="center">
  <img src="docs/screenshots/agents.png" alt="Agent editor" width="80%"/>
</p>

The **Agents** page lets you create and configure each AI agent. For each agent you can set:
- Name, role, and personality
- Which AI model it uses
- Its **voice** — pick from browser voices or the built-in VibeVoice engine
- Trust tier (sandboxed / trusted / autonomous)

Click **Preview** next to any voice to hear a sample before saving.

---

### Skills

<p align="center">
  <img src="docs/screenshots/skills.png" alt="Skills library" width="80%"/>
</p>

**Skills** are reusable prompt templates. Create one with variable slots like `{{topic}}` and `{{audience}}`, then call it from chat with `/skill-name`. A fill-in panel appears for the variables before the prompt is sent.

Example skill — *Blog Post Outline*:
```
Write a blog post outline about {{topic}} targeted at {{audience}}.
Use {{sections}} sections. Tone: {{tone}}.
```

---

### Analytics

<p align="center">
  <img src="docs/screenshots/analytics.png" alt="Analytics" width="80%"/>
</p>

The **Analytics** page shows usage stats across all agents: total sessions, tool call success rates, average response time, cost breakdown, and a 7-day activity chart.

---

### Tools

<p align="center">
  <img src="docs/screenshots/tools.png" alt="Custom tool builder" width="80%"/>
</p>

The **Tools** page lets you write custom JavaScript tools that agents can call. Write the function body, define its parameters, test it with sample input — all from the browser. No restart required.

---

### Channels

<p align="center">
  <img src="docs/screenshots/channels.png" alt="Output channels" width="80%"/>
</p>

**Channels** push agent messages out to external services. Add a Telegram bot, Discord webhook, Slack webhook, or Zapier hook — then agents can send messages there automatically, or you can broadcast manually.

---

## 💿 CoastalOS — Bootable USB

CoastalOS is a dedicated Linux image that runs CoastalClaw as a complete operating system. Boot from a USB drive — no installation required, nothing written to your machine's disk.

<p align="center">
  <img src="docs/screenshots/coastalos-desktop.png" alt="CoastalOS desktop" width="80%"/>
</p>

### What you need

- USB drive **8 GB or larger** (all data on it will be erased)
- Latest ISO from the [Releases page](https://github.com/CoastalCrypto/CoastalClaw_IO/releases)

---

### Writing the ISO to USB

**Easiest method (all platforms) — Balena Etcher:**

1. Download [Balena Etcher](https://etcher.balena.io) and open it
2. Click **Flash from file** → select the `.iso` file
3. Click **Select target** → select your USB drive
4. Click **Flash** and wait (~5 minutes)

That's all. Eject the drive when done.

---

**Mac (Terminal method):**

```bash
# Step 1: Find your USB drive name (look for "external" in the list)
diskutil list

# Step 2: Unmount it (replace disk2 with your drive)
diskutil unmountDisk /dev/disk2

# Step 3: Write the ISO (replace disk2 and the filename)
sudo dd if=~/Downloads/coastalos-1.0.0.iso of=/dev/rdisk2 bs=4m status=progress

# Step 4: Eject
diskutil eject /dev/disk2
```

> Use `/dev/rdisk2` (with the `r`) — it's faster than `/dev/disk2`.

---

**Linux (Terminal method):**

```bash
# Step 1: Find your USB drive (look for your drive size)
lsblk

# Step 2: Write the ISO (replace sdb and the filename)
sudo dd if=~/Downloads/coastalos-1.0.0.iso of=/dev/sdb bs=4M status=progress oflag=sync
```

> Double-check the drive letter (`sdb`, `sdc`, etc.) — writing to the wrong device will erase it.

---

### Booting from USB

1. Plug the USB drive into the computer you want to run CoastalOS on
2. Restart the computer
3. When the logo appears, press the boot menu key:
   - **Most PCs:** `F12`, `F11`, or `F9`
   - **HP:** `F9`
   - **Dell:** `F12`
   - **Lenovo:** `F12`
   - **Mac:** Hold `Option ⌥` immediately after the chime
4. Select your USB drive from the list
5. CoastalOS boots in ~30–60 seconds and opens the interface fullscreen

**Notes:**
- Your data (memory, persona, users) is stored on the USB — take it anywhere
- The AI model (~2 GB) is downloaded on first boot — internet required
- Requires UEFI firmware (most machines from 2012 onward)

---

## 🔧 Stopping and Starting

### If you installed with the install script

**Mac / Linux:**
```bash
# Stop
kill $(cat /tmp/coastal-claw-core.pid /tmp/coastal-claw-web.pid) 2>/dev/null

# Start again
bash install.sh
```

**Windows (PowerShell):**
```powershell
# Stop
Stop-Process -Id (Get-Content $env:TEMP\coastal-claw-core.pid) -ErrorAction SilentlyContinue
Stop-Process -Id (Get-Content $env:TEMP\coastal-claw-web.pid)  -ErrorAction SilentlyContinue

# Start again
irm https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/install.ps1 | iex
```

### If you installed via APT (Ubuntu/Debian)

```bash
sudo systemctl stop coastalclaw
sudo systemctl start coastalclaw
sudo systemctl status coastalclaw   # check it's running
```

---

## 🛠 Troubleshooting

| Problem | What to try |
|---------|-------------|
| Browser didn't open | Go to `http://127.0.0.1:5173` manually |
| "Port already in use" | Run `kill $(cat /tmp/coastal-claw-core.pid)` then restart |
| First response is very slow | Normal — the AI model loads into memory on first use (~30s) |
| Agent not responding | Check logs: `tail -f /tmp/coastal-claw-core.log` |
| Forgot your password | Delete `./data/users.db` and re-run setup (this resets all users) |
| Install script failed | Make sure you have `curl` installed: `which curl` |

---

## Ubuntu / Debian — APT install

For servers and production setups, install as a system service:

```bash
curl -fsSL https://CoastalCrypto.github.io/CoastalClaw_IO/setup.sh | sudo bash
```

This adds the signed APT repository and installs `coastalclaw` as a systemd service that starts automatically on boot.

---

## 🎭 Agent Persona

Set once in the **Settings** page — applied to all agents.

| Field | Description | Example |
|-------|-------------|---------|
| Agent Name | What your assistant calls itself | `Aria` |
| Agent Role | One-line role description | `Executive Assistant` |
| Personality | Free-text traits | `Professional, concise, proactive` |
| Org Name | Your organization | `Acme Corp` |
| Org Context | 2–4 sentences about your org | `We build fintech software...` |
| Owner Name | Your name — agents address you by this | `Jordan` |

---

## 🤖 Scheduled Agents (Cron Jobs)

Agents can run automatically on a schedule without any user input. Configure them from the **Dashboard**.

**Example schedules:**

| What you type | When it runs |
|---------------|-------------|
| `0 8 * * 1-5` | Weekdays at 8:00 AM |
| `0 */2 * * *` | Every 2 hours |
| `0 9 * * 1` | Every Monday at 9 AM |
| `30 17 * * 5` | Every Friday at 5:30 PM |

> Not familiar with cron syntax? Use [crontab.guru](https://crontab.guru) to build schedules visually.

---

## 🐝 Multi-Agent Swarm

For complex tasks, CoastalClaw can coordinate multiple specialist agents in parallel. Send a task to the team and get a synthesized result from the COO, CFO, and CTO agents working together.

```bash
curl -X POST http://localhost:4747/api/team/run \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze Q2 financials and prepare a board summary"}'
```

---

## 📣 Output Channels

Push agent messages to external services. Set up in the **Channels** tab.

| Channel | What you need |
|---------|--------------|
| **Telegram** | A Telegram bot token + your chat ID |
| **Discord** | A webhook URL from your server settings |
| **Slack** | A webhook URL from your workspace |
| **Zapier** | A catch-hook URL from your Zap |

All config is stored encrypted. You can test each channel individually or broadcast a message to all enabled channels at once.

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

| Tier | What agents can do |
|------|-------------------|
| `sandboxed` (default) | Isolated container — can't touch your files or system |
| `trusted` | Host shell access, restricted to the workspace directory |
| `autonomous` | Full unrestricted host shell — use with caution |

### User Roles

| Role | What they can access |
|------|---------------------|
| `admin` | Everything — all pages, user management, models, tools, channels |
| `operator` | Chat, dashboard, analytics — no user or model management |
| `viewer` | Chat and dashboard only |

---

## ⚙️ Configuration

### Environment variables

You can customize behavior by setting these before starting the app (or in a `.env` file):

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_PORT` | `4747` | API server port |
| `CC_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose on network) |
| `CC_DATA_DIR` | `./data` | Where data is stored (SQLite, persona, etc.) |
| `CC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama endpoint |
| `CC_DEFAULT_MODEL` | `llama3.2` | AI model to use |
| `CC_TRUST_LEVEL` | `sandboxed` | Agent trust tier |
| `CC_AGENT_WORKDIR` | `./data/workspace` | Agent sandbox folder |
| `CC_VLLM_URL` | `http://127.0.0.1:8000` | vLLM endpoint (optional, auto-probed) |
| `CC_AIRLLM_URL` | `http://127.0.0.1:8002` | AirLLM endpoint (optional, auto-probed) |
| `CC_VIBEVOICE_URL` | `http://127.0.0.1:8001` | VibeVoice TTS (optional, auto-probed) |
| `CC_CORS_ORIGINS` | `localhost:5173` | Allowed origins for the web UI |
| `CC_VRAM_BUDGET_GB` | `24` | GPU VRAM ceiling for model selection |

---

## 🔒 Security

### Protecting a production install

If you're running CoastalClaw on a server (not just locally), follow these steps:

- [ ] Put it behind a reverse proxy (nginx or Caddy) with HTTPS/TLS
- [ ] Set `CC_CORS_ORIGINS` to your actual domain
- [ ] Set `CC_HOST` to `127.0.0.1` (don't expose the API port directly)
- [ ] Put `CC_DATA_DIR` on encrypted storage
- [ ] Start with `sandboxed` trust tier
- [ ] Set a strong admin password

### API authentication

```bash
# Create admin account (first boot only)
curl -X POST http://localhost:4747/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Login — returns a session token
curl -X POST http://localhost:4747/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'

# Use the token on admin endpoints
curl http://localhost:4747/api/admin/channels \
  -H "x-admin-session: <your-session-token>"
```

Session tokens are HMAC-SHA256 signed with a 7-day TTL. Passwords are stored with scrypt (N=32768, r=8, p=1).

---

## 📡 API Reference

### Auth

```
GET  /api/auth/setup               → { needsSetup: boolean }
POST /api/auth/setup               { username, password } → { sessionToken, user }
POST /api/auth/login               { username, password } → { sessionToken, user }
GET  /api/auth/me                  → { user }
```

### Chat

```
POST /api/chat
  { "message": "...", "sessionId": "optional-uuid" }
  → { sessionId, reply, domain, model }

POST /api/chat/stream              (SSE streaming)
  event: domain   data: { domain }
  event: token    data: { token }
  event: reply    data: { reply }
  event: done     data: { sessionId, domain }
  event: error    data: { message }
```

### Skills

```
GET    /api/skills                 → [skill]  (enabled only)
GET    /api/admin/skills           → [skill]  (all)
POST   /api/admin/skills           { name, description, prompt, agentId? }
PATCH  /api/admin/skills/:id       { description?, prompt?, enabled? }
DELETE /api/admin/skills/:id
```

### Scheduled Jobs (Cron)

```
GET    /api/admin/crons            → [job]
POST   /api/admin/crons            { name, schedule, agentId, task }
PATCH  /api/admin/crons/:id        { name?, schedule?, agentId?, task?, enabled? }
DELETE /api/admin/crons/:id
POST   /api/admin/crons/:id/trigger  → { output }
```

### Agents

```
GET    /api/admin/agents           → [agent]
POST   /api/admin/agents           { name, role, soul, model?, voice?, trust? }
PATCH  /api/admin/agents/:id       { name?, role?, soul?, model?, voice?, trust? }
DELETE /api/admin/agents/:id
```

### Analytics

```
GET /api/analytics
  → { totalToolCalls, totalSessions, avgDurationMs, overallSuccessRate,
      topTools, last7Days, decisionBreakdown }
```

### Custom Tools

```
GET    /api/admin/tools            → [tool]
POST   /api/admin/tools            { name, description, parameters, implBody }
PATCH  /api/admin/tools/:id        { name?, description?, parameters?, implBody?, enabled? }
DELETE /api/admin/tools/:id
POST   /api/admin/tools/test       { implBody, parameters?, args? } → { output, success }
```

### Output Channels

```
GET    /api/admin/channels         → [channel]
POST   /api/admin/channels         { type, name, config }
PATCH  /api/admin/channels/:id     { name?, config?, enabled? }
DELETE /api/admin/channels/:id
POST   /api/admin/channels/:id/test   → { success }
POST   /api/admin/channels/broadcast  { message } → [{ id, name, success }]
```

### Users

```
GET    /api/admin/users            → [user]
POST   /api/admin/users            { username, password, role? }
PATCH  /api/admin/users/:id        { username?, password?, role? }
DELETE /api/admin/users/:id
```

### Team (multi-agent swarm)

```
POST /api/team/run
  { "task": "..." }
  → { reply, subtaskCount, subtasks: [{ subtaskId, reply }] }
```

### System

```
GET  /api/system/stats             → { cpu, mem, disk, gpu, models, uptime }
GET  /api/version                  → { version, commit }
GET  /api/voices                   → [{ id, name, provider }]
POST /api/admin/tts                { voice, text } → audio/wav
GET  /api/admin/logs?service=...&lines=100
POST /api/admin/update             (async: git pull → build → restart)
```

---

## 🧪 Testing

```bash
pnpm test                          # all packages
pnpm --filter core test
pnpm --filter daemon test
MOCK_NAMESPACE=1 pnpm test         # skip Linux namespace tests on Mac/CI
```

---

## 📂 Project Structure

```
CoastalClaw_IO/
├── packages/
│   ├── core/                      # Fastify API server (:4747)
│   │   └── src/
│   │       ├── users/             # Multi-user auth, scrypt, session tokens
│   │       ├── channels/          # Telegram / Discord / Slack / Zapier
│   │       ├── tools/custom/      # In-browser JS sandbox tool loader
│   │       ├── events/            # SSE ring buffer
│   │       ├── analytics/         # Action log + snapshots
│   │       ├── persona/           # Persona manager
│   │       ├── agents/            # AgenticLoop, BossAgent, MetaAgent, TeamChannel
│   │       ├── cron/              # Scheduled job store + croner scheduler
│   │       ├── skills/            # Skill template store
│   │       ├── models/            # ModelRouter, AirLLM, vLLM clients
│   │       ├── memory/            # UnifiedMemory + Infinity vector DB
│   │       ├── voice/             # VibeVoice TTS client
│   │       └── api/routes/        # All HTTP routes
│   ├── web/                       # React 19 + Tailwind + Vite 6
│   │   └── src/
│   │       ├── pages/             # Chat, Dashboard, Analytics, Skills, Tools, Agents...
│   │       ├── components/        # NavBar, AgentEditor
│   │       ├── context/           # AuthContext
│   │       └── hooks/             # useEventStream
│   ├── daemon/                    # Proactive scheduler + voice
│   ├── architect/                 # Self-build loop: Planner, Patcher, Validator
│   └── shell/                     # Electron kiosk (ClawShell)
├── coastalos/                     # CoastalOS ISO build
│   ├── build/                     # live-build config, smoke test
│   ├── systemd/                   # Service units
│   └── vibevoice/                 # Python FastAPI TTS/ASR service
├── packaging/                     # .deb build + APT repo publish scripts
├── agents/                        # Per-agent runtime config (cfo / coo / cto / general)
└── .github/workflows/             # CI: test suite, .deb build, ISO build, APT publish
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
| v1.1.0 | ✅ | Live dashboard, analytics, custom tool builder, output channels, multi-user auth |
| **v1.2.0** | ✅ | Skills library, cron scheduler, agent voice, version update banner, Electron auto-updater |

---

## 🙏 Open Source

| Project | How we use it |
|---------|--------------|
| **[Ollama](https://github.com/ollama/ollama)** | Local inference engine |
| **[Fastify](https://github.com/fastify/fastify)** | HTTP/WebSocket server |
| **[vLLM](https://github.com/vllm-project/vllm)** | GPU-accelerated inference |
| **[AirLLM](https://github.com/lyogavin/airllm)** | Layer-streaming for large models on small VRAM |
| **[Infinity](https://github.com/infiniflow/infinity)** | Hybrid vector database |
| **[Mem0](https://github.com/mem0ai/mem0)** | Personalized memory layer |
| **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** | Synchronous SQLite driver |
| **[croner](https://github.com/hexagon/croner)** | Zero-dependency cron scheduler |

---

## 🤝 Contributing

1. Fork the repo
2. `git checkout -b feat/your-feature`
3. `pnpm test` — keep all tests green
4. Open a pull request

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
