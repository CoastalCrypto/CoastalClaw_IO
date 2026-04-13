# Coastal.AI Rebrand Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename every user-visible and package-level reference from Coastal.AI/coastal-claw to Coastal.AI/coastal-ai across all active source, config, and doc files, then rename the GitHub repo.

**Architecture:** Pure find-and-replace across ~40 files, grouped by layer (package manifests → source → HTML → docs → install scripts). No logic changes. The local directory stays `coastal-claw/` to avoid git history issues. The SQLite DB file is renamed from `coastal-claw.db` → `coastal-ai.db` in code; existing data files are unaffected (fresh install scenario).

**Tech Stack:** pnpm, TypeScript, gh CLI

---

## File Map

### Modified — package manifests
- `package.json` — root workspace name
- `packages/core/package.json` — package scope
- `packages/daemon/package.json` — package scope + dependency ref
- `packages/shell/package.json` — package scope
- `packages/architect/package.json` — package scope
- `packages/video/package.json` — package scope

### Modified — TypeScript source (core)
- `packages/core/src/config.ts` — log prefix
- `packages/core/src/main.ts` — log prefix
- `packages/core/src/server.ts` — DB filename
- `packages/core/src/api/routes/admin.ts` — log prefix
- `packages/core/src/api/routes/channels.ts` — test message text
- `packages/core/src/api/routes/chat.ts` — DB filename
- `packages/core/src/api/routes/stream.ts` — DB filename
- `packages/core/src/api/routes/system-restart.ts` — temp file + service name
- `packages/core/src/api/routes/system.ts` — service name
- `packages/core/src/channels/discord.ts` — default bot username
- `packages/core/src/channels/zapier.ts` — source field
- `packages/core/src/tools/core/sqlite.ts` — DB filename + tool description
- `packages/core/src/tools/mcp/adapter.ts` — client name

### Modified — TypeScript source (web/daemon/shell)
- `packages/daemon/src/voice/interrupt-handler.ts` — import path
- `packages/daemon/src/voice/vibevoice-client.ts` — comment
- `packages/shell/src/main.ts` — tray tooltip
- `packages/web/src/components/NavBar.tsx` — display name
- `packages/web/src/components/ErrorBoundary.tsx` — log prefix
- `packages/web/src/components/AgentThinkingAnimation.tsx` — comment
- `packages/web/src/components/animations/LottiePlayer.tsx` — comment
- `packages/web/src/components/animations/OceanScene.tsx` — comment
- `packages/web/src/pages/Channels.tsx` — placeholder text
- `packages/web/src/pages/Onboarding.tsx` — welcome title
- `packages/web/src/pages/System.tsx` — service names + button label

### Modified — HTML
- `packages/web/index.html` — `<title>`

### Modified — install scripts
- `install.sh` — display name, repo URL, dir names, log paths, CLI binary name
- `install.ps1` — display name, repo URL, dir names, log paths

### Modified — docs/site
- `docs/site/mint.json`
- `docs/site/introduction.md`
- `docs/site/getting-started.md`
- `docs/site/security.md`
- `docs/site/troubleshooting.md`
- `docs/site/contributing.md`
- `docs/site/admin/overview.md`
- `docs/site/api/websocket.md`
- `docs/site/architecture/memory.md`
- `docs/site/architecture/overview.md`
- `docs/site/architecture/routing.md`
- `docs/site/configuration/environment.md`
- `docs/site/configuration/model-registry.md`
- `docs/site/installation/manual.md`
- `docs/site/installation/prerequisites.md`

### Modified — root docs
- `README.md`

---

## Chunk 1: Package Manifests

### Task 1: Update root and all package package.json files

**Files:**
- Modify: `package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/daemon/package.json`
- Modify: `packages/shell/package.json`
- Modify: `packages/architect/package.json`
- Modify: `packages/video/package.json`

- [ ] **Step 1: Update root `package.json`**

Change `"name": "coastal-claw"` → `"name": "coastal-ai"`.

- [ ] **Step 2: Update `packages/core/package.json`**

Change `"name": "@coastal-claw/core"` → `"name": "@coastal-ai/core"`.

- [ ] **Step 3: Update `packages/daemon/package.json`**

Change `"name": "@coastal-claw/daemon"` → `"name": "@coastal-ai/daemon"`.
Change any `"@coastal-claw/core"` dependency reference → `"@coastal-ai/core"`.

- [ ] **Step 4: Update `packages/shell/package.json`**

Change `"name": "@coastal-claw/shell"` → `"name": "@coastal-ai/shell"`.
Change any `"@coastal-claw/core"` → `"@coastal-ai/core"`.

