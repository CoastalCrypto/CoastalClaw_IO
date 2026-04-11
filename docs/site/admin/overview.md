---
title: Admin Overview
description: How the Coastal.AI admin system works.
---

# Admin Overview

The admin system controls model installation, domain assignment, and system configuration. It is protected by a token-based session authentication layer.

## Admin token

On first startup, Coastal.AI generates a random admin token and writes it to:

```
CC_DATA_DIR/.admin-token
```

The file is created with permissions `0o600` (owner read/write only). Read it with:

```bash
cat ~/coastal-ai/packages/core/data/.admin-token
```

> Keep this token secret. It grants full control over model management.

## Authentication flow

The admin API uses a two-step session auth system:

1. **Login** — POST your admin token to `/api/admin/login`. Receive a 24-hour HMAC session token.
2. **Subsequent requests** — Include the session token in the `x-admin-session` header.

This avoids sending the raw admin token on every request. The web portal handles this automatically after you enter your token in the login gate.

### Login request

```bash
curl -X POST http://127.0.0.1:4747/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"token": "your-admin-token"}'
```

Response:
```json
{
  "sessionToken": "1234567890:abc123:hmac_signature"
}
```

### Using the session token

```bash
curl http://127.0.0.1:4747/api/admin/models \
  -H "x-admin-session: <session-token>"
```

## Web portal admin login

When you navigate to **Models** or **Domains** in the web portal, you're prompted for your admin token. Enter it once — the session token is stored in `sessionStorage` for the duration of your browser session.

## Admin capabilities

| Capability | Description |
|-----------|-------------|
| List models | View all registered models with metadata |
| Install model | Download from Hugging Face and quantize |
| Delete model | Remove a model from the registry |
| View registry | See current domain ↔ model assignments |
| Update registry | Assign models to COO/CFO/CTO/General domains |
