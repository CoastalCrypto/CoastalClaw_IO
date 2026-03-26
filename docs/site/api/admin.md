---
title: Admin API
description: REST endpoints for model and domain management.
---

# Admin API

All admin endpoints require authentication. See [Admin → Overview](/admin/overview) for the login flow.

**Auth header**: `x-admin-session: <session-token>`
(Legacy: `x-admin-token: <raw-token>` also accepted for backward compatibility)

---

## POST /api/admin/login

Exchange your raw admin token for a 24-hour session token.

**No auth required.**

```http
POST /api/admin/login
Content-Type: application/json
```

```json
{ "token": "your-admin-token" }
```

Response `200`:
```json
{ "sessionToken": "1711234567890:abc123def456:hmac_sig" }
```

Response `401` — invalid token.

---

## GET /api/admin/models

List all registered models.

```bash
curl http://127.0.0.1:4747/api/admin/models \
  -H "x-admin-session: <token>"
```

Response `200`:
```json
[
  {
    "id": "llama3.1:q4_k_m",
    "hfSource": "meta-llama/Meta-Llama-3.1-8B",
    "baseName": "llama3.1",
    "quantLevel": "Q4_K_M",
    "sizeGb": 4.9
  }
]
```

---

## POST /api/admin/models/add

Start a model installation job (download + quantize).

```json
{
  "hfModelId": "meta-llama/Meta-Llama-3.1-8B",
  "quants": ["Q4_K_M", "Q8_0"],
  "sessionId": "install-progress-stream"
}
```

| Field | Type | Values |
|-------|------|--------|
| `hfModelId` | string | Any public Hugging Face model ID |
| `quants` | array | `"Q4_K_M"`, `"Q5_K_M"`, `"Q8_0"` |
| `sessionId` | string | Used to stream progress via WebSocket |

Response `202 Accepted`:
```json
{ "hfModelId": "meta-llama/Meta-Llama-3.1-8B", "status": "queued" }
```

---

## DELETE /api/admin/models/:quantId

Remove a registered model.

```bash
curl -X DELETE http://127.0.0.1:4747/api/admin/models/llama3.1:q4_k_m \
  -H "x-admin-session: <token>"
```

Response `204 No Content`
Response `404` — model not found in registry
Response `401` — missing/invalid auth

---

## GET /api/admin/registry

Get current domain ↔ model assignments.

Response `200`:
```json
{
  "coo": { "high": "llama3.1:q8_0", "medium": "llama3.1:q4_k_m", "low": "llama3.2:3b" },
  "cfo": { "high": "llama3.1:q8_0", "medium": "llama3.1:q4_k_m", "low": "llama3.2:3b" }
}
```

Returns `{}` if no assignments have been saved.

---

## PATCH /api/admin/registry

Update domain ↔ model assignments. You can update one or all domains in a single call.

```json
{
  "cto": {
    "high": "llama3.1:q8_0",
    "medium": "llama3.1:q4_k_m",
    "low": "llama3.2:3b"
  }
}
```

Response `200`:
```json
{ "ok": true }
```

Response `422` — one or more model IDs are not in the registry.
