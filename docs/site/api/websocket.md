---
title: WebSocket
description: Real-time progress streaming for model installation.
---

# WebSocket

Coastal Claw uses a WebSocket connection to stream real-time progress updates during model installation.

## Connecting

```javascript
const ws = new WebSocket('ws://127.0.0.1:4747/ws')

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log(msg)
}
```

## Message format

All messages share a common envelope:

```typescript
interface WsMessage {
  type: 'progress' | 'complete' | 'error' | 'log'
  sessionId: string
  payload: unknown
}
```

### Progress message

```json
{
  "type": "progress",
  "sessionId": "install-session-1",
  "payload": {
    "stage": "quantizing",
    "percent": 42,
    "message": "Quantizing layer 18/32..."
  }
}
```

### Complete message

```json
{
  "type": "complete",
  "sessionId": "install-session-1",
  "payload": {
    "modelId": "llama3.1:q4_k_m",
    "sizeGb": 4.9
  }
}
```

### Error message

```json
{
  "type": "error",
  "sessionId": "install-session-1",
  "payload": {
    "message": "Download failed: 403 Forbidden — model is gated, login to Hugging Face first"
  }
}
```

## Filtering by sessionId

Subscribe to a specific installation job by filtering on `sessionId`. This must match the `sessionId` you passed to `POST /api/admin/models/add`.

```javascript
const TARGET_SESSION = 'install-abc123'

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.sessionId !== TARGET_SESSION) return
  if (msg.type === 'complete') {
    console.log('Model ready:', msg.payload.modelId)
    ws.close()
  }
}
```

## Web portal usage

The Models page opens a WebSocket connection automatically when you start a model installation and renders a live progress bar using the streamed `percent` values.
