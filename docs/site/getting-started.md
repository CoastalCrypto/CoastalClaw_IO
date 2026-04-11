---
title: Getting Started
description: From zero to running AI executive team in under 20 minutes.
---

# Getting Started

## One-line install (Linux / macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI_IO/master/install.sh | bash
```

The installer automatically:

1. Detects your platform and architecture
2. Installs Node.js 22+ via nvm (if missing)
3. Installs pnpm and Ollama (if missing)
4. Clones the repo to `~/coastal-ai`
5. Installs dependencies and builds the project
6. Creates configuration files
7. Pulls the default model (`llama3.2`)
8. Starts the core API and web portal
9. Prints your admin token

> **Windows** — Install [Ollama](https://ollama.com/download) manually, then run the installer in Git Bash.

## After install

Once the installer completes you'll see:

```
════════════════════════════════════════════════════
  Coastal.AI is running!

  Web portal:   http://127.0.0.1:5173
  Core API:     http://127.0.0.1:4747

  Admin token:  cc_tok_xxxxxxxxxxxxxxxx
════════════════════════════════════════════════════
```

### Next steps

1. Open `http://127.0.0.1:5173` in your browser
2. Navigate to **Models** and enter your admin token
3. Install a model (e.g. `llama3.1:8b`)
4. Navigate to **Domains** and assign models to COO, CFO, CTO
5. Open the **Chat** tab and start talking to your executive team

## Stopping and restarting

```bash
# Stop
kill $(cat /tmp/coastal-ai-core.pid /tmp/coastal-ai-web.pid)

# Restart
cd ~/coastal-ai
node packages/core/dist/index.js &
cd packages/web && pnpm preview --port 5173 --host 127.0.0.1 &
```

Or use the CLI shortcut installed to `~/.local/bin`:

```bash
coastal-ai
```

## Updating

```bash
cd ~/coastal-ai
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
```
