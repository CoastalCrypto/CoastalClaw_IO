---
title: Architecture Overview
description: How the Coastal Claw system is structured.
---

# Architecture Overview

Coastal Claw is a TypeScript/Node.js monorepo with two packages:

```
CoastalClaw_IO/
├── packages/
│   ├── core/          # Fastify API, routing, memory, model management
│   └── web/           # React + Vite + Tailwind v4 web portal
├── docs/site/         # Documentation (Mintlify)
├── assets/            # Logo, banner
└── install.sh         # One-line installer
```

## Package: core

The core service runs on port 4747 and exposes a REST API. Internally:

```
src/
├── server.ts                    # Fastify instance, CORS, plugins, route registration
├── config.ts                    # Env var parsing and validation
├── api/routes/
│   ├── chat.ts                  # POST /api/chat — main inference endpoint
│   ├── admin.ts                 # /api/admin/* — model management, auth
│   └── health.ts                # GET /health
├── routing/
│   ├── types.ts                 # RouteDecision, RouteSignals interfaces
│   ├── cascade.ts               # CascadeRouter — VRAM-aware selection + fallbacks
│   ├── domain-classifier.ts     # LLM-based COO/CFO/CTO/general classification
│   └── rules-classifier.ts      # Keyword-based fast-path classifier
├── models/
│   ├── router.ts                # ModelRouter — orchestrates routing + Ollama calls
│   ├── registry.ts              # ModelRegistry — SQLite-backed model store
│   ├── vram.ts                  # VRAMManager — tracks available VRAM
│   └── quantizer.ts             # QuantizationPipeline — HF download + llama.cpp quant
└── memory/
    └── index.ts                 # UnifiedMemory — LosslessDB + Mem0 integration
```

## Package: web

The web portal is a Vite SPA served via `pnpm preview` on port 5173.

```
src/
├── pages/
│   ├── Chat.tsx                 # Main chat interface
│   ├── Models.tsx               # Model management (admin-gated)
│   └── Domains.tsx              # Domain ↔ model assignment (admin-gated)
├── api/
│   └── client.ts                # CoreClient — typed fetch wrapper + session auth
└── components/
    └── AdminLoginGate.tsx        # Token-based login form
```

## Request lifecycle

```
POST /api/chat
  │
  ├─ Input validation (Fastify JSON Schema)
  │    sessionId: ^[a-zA-Z0-9_-]+$, maxLength 128
  │    message: minLength 1, maxLength 8192
  │
  ├─ UnifiedMemory.queryHistory(sessionId, limit=20)
  │    └─ fire-and-forget flushOldEntries() to Mem0
  │
  ├─ ModelRouter.chat(message, history)
  │    ├─ DomainClassifier → COO/CFO/CTO/general + urgency
  │    ├─ CascadeRouter → primary model + fallbackModels[]
  │    └─ Ollama inference (with cascade on failure)
  │
  ├─ UnifiedMemory.remember(sessionId, user + assistant turns)
  │
  └─ Response { reply, domain, model, sessionId }
```

## Data persistence

| Store | Technology | Purpose |
|-------|-----------|---------|
| Session history | SQLite (better-sqlite3) | Full lossless turn-by-turn log |
| Long-term memory | Mem0 (vector store) | Compressed semantic memory across sessions |
| Model registry | SQLite | Model metadata, domain assignments |
| Admin token | File (`data/.admin-token`, mode 0600) | Single admin credential |