- [ ] **Step 5: Update `packages/architect/package.json`**

Change `"name": "@coastal-claw/architect"` → `"name": "@coastal-ai/architect"`.
Change any `"@coastal-claw/core"` → `"@coastal-ai/core"`.

- [ ] **Step 6: Update `packages/video/package.json`**

Change `"name": "@coastal-claw/video"` → `"name": "@coastal-ai/video"`.
Change any `"@coastal-claw/core"` → `"@coastal-ai/core"`.

- [ ] **Step 7: Verify — no remaining coastal-claw in package files**

Run:
```bash
grep -r "coastal-claw" package.json packages/*/package.json
```
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add package.json packages/core/package.json packages/daemon/package.json packages/shell/package.json packages/architect/package.json packages/video/package.json
git commit -m "chore(rebrand): rename packages coastal-claw → coastal-ai"
```

---

## Chunk 2: Core TypeScript Source

### Task 2: Update string literals in packages/core

**Files:**
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/src/main.ts`
- Modify: `packages/core/src/server.ts`
- Modify: `packages/core/src/api/routes/admin.ts`
- Modify: `packages/core/src/api/routes/channels.ts`
- Modify: `packages/core/src/api/routes/chat.ts`
- Modify: `packages/core/src/api/routes/stream.ts`
- Modify: `packages/core/src/api/routes/system-restart.ts`
- Modify: `packages/core/src/api/routes/system.ts`
- Modify: `packages/core/src/channels/discord.ts`
- Modify: `packages/core/src/channels/zapier.ts`
- Modify: `packages/core/src/tools/core/sqlite.ts`
- Modify: `packages/core/src/tools/mcp/adapter.ts`

- [ ] **Step 1: `config.ts` — update log prefix**

Find: `[coastal-claw]`
Replace with: `[coastal-ai]`

- [ ] **Step 2: `main.ts` — update log prefix**

Find: `[coastal-claw]`
Replace with: `[coastal-ai]`

- [ ] **Step 3: `server.ts` — update DB filename**

Find: `'coastal-claw.db'`
Replace with: `'coastal-ai.db'`

- [ ] **Step 4: `api/routes/admin.ts` — update log prefix**

Find all: `[coastal-claw]`
Replace all with: `[coastal-ai]`

- [ ] **Step 5: `api/routes/channels.ts` — update test message**

Find: `'👋 Test message from Coastal.AI'`
Replace with: `'👋 Test message from Coastal.AI'`

- [ ] **Step 6: `api/routes/chat.ts` — update DB filename**

Find: `'coastal-claw.db'`
Replace with: `'coastal-ai.db'`

- [ ] **Step 7: `api/routes/stream.ts` — update DB filename**

Find: `'coastal-claw.db'`
Replace with: `'coastal-ai.db'`

- [ ] **Step 8: `api/routes/system-restart.ts` — update temp file + service name**

Find: `'Coastal.AI-restart.cmd'`
Replace with: `'coastal-ai-restart.cmd'`

Find: `'Coastal.AI-server'`
Replace with: `'coastal-ai-server'`

- [ ] **Step 9: `api/routes/system.ts` — update service name default**

Find: `'Coastal.AI-server'`
Replace with: `'coastal-ai-server'`

- [ ] **Step 10: `channels/discord.ts` — update default bot username**

Find: `'Coastal.AI'`
Replace with: `'Coastal.AI'`

- [ ] **Step 11: `channels/zapier.ts` — update source field**

Find: `'Coastal.AI'`
Replace with: `'coastal-ai'`

- [ ] **Step 12: `tools/core/sqlite.ts` — update DB filename + description**

Find: `'coastal-claw.db'`
Replace with: `'coastal-ai.db'`

Find: `'Coastal.AI database'`
Replace with: `'Coastal.AI database'`

- [ ] **Step 13: `tools/mcp/adapter.ts` — update client name**

Find: `{ name: 'coastal-claw', version: '1.0.0' }`
Replace with: `{ name: 'coastal-ai', version: '1.0.0' }`

- [ ] **Step 14: Verify — no remaining coastal-claw/Coastal.AI in core src**

Run:
```bash
grep -rn "Coastal.AI\|coastal-claw\|Coastal.AI" packages/core/src/
```
Expected: no output.

- [ ] **Step 15: Commit**

```bash
git add packages/core/src/
git commit -m "chore(rebrand): update core string literals coastal-claw → coastal-ai/Coastal.AI"
```

---

