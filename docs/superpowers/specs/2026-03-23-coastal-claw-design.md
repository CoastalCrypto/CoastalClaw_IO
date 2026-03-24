# Coastal Claw — System Design Specification

**Date:** 2026-03-23
**Status:** Approved — Ready for Implementation
**Owner:** Coastal Crypto

---

## 1. Vision

Coastal Claw is an AI agent operating system that combines the best of the OpenClaw ecosystem into one unified, JARVIS-grade platform. It reduces the 4–6 hour OpenClaw setup to 15–20 minutes, serves non-technical clients through an Abacus.ai-style web portal, power users through a futuristic Electron desktop app, and operators through a True TUI — all backed by Coastal Crypto's on-premise GPU facility.

**Elevator pitch:** _"Your private AI executive team, running on our hardware, with your data never leaving our facility."_

---

## 2. Target Users

| User | Interface | Use Case |
|---|---|---|
| Non-technical client | Web Portal | Exec Suite subscription — chat with COO/CFO/CTO agents |
| Agency client | Web + Electron | Full agent team management, custom workflows |
| Power user / developer | Electron + TUI | Self-hosted, local models, full control |
| CC sysadmin | TUI | Facility management, tenant provisioning, monitoring |

---

## 3. Architecture

### 3.1 Deployment Model

**Coastal Crypto Facility (On-Premise)**
- CC owns physical GPU servers — no AWS middleman
- All inference runs on CC hardware by default
- Per-client encrypted storage volumes
- WireGuard VPN per client — zero-trust access
- Clients opt-in to external APIs (Anthropic, OpenAI, Gemini) — never default

**Self-Hosted (Power Users)**
- Full Coastal Claw instance runs on user's machine
- Connects to CC facility for GPU overflow or cloud model routing
- Same codebase, different deployment target

### 3.2 Three Interfaces, One Engine

All three interfaces connect to the **Coastal Claw Core Service** via REST + WebSocket on port `:4747`. The core auto-starts on boot (like Ollama). State is shared — a session started in the web portal appears live in the Electron app.

```
┌─────────────────────────────────────┐
│       Coastal Claw Core :4747       │
│  OpenClaw + LosslessClaw + Memory   │
│  Agent Lifecycle + Model Router     │
└──────┬──────────┬──────────┬────────┘
       │          │          │
  Web App     Electron     TUI CLI
 (browser)   (JARVIS HUD)  (admin)
```

**Web App** — React SPA. Abacus.ai-style card-based onboarding. Hosted on Coastal Crypto site + local. WebRTC voice/video.
**Electron App** — JARVIS HUD with floating neural net main agent, deck.gl live agent map, Three.js animations, native mic/camera.
**True TUI** — Go binary. Config, deploy, tenant management, LosslessClaw DB inspector. SSH-friendly.

### 3.3 Orchestration Trinity

Three complementary systems handle different dimensions of agent coordination:

- **OpenMOSS** — Self-organizing middleware. Planner → Executor → Reviewer → Patrol roles. Agents wake via cron, claim tasks, execute autonomously. Built on OpenClaw natively.
- **Paperclip** — Enterprise governance. Org charts, monthly budget caps, approval gates, full audit logs. Prevents runaway agent spend.
- **CrewAI** — Python-side YAML agent team definitions. Defines role blueprints for Exec Suite agents. Crews (autonomous) + Flows (event-driven).
- **Symphony** — Task execution with proof-of-work. Work items → agents → CI status + evidence → auto-land on acceptance.
- **Polsia** — MCP server integration patterns for external tool connectivity.

### 3.4 Hybrid Memory Stack

Five tiers, unified read path, all writing to the same underlying storage spine:

| Tier | System | Purpose |
|---|---|---|
| Active context | **QMD** (OpenClaw native) | 24/7 session continuity, cross-channel |
| Lossless history | **LosslessClaw** | DAG compression, lcm_grep/expand any history |
| Personalization | **Mem0** | User + agent preference learning |
| Consolidation | **Always-On Agent** (Google ADK pattern) | 30-min background memory consolidation, multimodal ingest |
| Storage spine | **Unix-FS** (Ken Thompson) | Everything-is-a-file, flat files + SQLite, inspectable |

### 3.5 Intelligence Layer

- **MiroFish** — Swarm simulation engine (OASIS/CAMEL-AI). Simulate client outcomes before deploying real agents. Feeds live state into deck.gl visualization. GraphRAG knowledge graph.
- **LLM Council** (Karpathy) — Multi-model consensus for critical decisions. Multiple models answer independently, critique each other blind, chairman synthesizes. Quality gate for Exec Suite agent outputs.

### 3.6 Visualization

- **deck.gl** (vis.gl) — WebGL2/WebGPU agent network map. Renders active agents as animated nodes, arc layers for inter-agent communication. The JARVIS ops screen. GPU-accelerated.
- **Three.js** — Floating neural net animation for the main agent interaction UI in Electron.

### 3.7 On-Prem Infrastructure

- **GPU Inference Cluster** — Ollama + vLLM serving pool. Per-agent model designation. RTX 4090 / A100 class hardware.
- **Transformers** (Karpathy/HuggingFace) — On-premise fine-tuning on CC's GPU cluster. Custom model variants on client data.
- **NemoClaw / OpenShell** — Sandbox isolation per tenant. Landlock + seccomp + network namespace. Policy-governed inference routing.
- **gstack** — 28-skill engineering workflow toolkit pre-loaded into all coding agents. /cso security, /qa, /ship built in.

