---
title: Troubleshooting
description: Common issues and how to resolve them.
---

# Troubleshooting

## Core service won't start

**Check the log:**

```bash
cat /tmp/coastal-ai-core.log
```

**Common causes:**

| Error | Fix |
|-------|-----|
| `CC_OLLAMA_URL is not a valid URL` | Fix `CC_OLLAMA_URL` in `packages/core/.env.local` |
| `EADDRINUSE: address already in use :::4747` | Another process is using port 4747. Kill it: `lsof -ti :4747 | xargs kill` |
| `Cannot find module './dist/index.js'` | Run `pnpm build` from the repo root |

## Ollama not responding

```bash
# Check if Ollama is running
curl http://127.0.0.1:11434/api/tags

# Start it if not
ollama serve &
```

## No models available / 422 from /api/chat

You need to:
1. Install at least one model (Admin → Models)
2. Assign it to at least one domain (Admin → Domains)

## Web portal can't reach the API

Check that the core service is running:

```bash
curl http://127.0.0.1:4747/health
```

If the response is `{ "ok": true }`, the service is up. If the web portal still can't connect, check `VITE_CORE_PORT` in `packages/web/.env.local` — it must match `CC_PORT`.

## Admin login fails ("Invalid admin token")

Verify your token:

```bash
cat ~/coastal-ai/packages/core/data/.admin-token
```

Copy it exactly — no trailing newline or spaces.

## Model installation stalls

Check Ollama and the quantization pipeline:

```bash
# Is Ollama running?
ollama list

# Core log for pipeline errors
tail -f /tmp/coastal-ai-core.log
```

Hugging Face gated models require a token:

```env
# Add to packages/core/.env.local
HF_TOKEN=hf_your_token_here
```

## Port already in use

```bash
# Find and kill what's on port 4747
lsof -ti :4747 | xargs kill -9

# Find and kill what's on port 5173
lsof -ti :5173 | xargs kill -9
```

## Tests failing

```bash
cd ~/coastal-ai
pnpm test
```

If admin tests fail with `401`, ensure `CC_ADMIN_TOKEN` is set in the test environment (the test suite sets it automatically via `process.env`).

## Full reset

To start completely fresh:

```bash
# Stop services
kill $(cat /tmp/coastal-ai-core.pid /tmp/coastal-ai-web.pid) 2>/dev/null

# Remove runtime data (models, sessions, token)
rm -rf ~/coastal-ai/packages/core/data

# Rebuild
cd ~/coastal-ai
pnpm install --frozen-lockfile
pnpm build

# Restart
node packages/core/dist/index.js &
```
