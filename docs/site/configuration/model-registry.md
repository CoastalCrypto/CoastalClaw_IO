---
title: Model Registry
description: How Coastal.AI tracks and assigns models to agent domains.
---

# Model Registry

The model registry is a SQLite-backed store (`CC_DATA_DIR/registry.db`) that tracks every model available for inference and maps them to agent domains.

## How models get registered

When you install a model via the Admin API or web portal, Coastal.AI:

1. Starts a `QuantizationPipeline` job (downloads from Hugging Face, quantizes via llama.cpp)
2. Writes the resulting GGUF file to `CC_DATA_DIR/models/`
3. Registers the model in the registry with metadata (size, quant level, source)
4. Makes the model available for domain assignment

## Model IDs

Models are identified by `<baseName>:<quantLevel>`, for example:

- `llama3.1:q4_k_m`
- `mistral:q8_0`
- `llama3.2:3b`

## Domain assignment

Each agent domain (COO, CFO, CTO, General) has three model slots:

| Slot | Use case |
|------|----------|
| `high` | Complex reasoning, multi-step tasks |
| `medium` | Standard queries |
| `low` | Simple lookups, quick responses |

The router selects the slot based on query complexity signals extracted during classification.

### Assigning models via the web portal

1. Go to **Models** and install at least one model
2. Go to **Domains**
3. For each domain, select a model for `high`, `medium`, and `low` tiers
4. Click **Save**

### Assigning models via the API

```bash
curl -X PATCH http://127.0.0.1:4747/api/admin/registry \
  -H "x-admin-session: <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "cfo": {
      "high": "llama3.1:q8_0",
      "medium": "llama3.1:q4_k_m",
      "low": "llama3.2:3b"
    }
  }'
```

## Fallback cascade

When the primary model fails (OOM, timeout, Ollama error), the router automatically tries:

1. Other quantization variants of the same base model (ordered: Q5_K_M → Q4_K_M → Q8_0)
2. The general domain model at the same urgency tier

This cascade is transparent to the caller — the response always indicates which model was ultimately used.

## VRAM budgeting

The `CC_VRAM_BUDGET_GB` setting limits which models the router will attempt to load. Models larger than the budget are skipped in the fallback cascade. Set this to your GPU's VRAM in GB.
