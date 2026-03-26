---
title: Chat API
description: The main inference endpoint.
---

# Chat API

## POST /api/chat

Send a message and receive an AI response from the appropriate executive agent.

### Request

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "sessionId": "my-session-abc123",
  "message": "What should our hiring strategy be for Q3?"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `sessionId` | string | Yes | `^[a-zA-Z0-9_-]+$`, max 128 chars |
| `message` | string | Yes | 1–8192 chars |
| `model` | string | No | Override auto-routing; use a specific model ID |

### Response

```json
{
  "reply": "Based on your current headcount and growth targets...",
  "domain": "coo",
  "model": "llama3.1:q4_k_m",
  "sessionId": "my-session-abc123"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `reply` | string | The agent's response |
| `domain` | string | Which agent handled the request (`coo`, `cfo`, `cto`, `general`) |
| `model` | string | Model that produced the response (may differ from primary if fallback triggered) |
| `sessionId` | string | Echo of the request session ID |

### Error responses

| Status | Meaning |
|--------|---------|
| `400` | Invalid request body (failed JSON Schema validation) |
| `422` | No models assigned to the classified domain |
| `500` | All candidate models failed inference |

### Example

```bash
curl -X POST http://127.0.0.1:4747/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session-001",
    "message": "Review the architecture for our new payment service"
  }'
```

```json
{
  "reply": "Looking at the payment service architecture, I'd recommend...",
  "domain": "cto",
  "model": "llama3.1:q8_0",
  "sessionId": "session-001"
}
```

### Session continuity

Pass the same `sessionId` across multiple requests to maintain conversation context. The system retrieves the last 20 turns of history and includes them in the LLM prompt automatically.

Generate a new session ID for each fresh conversation:

```javascript
const sessionId = crypto.randomUUID()
```
