---
title: Introduction
description: What is Coastal.AI and why does it exist?
---

![Coastal.AI](/banner.png)

# Coastal.AI

**Your private AI executive team — running on your hardware. Data never leaves the facility.**

Coastal.AI is an AI agent operating system built by [Coastal Crypto](https://github.com/CoastalCrypto). It turns commodity GPU hardware into a JARVIS-grade AI infrastructure in under 20 minutes, with zero cloud dependency and zero per-token cost.

## What it does

The flagship product is the **AI Executive Suite** — three purpose-built agents that work like a real leadership team:

| Agent | Role | Specialisation |
|-------|------|----------------|
| **COO** | Chief Operating Officer | Operations, logistics, workflows, team management |
| **CFO** | Chief Financial Officer | Budget, forecasting, compliance, risk |
| **CTO** | Chief Technology Officer | Architecture, code review, engineering strategy |

Each agent maintains persistent memory across sessions, routes decisions through a multi-model consensus gate, and operates within defined governance guardrails.

## Why self-hosted?

- **Privacy** — conversations, documents, and business logic never leave your hardware
- **Cost** — no per-token API fees; one-time GPU investment
- **Speed** — sub-100 ms local inference on models you control
- **Customisation** — pull any Hugging Face model, quantize it, assign it to a domain

## How it works

```
User message
    │
    ▼
Domain Classifier (COO / CFO / CTO / General)
    │
    ▼
VRAM-aware Model Router  ──► Fallback cascade
    │
    ▼
Ollama inference
    │
    ▼
Unified Memory  (LosslessDB → Mem0 flush)
    │
    ▼
Response
```

## Open-source foundations

Coastal.AI stands on the shoulders of these projects:

- [**Ollama**](https://ollama.com) — local LLM serving
- [**OpenClaw**](https://openclaw.ai) — inspiration for the one-line installer pattern
- [**llama.cpp**](https://github.com/ggerganov/llama.cpp) — quantization backbone
- [**Mem0**](https://github.com/mem0ai/mem0) — long-term memory layer
- [**better-sqlite3**](https://github.com/WiseLibs/better-sqlite3) — lossless session storage
- [**Fastify**](https://fastify.dev) — core API server
- [**React**](https://react.dev) + [**Vite**](https://vitejs.dev) + [**Tailwind v4**](https://tailwindcss.com) — web portal
- [**HKUDS / ClawTeam**](https://github.com/HKUDS) — multi-agent parallelism research
- [**CrewAI**](https://github.com/crewAIInc/crewAI) — agent orchestration patterns
- [**Andrej Karpathy**](https://github.com/karpathy) — foundational ML education
