---
title: Environment Variables
description: Full reference for all Coastal Claw environment variables.
---

# Environment Variables

Configuration lives in two `.env.local` files — one per package. These files are gitignored and never committed.

## Core service (`packages/core/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_PORT` | `4747` | Port the core API listens on |
| `CC_HOST` | `127.0.0.1` | Bind address. Set to `0.0.0.0` to expose on LAN |
| `CC_DATA_DIR` | `./data` | Directory for SQLite DB, admin token, model files |
| `CC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama API base URL |
| `CC_DEFAULT_MODEL` | `llama3.2` | Fallback model when no domain assignment exists |
| `CC_VRAM_BUDGET_GB` | `24` | VRAM budget in GB for model loading decisions |
| `CC_ROUTER_CONFIDENCE` | `0.7` | Minimum classifier confidence to use LLM routing (0–1) |
| `CC_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed CORS origins |
| `CC_ADMIN_TOKEN` | Auto-generated | Override the auto-generated admin token (testing only) |

### Security notes

- **`CC_OLLAMA_URL`** — Coastal Claw warns at startup if this points to a non-localhost host. Allowing external Ollama endpoints creates an SSRF risk; only use trusted, firewalled hosts.
- **`CC_CORS_ORIGINS`** — Always restrict to the exact origins your web portal uses. Wildcards (`*`) are not supported.
- **`CC_ADMIN_TOKEN`** — Only set this in development/testing. In production, let it auto-generate and read from `CC_DATA_DIR/.admin-token`.

## Web portal (`packages/web/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_CORE_PORT` | `4747` | Port used to build the API base URL |

> The web portal uses `VITE_CORE_PORT` at build time to generate the API base URL. If you change `CC_PORT`, update this too and rebuild.

## Example production configuration

```env
# packages/core/.env.local
CC_PORT=4747
CC_HOST=127.0.0.1
CC_DATA_DIR=/var/lib/coastal-claw/data
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.1:8b
CC_VRAM_BUDGET_GB=80
CC_ROUTER_CONFIDENCE=0.75
CC_CORS_ORIGINS=http://127.0.0.1:5173
```
