---
title: Intelligent Routing
description: How Coastal.AI classifies messages and selects models.
---

# Intelligent Routing

The routing layer is the brain of Coastal.AI. Every incoming message passes through a two-stage pipeline before reaching Ollama.

## Stage 1: Domain classification

The classifier determines which executive agent should handle the request.

### Fast-path (rules-based)

Keyword matching runs first. If strong domain signals are detected (e.g. "budget", "cash flow" → CFO; "deploy", "architecture" → CTO), the message is routed immediately without an LLM call.

### LLM-based classification

If the rules classifier isn't confident enough (below `CC_ROUTER_CONFIDENCE`), a small LLM call classifies the message into one of:

| Domain | Description |
|--------|-------------|
| `coo` | Operations, logistics, team management, workflows |
| `cfo` | Finance, budgeting, compliance, risk |
| `cto` | Technology, architecture, code, engineering |
| `general` | Anything that doesn't fit a specific domain |

The classification also extracts:
- **Urgency** (`high` / `medium` / `low`) — affects which model tier is selected
- **Complexity** — factored into the routing decision

> The user message is truncated to 2,000 characters before the classification LLM call to prevent prompt injection and reduce cost.

## Stage 2: VRAM-aware model selection

`CascadeRouter` maps `(domain, urgency)` → `(primary model, fallbackModels[])`.

### Primary selection

The registry is queried for the model assigned to `domain.urgency`. If that model exceeds the `CC_VRAM_BUDGET_GB` limit, the next-smaller quant variant is tried.

### Fallback cascade

If the primary model fails (OOM, Ollama error, timeout), the router automatically tries:

1. Other quantization variants of the same base model
   - Order: Q5_K_M → Q4_K_M → Q8_0 (skipping the one that failed)
2. The general domain model at the same urgency tier

The caller always receives a response — the final `RouteDecision` includes the `model` field indicating which candidate was used.

## Configuration

```env
CC_ROUTER_CONFIDENCE=0.7   # 0.0–1.0; lower = more LLM calls, higher accuracy
CC_VRAM_BUDGET_GB=24       # skip models larger than this
```

## RouteDecision shape

```typescript
interface RouteDecision {
  model: string                              // model ultimately used
  fallbackModels: string[]                   // ordered candidates tried on failure
  domain: 'coo' | 'cfo' | 'cto' | 'general'
  signals: RouteSignals
  domainConfidence: number                   // 0.0–1.0
  classifiedBy: 'rules' | 'llm'
}
```