## Chunk 3: Web / Daemon / Shell TypeScript Source

### Task 3: Update string literals outside packages/core

**Files:**
- Modify: `packages/daemon/src/voice/interrupt-handler.ts`
- Modify: `packages/daemon/src/voice/vibevoice-client.ts`
- Modify: `packages/shell/src/main.ts`
- Modify: `packages/web/src/components/NavBar.tsx`
- Modify: `packages/web/src/components/ErrorBoundary.tsx`
- Modify: `packages/web/src/components/AgentThinkingAnimation.tsx`
- Modify: `packages/web/src/components/animations/LottiePlayer.tsx`
- Modify: `packages/web/src/components/animations/OceanScene.tsx`
- Modify: `packages/web/src/pages/Channels.tsx`
- Modify: `packages/web/src/pages/Onboarding.tsx`
- Modify: `packages/web/src/pages/System.tsx`

- [ ] **Step 1: `daemon/interrupt-handler.ts` — update import**

Find: `from '@coastal-claw/core'`
Replace with: `from '@coastal-ai/core'`

- [ ] **Step 2: `daemon/vibevoice-client.ts` — update comment**

Find: `@coastal-claw/core`
Replace with: `@coastal-ai/core`

- [ ] **Step 3: `shell/main.ts` — update tray tooltip**

Find: `'Coastal.AI OS'`
Replace with: `'Coastal.AI'`

- [ ] **Step 4: `web/NavBar.tsx` — update display name**

Find: `Coastal.AI` (the visible text node, line ~96)
Replace with: `Coastal.AI`

- [ ] **Step 5: `web/ErrorBoundary.tsx` — update log prefix**

Find: `'[Coastal.AI]'`
Replace with: `'[Coastal.AI]'`

- [ ] **Step 6: `web/AgentThinkingAnimation.tsx` — update comment**

Find: `Coastal.AI`
Replace with: `Coastal.AI`

- [ ] **Step 7: `web/animations/LottiePlayer.tsx` — update comment**

Find: `Coastal.AI`
Replace with: `Coastal.AI`

- [ ] **Step 8: `web/animations/OceanScene.tsx` — update comment**

Find: `Coastal.AI`
Replace with: `Coastal.AI`

- [ ] **Step 9: `web/pages/Channels.tsx` — update placeholder**

Find all: `placeholder: 'Coastal.AI'`
Replace all with: `placeholder: 'Coastal.AI'`

- [ ] **Step 10: `web/pages/Onboarding.tsx` — update welcome title**

Find: `'Welcome to Coastal.AI'`
Replace with: `'Welcome to Coastal.AI'`

- [ ] **Step 11: `web/pages/System.tsx` — update service names + button**

Find: `['Coastal.AI-server', 'Coastal.AI-daemon', 'Coastal.AI-architect', 'ollama']`
Replace with: `['coastal-ai-server', 'coastal-ai-daemon', 'coastal-ai-architect', 'ollama']`

Find: `'Update Coastal.AI'`
Replace with: `'Update Coastal.AI'`

Find: `s.replace('Coastal.AI-', '')`
Replace with: `s.replace('coastal-ai-', '')`

- [ ] **Step 12: Verify — no remaining Coastal.AI in web/daemon/shell**

Run:
```bash
grep -rn "Coastal.AI\|coastal-claw\|Coastal.AI" packages/web/src packages/daemon/src packages/shell/src
```
Expected: no output.

- [ ] **Step 13: Commit**

```bash
git add packages/web/src packages/daemon/src packages/shell/src
git commit -m "chore(rebrand): update web/daemon/shell string literals → Coastal.AI"
```

---

## Chunk 4: HTML + Install Scripts

### Task 4: Update HTML title and install scripts

**Files:**
- Modify: `packages/web/index.html`
- Modify: `install.sh`
- Modify: `install.ps1`

- [ ] **Step 1: `packages/web/index.html` — update title**

Find: `<title>Coastal.AI</title>`
Replace with: `<title>Coastal.AI</title>`

- [ ] **Step 2: `install.sh` — update all references**

Replacements (apply all):
| Find | Replace |
|------|---------|
| `Coastal.AI_IO` | `Coastal.AI` |
| `[coastal-claw]` | `[coastal-ai]` |
| `DEFAULT_INSTALL_DIR="${HOME}/coastal-claw"` | `DEFAULT_INSTALL_DIR="${HOME}/coastal-ai"` |
| `coastal-claw-core.log` | `coastal-ai-core.log` |
| `coastal-claw-core.pid` | `coastal-ai-core.pid` |
| `coastal-claw-web.log` | `coastal-ai-web.log` |
| `coastal-claw-web.pid` | `coastal-ai-web.pid` |
| `${CC_BIN_DIR}/coastal-claw"` | `${CC_BIN_DIR}/coastal-ai"` |
| `chmod +x "${CC_BIN_DIR}/coastal-claw"` | `chmod +x "${CC_BIN_DIR}/coastal-ai"` |
| CLI shortcut message: `coastal-claw` | `coastal-ai` |