---

## 4. Exec Suite Agent Blueprints

The AI-Agent-Executive-Suite runs as a product on top of Coastal Claw. Agent names are role titles (not fixed names):

| Blueprint | Role | Powered By |
|---|---|---|
| Virtual COO | Operations, process, hiring strategy | CrewAI blueprint + LLM Council |
| Virtual CFO | Burn rate, fundraising, financial forecasting | CrewAI blueprint + LLM Council |
| Virtual CTO | Tech stack, architecture, hiring | CrewAI blueprint + LLM Council |
| + Custom | Client-defined agents | Any blueprint |

Each blueprint is governed by Paperclip (budget caps, approval gates, audit trail). Symphony delivers proof-of-work receipts for completed tasks.

---

## 5. Onboarding Flow (15–20 min target)

### Cloud Client (Web Portal)
1. Land on Coastal Crypto site → "Get Started" card
2. 5-question onboarding wizard (company, goals, focus area)
3. Document upload (pitch deck, financials — optional)
4. Auto-provisioning: CC facility spins up tenant namespace, loads blueprint
5. First agent response within 60 seconds
6. **Total: ~10 minutes**

### Self-Hosted Power User
1. `curl -fsSL coastalcrypto.com/install.sh | bash`
2. Guided setup wizard (model selection, API keys, storage path)
3. Auto-detect local GPU → configure Ollama
4. First agent running
5. **Total: ~20 minutes**

---

## 6. Tech Stack Summary

| Layer | Technology |
|---|---|
| Core service | TypeScript / Node.js 22 |
| Web frontend | React + Tailwind + WebRTC |
| Electron shell | Electron + Three.js + deck.gl |
| TUI | Go |
| Agent orchestration | OpenMOSS (FastAPI/Python) + CrewAI (Python) |
| Governance | Paperclip (Node.js/TypeScript/PostgreSQL) |
| Task execution | Symphony (Elixir + SPEC.md) |
| Memory | QMD + LosslessClaw (SQLite) + Mem0 + Always-On (Python/SQLite) |
| Simulation | MiroFish (Python + Vue) |
| Visualization | deck.gl (WebGL2) + Three.js |
| Inference | Ollama + vLLM (on-prem) + OpenAI-compat proxy |
| Fine-tuning | Transformers (PyTorch/CUDA) |
| Sandbox | NemoClaw / OpenShell (Docker + Landlock) |
| MCP integration | Polsia patterns |
| Dev workflow | gstack (28 skills) |
| Security | WireGuard VPN + zero-trust + OpenShell sandbox |
| Monitoring | Prometheus + Grafana |
| Package manager | pnpm (JS) + uv (Python) |

---

## 7. Phased Build Plan

### Phase 1 — Foundation (Core + Web + Memory)
- Coastal Claw core service (REST + WebSocket, :4747)
- OpenClaw + LosslessClaw integration
- QMD + Mem0 memory stack
- Basic React web portal (onboarding wizard + chat)
- Ollama local model routing
- WireGuard tenant isolation

### Phase 2 — Orchestration + Exec Suite
- OpenMOSS integration (Planner/Executor/Reviewer/Patrol)
- CrewAI COO/CFO/CTO blueprints
- Paperclip governance layer
- LLM Council quality gate
- Auto-provisioning for CC facility tenants

### Phase 3 — JARVIS Electron App
- Electron desktop shell
- Three.js floating neural net main agent
- deck.gl live agent map
- Native voice (STT/TTS) + video/image ingest
- Always-On memory consolidation

### Phase 4 — Intelligence + Simulation
- **ClawTeam agent swarm** (https://github.com/HKUDS/ClawTeam) — dependency-aware multi-agent task orchestration with git worktree isolation per agent. Each Exec Suite agent runs in its own worktree and communicates via a filesystem inbox. Enables true parallel agent execution where COO/CFO/CTO agents can work concurrently on independent tasks without file conflicts.
- MiroFish swarm simulation integration
- Symphony proof-of-work task execution
- Transformers on-prem fine-tuning pipeline
- True TUI (Go binary)
- Auto-update blueprint engine

### Phase 5 — Production + Scale
- Full NemoClaw/OpenShell sandbox hardening
- Monitoring (Prometheus + Grafana)
- Coastal Crypto website integration
- Public launch + agency client onboarding

---

## 8. Competitive Moat

1. **Privacy** — Data never leaves CC's facility. On-prem GPU inference. No cloud API dependency.
2. **JARVIS UX** — Floating neural net, deck.gl agent visualization, voice/video — no competitor has this aesthetic.
3. **LLM Council quality gate** — Exec Suite agents validated by model consensus, not single-model trust.
4. **Lossless memory** — LosslessClaw DAG means agents never forget anything. Ever.
5. **MiroFish simulation** — Test agent scenarios before deploying real agents. Unique prediction capability.
6. **Predictable pricing** — CC owns the hardware. No per-token cloud cost spiral.

---

## 9. Open Questions

1. Hardware spec for Phase 1 CC facility deployment (GPU count, VRAM, storage)?
2. Coastal Crypto website integration timeline — link web portal before or after Phase 2?
3. First Exec Suite client target for beta — which tier (Starter or Pro)?
4. Self-hosted pricing model vs cloud subscription tiers?
