---
title: Model Management
description: Installing, listing, and removing models.
---

# Model Management

## Installing a model

Models are downloaded from Hugging Face and quantized locally via llama.cpp.

### Via web portal

1. Go to **Models**
2. Enter your admin token if prompted
3. Click **Install Model**
4. Enter a Hugging Face model ID (e.g. `meta-llama/Meta-Llama-3.1-8B`)
5. Select quantization levels (`Q4_K_M`, `Q5_K_M`, `Q8_0`)
6. Click **Install** — a progress stream starts via SSE

### Via API

```bash
curl -X POST http://127.0.0.1:4747/api/admin/models/add \
  -H "x-admin-session: <session-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hfModelId": "meta-llama/Meta-Llama-3.1-8B",
    "quants": ["Q4_K_M", "Q8_0"],
    "sessionId": "install-session-1"
  }'
```

Response `202 Accepted`:
```json
{
  "hfModelId": "meta-llama/Meta-Llama-3.1-8B",
  "status": "queued"
}
```

Progress is streamed via WebSocket to the provided `sessionId`.

## Listing models

```bash
curl http://127.0.0.1:4747/api/admin/models \
  -H "x-admin-session: <session-token>"
```

Response:
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

## Deleting a model

```bash
curl -X DELETE http://127.0.0.1:4747/api/admin/models/llama3.1:q4_k_m \
  -H "x-admin-session: <session-token>"
```

Response: `204 No Content`

> Models currently assigned to a domain cannot be deleted until reassigned.

## Supported quantization levels

| Level | Description | VRAM (8B model) |
|-------|-------------|-----------------|
| `Q4_K_M` | 4-bit mixed — best quality/size balance | ~5 GB |
| `Q5_K_M` | 5-bit mixed — higher quality | ~6 GB |
| `Q8_0` | 8-bit — near full quality | ~9 GB |

## Recommended models

| Model | HF ID | Use case |
|-------|-------|----------|
| Llama 3.1 8B | `meta-llama/Meta-Llama-3.1-8B` | General purpose, strong reasoning |
| Llama 3.2 3B | `meta-llama/Llama-3.2-3B` | Fast, low-memory tasks |
| Mistral 7B | `mistralai/Mistral-7B-v0.1` | Instruction following |
| Qwen 2.5 7B | `Qwen/Qwen2.5-7B-Instruct` | Multilingual, coding |
