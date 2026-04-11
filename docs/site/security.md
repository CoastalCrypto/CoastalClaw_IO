---
title: Security
description: Security architecture and hardening guide for Coastal.AI.
---

# Security

Coastal.AI is designed for on-premise deployment with a privacy-first architecture. This page documents the security controls in place and recommendations for hardening your deployment.

## Built-in controls

| Control | Implementation |
|---------|---------------|
| Admin authentication | HMAC-SHA256 session tokens, 24h TTL |
| Token storage | `data/.admin-token` with `0o600` permissions |
| CORS | Locked to `CC_CORS_ORIGINS`; no wildcard support |
| Input validation | Fastify JSON Schema on all endpoints |
| Message length cap | 8,192 chars max on `/api/chat` |
| Classification prompt injection | User message truncated to 2,000 chars before LLM classification |
| Session ID validation | Regex `^[a-zA-Z0-9_-]+$`, max 128 chars |
| SSRF warning | Startup warning if `CC_OLLAMA_URL` points to non-localhost |
| Model ID validation | `quantId` validated against registry before DELETE |
| Quantization level enum | Restricted to `Q4_K_M`, `Q5_K_M`, `Q8_0` |

## Network hardening

By default, both services bind to `127.0.0.1` — they are only reachable from the local machine. To expose them on a LAN or the internet, you **must** add a reverse proxy with TLS.

### Recommended: nginx reverse proxy with TLS

```nginx
server {
    listen 443 ssl;
    server_name ai.yourcompany.internal;

    ssl_certificate     /etc/ssl/certs/ai.crt;
    ssl_certificate_key /etc/ssl/private/ai.key;

    location /api/ {
        proxy_pass http://127.0.0.1:4747;
    }

    location / {
        proxy_pass http://127.0.0.1:5173;
    }
}
```

Then update your CORS config:

```env
CC_CORS_ORIGINS=https://ai.yourcompany.internal
```

## Admin token rotation

To rotate the admin token:

```bash
# Stop core service
kill $(cat /tmp/coastal-ai-core.pid)

# Delete the token file (a new one will be generated on next start)
rm ~/coastal-ai/packages/core/data/.admin-token

# Restart
cd ~/coastal-ai && node packages/core/dist/index.js &
cat packages/core/data/.admin-token
```

## Data privacy

- All inference happens locally via Ollama — no messages leave your machine
- Session history is stored in `CC_DATA_DIR/sessions.db` (SQLite) — local only
- Mem0 long-term memory is stored locally by default

## Security checklist

- [ ] Admin token stored securely (not in code, not in env files committed to git)
- [ ] `CC_CORS_ORIGINS` set to your exact frontend origin
- [ ] TLS termination at reverse proxy if exposed beyond localhost
- [ ] `CC_OLLAMA_URL` points to localhost unless you have a firewalled trusted host
- [ ] `CC_DATA_DIR` excluded from git (`.gitignore` already handles `packages/core/data/`)
- [ ] Firewall rules prevent external access to ports 4747 and 5173 directly

## Reporting vulnerabilities

Please report security vulnerabilities via GitHub Issues with the `security` label, or contact the Coastal Crypto team directly.