- [ ] **Step 3: `install.ps1` — update all references**

Replacements (apply all):
| Find | Replace |
|------|---------|
| `Coastal.AI_IO` | `Coastal.AI` |
| `Coastal.AI-install.ps1` | `coastal-ai-install.ps1` |
| `$env:USERPROFILE\coastal-claw` | `$env:USERPROFILE\coastal-ai` |
| `coastal-claw-core.log` | `coastal-ai-core.log` |
| `coastal-claw-core.pid` | `coastal-ai-core.pid` |
| `coastal-claw-core-err.log` | `coastal-ai-core-err.log` |
| `coastal-claw-web.log` | `coastal-ai-web.log` |
| `coastal-claw-web.pid` | `coastal-ai-web.pid` |
| `coastal-claw-web-err.log` | `coastal-ai-web-err.log` |

- [ ] **Step 4: Verify**

Run:
```bash
grep -n "Coastal.AI\|coastal-claw\|Coastal.AI" packages/web/index.html install.sh install.ps1
```
Expected: only the `CoastalCrypto/Coastal.AI` repo URL references (which are correct).

- [ ] **Step 5: Commit**

```bash
git add packages/web/index.html install.sh install.ps1
git commit -m "chore(rebrand): update HTML title and install scripts → Coastal.AI"
```

---

## Chunk 5: Docs + README

### Task 5: Update docs/site and README

**Files:**
- Modify: `docs/site/mint.json` and all `.md` files under `docs/site/`
- Modify: `README.md`

- [ ] **Step 1: Bulk replace in docs/site**

Run:
```bash
cd /path/to/coastal-claw
find docs/site -name "*.md" -o -name "*.json" | xargs sed -i 's/Coastal.AI/Coastal.AI/g; s/coastal-claw/coastal-ai/g; s/Coastal.AI/coastal-ai/g; s/Coastal.AI_IO/Coastal.AI/g'
```

On Windows (git bash or PowerShell):
```bash
# git bash:
find docs/site -type f \( -name "*.md" -o -name "*.json" \) -exec sed -i 's/Coastal.AI/Coastal.AI/g; s/coastal-claw/coastal-ai/g; s/Coastal.AI/coastal-ai/g' {} +
```

- [ ] **Step 2: Verify docs/site**

Run:
```bash
grep -rn "Coastal.AI\|coastal-claw\|Coastal.AI" docs/site/
```
Expected: no output.

- [ ] **Step 3: Update README.md**

Do a global replace:
- `Coastal.AI_IO` → `Coastal.AI`
- `Coastal.AI` → `Coastal.AI`
- `coastal-claw` → `coastal-ai`
- `Coastal.AI` → `coastal-ai`

Also update the install script URLs to point to the new repo:
```
https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install.sh
https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install.ps1
```

- [ ] **Step 4: Verify README**

Run:
```bash
grep -n "Coastal.AI\|coastal-claw\|Coastal.AI" README.md
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add docs/site/ README.md
git commit -m "chore(rebrand): update docs/site and README → Coastal.AI"
```

---

## Chunk 6: Lockfile + TypeScript Check + GitHub Rename

### Task 6: Regenerate lockfile, verify types, push, rename repo

- [ ] **Step 1: Regenerate pnpm lockfile**

Run:
```bash
pnpm install
```
Expected: lockfile updated, no errors.

- [ ] **Step 2: TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore(rebrand): regenerate lockfile after package rename"
```

- [ ] **Step 4: Push all commits**

```bash
git push
```

- [ ] **Step 5: Rename GitHub repo**

```bash
gh repo rename Coastal.AI --yes
```
Expected: `✓ Renamed repository to CoastalCrypto/Coastal.AI`

- [ ] **Step 6: Update git remote URL**

```bash
git remote set-url origin https://github.com/CoastalCrypto/Coastal.AI.git
git remote -v
```
Expected: both fetch and push show the new URL.

- [ ] **Step 7: Push to confirm new remote**

```bash
git push
```
Expected: pushes to `CoastalCrypto/Coastal.AI` successfully.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
