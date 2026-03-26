---
title: Manual Installation
description: Step-by-step installation without the one-line script.
---

# Manual Installation

Use this guide if the one-line installer isn't suitable for your environment (air-gapped systems, custom paths, CI/CD pipelines).

## 1. Clone the repository

```bash
git clone --depth=1 https://github.com/CoastalCrypto/CoastalClaw_IO.git ~/coastal-claw
cd ~/coastal-claw
```

## 2. Install Node.js 22+

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
nvm install 22
nvm use 22
nvm alias default 22
```

Verify: `node --version`  → `v22.x.x`

## 3. Install pnpm

```bash
npm install -g pnpm@latest
```

Verify: `pnpm --version`

## 4. Install dependencies and build

```bash
cd ~/coastal-claw
pnpm install --frozen-lockfile
pnpm build
```

## 5. Configure environment

### Core service

Create `packages/core/.env.local`:

```env
CC_PORT=4747
CC_HOST=127.0.0.1
CC_DATA_DIR=./data
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.2
CC_VRAM_BUDGET_GB=24
CC_ROUTER_CONFIDENCE=0.7
```

### Web portal

Create `packages/web/.env.local`:

```env
VITE_CORE_PORT=4747
```

## 6. Pull a model

Start Ollama if it isn't running:

```bash
ollama serve &
```

Pull the default model:

```bash
ollama pull llama3.2
```

## 7. Start the services

```bash
# Core API
cd ~/coastal-claw
nohup node packages/core/dist/index.js > /tmp/cc-core.log 2>&1 &

# Web portal
cd ~/coastal-claw/packages/web
nohup pnpm preview --port 5173 --host 127.0.0.1 > /tmp/cc-web.log 2>&1 &
```

## 8. Get your admin token

```bash
cat ~/coastal-claw/packages/core/data/.admin-token
```

Open `http://127.0.0.1:5173` and enter the token in the Models page.

## Environment variable reference

See [Configuration → Environment Variables](/configuration/environment) for the full list.
