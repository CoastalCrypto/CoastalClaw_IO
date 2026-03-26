---
title: Domain Assignment
description: Assigning models to COO, CFO, CTO, and General domains.
---

# Domain Assignment

Each agent domain has three model tiers — `high`, `medium`, and `low` — corresponding to query complexity. Assign at least one model to each domain before using the chat interface.

## Via web portal

1. Go to **Domains**
2. For each domain (COO, CFO, CTO, General), use the dropdowns to select:
   - **High** — complex, multi-step queries
   - **Medium** — standard queries
   - **Low** — simple lookups
3. Click **Save Registry**

Only models already registered via the Models page appear in the dropdowns.

## Via API

```bash
curl -X PATCH http://127.0.0.1:4747/api/admin/registry \
  -H "x-admin-session: <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "coo": {
      "high": "llama3.1:q8_0",
      "medium": "llama3.1:q4_k_m",
      "low": "llama3.2:3b"
    },
    "cfo": {
      "high": "llama3.1:q8_0",
      "medium": "llama3.1:q4_k_m",
      "low": "llama3.2:3b"
    },
    "cto": {
      "high": "llama3.1:q8_0",
      "medium": "llama3.1:q4_k_m",
      "low": "llama3.2:3b"
    },
    "general": {
      "high": "llama3.1:q4_k_m",
      "medium": "llama3.2:3b",
      "low": "llama3.2:3b"
    }
  }'
```

Response `200 OK`:
```json
{ "ok": true }
```

Returns `422 Unprocessable Entity` if any referenced model is not registered.

## Viewing the current registry

```bash
curl http://127.0.0.1:4747/api/admin/registry \
  -H "x-admin-session: <session-token>"
```

## Domain routing signals

The routing layer classifies messages based on these signals:

| Domain | Strong signals |
|--------|---------------|
| COO | operations, logistics, team, workflow, process, hiring |
| CFO | budget, finance, cash, invoice, compliance, forecast |
| CTO | code, architecture, deploy, infrastructure, security |
| General | anything not matching the above |

Classification confidence is reported in every chat response, letting you tune `CC_ROUTER_CONFIDENCE` to balance speed vs. accuracy.
