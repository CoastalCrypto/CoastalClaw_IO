---
title: Prerequisites
description: What you need before installing Coastal Claw.
---

# Prerequisites

## Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 16 GB | 32 GB+ |
| VRAM | 8 GB (CPU-only fallback available) | 24 GB+ |
| Storage | 20 GB free | 100 GB+ (models are large) |
| OS | Ubuntu 22.04 / macOS 13+ | Ubuntu 24.04 / macOS 14+ |

> **No GPU?** Coastal Claw runs on CPU-only hardware via llama.cpp. Expect 5-10× slower inference.

## Software

| Dependency | Required version | Auto-installed? |
|------------|-----------------|-----------------|
| Git | Any | No — install manually |
| Node.js | 22+ | Yes (via nvm) |
| pnpm | Latest | Yes |
| Ollama | Latest | Yes (macOS/Linux) |

### Install Git

**Ubuntu / Debian:**
```bash
sudo apt update && sudo apt install git
```

**macOS (via Homebrew):**
```bash
brew install git
```

**Windows:**
Download from [git-scm.com](https://git-scm.com/download/win)

### Install Ollama (manual)

The installer handles this on macOS/Linux. For Windows or custom setups:

- macOS: `brew install ollama`
- Linux: `curl -fsSL https://ollama.com/install.sh | sh`
- Windows: [ollama.com/download](https://ollama.com/download)

Verify:
```bash
ollama --version
```

## Network

- Port **4747** — Core API (localhost only by default)
- Port **5173** — Web portal (localhost only by default)
- Outbound access to `https://ollama.com` for model downloads
- Outbound access to GitHub for initial clone

Both ports are bound to `127.0.0.1` and never exposed externally without explicit configuration.
