# Phase 3 Handoff — ClawOS Native Layer

**Date:** 2026-04-05
**Branch:** `feat/phase3-clawos`
**Status:** Plan written, ready to implement on Ubuntu

---

## What Was Done Before This Handoff

- Phase 2 CoastalOS — **COMPLETE** (tagged `v0.3.0-phase2-coastalos`, merged to `master`)
- Phase 3 design doc written: `docs/superpowers/specs/2026-04-03-phase3-clawos-design.md`
- Phase 3 implementation plan written: `docs/superpowers/plans/2026-04-03-phase3-clawos.md`
- Branch `feat/phase3-clawos` created off `master`, design doc + plan committed

## What Phase 3 Builds

| Feature | What it is |
|---------|-----------|
| `NamespaceBackend` | Linux `unshare` + overlayfs + cgroups v2 sandbox (replaces Docker on ClawOS) |
| `VllmClient` | Thin OpenAI-compatible client for vLLM GPU inference (3–24× faster than Ollama) |
| `createBackend()` async | Auto-detects NamespaceBackend on Linux, falls back to DockerBackend |
| `ModelRouter` vLLM probe | Lazy-detects vLLM at `localhost:8000`, falls back to Ollama |
| ISO build hardening | Pinned package versions, `coastal-vllm.service`, `CAP_SYS_ADMIN` grant |
| GitHub Actions CI | Ubuntu runner, live-build ISO, QEMU smoke test, artifact upload |
| `flash.sh` | USB flashing helper with safety confirmation |

---

## Ubuntu Dev Environment Setup

### 1. Clone / pull the repo

```bash
git clone https://github.com/CoastalCrypto/CoastalClaw_IO.git
cd CoastalClaw_IO
git checkout feat/phase3-clawos
```

Or if already cloned:
```bash
git fetch origin
git checkout feat/phase3-clawos
```

### 2. Install Node 22 + pnpm

```bash
# Node 22 via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
node --version  # should be v22.x

# pnpm
npm install -g pnpm
pnpm --version  # should be 9.x
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Verify all 220 Phase 2 tests still pass

```bash
pnpm test
```

Expected: 220 tests passing across `core`, `daemon`, `architect`, `shell`.

### 5. Linux-specific tools for Phase 3

```bash
# unshare (usually pre-installed on Ubuntu)
which unshare || sudo apt-get install -y util-linux

# Check overlayfs is available
grep -q overlay /proc/filesystems && echo "overlayfs OK" || echo "overlayfs MISSING"

# cgroups v2 (Ubuntu 22.04+ uses v2 by default)
mount | grep cgroup2 | head -1

# Python + vLLM dependencies (optional — only needed if you have a GPU)
which python3
python3 --version  # needs 3.10+
# If GPU available:
# pip3 install vllm --break-system-packages

# nvidia-smi (if GPU present)
nvidia-smi 2>/dev/null && echo "GPU detected" || echo "No GPU — vLLM optional"
```

---

## Running Phase 3 Tests

### All tests (including real NamespaceBackend on Linux)

Phase 3 adds `MOCK_NAMESPACE=1` support so tests run anywhere. On Linux CI, the real tests run without the mock:

```bash
# Run with mock (works on any platform)
MOCK_NAMESPACE=1 pnpm test

# Run real NamespaceBackend tests (Linux only — requires unshare + overlayfs)
pnpm test --reporter=verbose 2>&1 | grep -E "namespace|PASS|FAIL"
```

### Run just the new Phase 3 tests

```bash
# NamespaceBackend
pnpm --filter @coastal-claw/core test -- --reporter=verbose namespace

# VllmClient
pnpm --filter @coastal-claw/core test -- --reporter=verbose vllm
```

---

## Implementation Guide

Read the full plan at `docs/superpowers/plans/2026-04-03-phase3-clawos.md`.

The plan has 8 tasks across 3 chunks:

### Chunk 1 — NamespaceBackend (Tasks 1–3)

**Task 1 — Write failing tests** for `NamespaceBackend`:
- File: `packages/core/src/tools/backends/__tests__/namespace.test.ts`
- Tests: `isAvailable()` false on non-Linux, `execute()` runs a command via mock, timeout kills unshare tree, cgroup cleanup

**Task 2 — Implement** `packages/core/src/tools/backends/namespace.ts`:
- `MOCK_NAMESPACE=1` env var → skip real Linux checks, shell out directly
- Real path: `unshare --mount --pid --net --ipc --uts --fork --map-root-user`
- overlayfs mount per session in `/tmp/coastal-ns-$SESSION_ID/`
- cgroups v2 at `/sys/fs/cgroup/coastal/`

**Task 3 — Update** `packages/core/src/tools/backends/index.ts`:
- Make `createBackend()` `async`
- Probe `NamespaceBackend.isAvailable()` for `sandboxed` tier on Linux
- Update the one caller: `packages/core/src/api/routes/chat.ts` → add `await`
- Add `MOCK_NAMESPACE` to `packages/core/vitest.config.ts` env block

### Chunk 2 — VllmClient (Tasks 4–5)

**Task 4 — Implement** `packages/core/src/models/vllm.ts`:
- `VllmClient` class with `isAvailable()` (GET `/health`), `chat()`, `chatStream()`
- Mock-friendly: inject `fetch` for testing

**Task 5 — Update** `packages/core/src/models/router.ts`:
- Add `vllmUrl` to `packages/core/src/config.ts`
- Lazy probe: `inferenceClient()` returns VllmClient or OllamaClient
- Log at startup which backend is active

### Chunk 3 — ISO + CI + Flash (Tasks 6–8)

**Task 6 — ISO hardening**:
- `coastalos/build/packages.list` — pin nodejs=22.*, python3-pip=24.*, labwc=0.7.*, alacritty=0.13.*, chromium-browser=124.*
- `coastalos/build/hooks/post-install.sh` — add vLLM pip install + GPU detection
- `coastalos/systemd/coastal-vllm.service` — new service for vLLM (GPU only)
- `coastalos/systemd/coastal-server.service` — add `AmbientCapabilities=CAP_SYS_ADMIN CAP_NET_ADMIN`

**Task 7 — GitHub Actions**:
- `.github/workflows/iso-build.yml` — ubuntu-24.04 runner, live-build, QEMU smoke test
- `coastalos/build/test/smoke-test.sh` — boot ISO in QEMU, wait for `coastal-server.service active`, curl `/health`

**Task 8 — flash.sh + tag**:
- `flash.sh` at repo root — `dd` with safety confirmation
- Tag `v0.4.0-phase3-clawos`

---

## Key Design Decisions

### Why NamespaceBackend instead of Docker on ClawOS?

Docker requires the Docker daemon (extra process, ~100MB RAM, startup latency). Linux namespaces are a kernel primitive — `unshare` is 8KB, instant. On ClawOS where we control the kernel, this is strictly better.

### Why vLLM is optional

vLLM requires CUDA or ROCm. On CPU-only hardware, Ollama continues to work. The `VllmClient.isAvailable()` probe + ModelRouter fallback means zero code changes needed — it just works on both.

### MOCK_NAMESPACE=1

Same pattern as voice mockMode. The env var makes NamespaceBackend act like NativeBackend (shells out directly) so the full test suite can run on Windows/Mac/CI without Linux kernel features. Real integration tests are tagged `@linux` and run only on the GitHub Actions Ubuntu runner.

### createBackend() async breaking change

Only one caller: `packages/core/src/api/routes/chat.ts:31`. Clean single-site fix with `await`.

---

## File Map — What Phase 3 Creates / Modifies

```
NEW FILES:
  packages/core/src/tools/backends/namespace.ts       ← NamespaceBackend
  packages/core/src/tools/backends/__tests__/namespace.test.ts
  packages/core/src/models/vllm.ts                   ← VllmClient
  packages/core/src/models/__tests__/vllm.test.ts
  coastalos/systemd/coastal-vllm.service             ← vLLM systemd unit
  coastalos/build/test/smoke-test.sh                 ← QEMU smoke test
  .github/workflows/iso-build.yml                    ← CI pipeline
  flash.sh                                           ← USB flash helper

MODIFIED FILES:
  packages/core/src/tools/backends/index.ts          ← async createBackend()
  packages/core/src/api/routes/chat.ts               ← await createBackend()
  packages/core/src/models/router.ts                 ← vLLM probe
  packages/core/src/config.ts                        ← vllmUrl field
  packages/core/vitest.config.ts                     ← MOCK_NAMESPACE env
  coastalos/build/packages.list                      ← pinned versions
  coastalos/build/hooks/post-install.sh              ← vLLM + GPU install
  coastalos/systemd/coastal-server.service           ← CAP_SYS_ADMIN
```

---

## Executing the Plan

The plan is at `docs/superpowers/plans/2026-04-03-phase3-clawos.md`.

To execute task by task in Claude Code on Ubuntu:

```
/superpowers:subagent-driven-development
```

Or manually follow the checkboxes in the plan file — each task has exact file paths, code snippets, and test commands.

---

## After Phase 3

Tag: `v0.4.0-phase3-clawos`
Next: **Phase 4 ClawTeam** — HKUDS multi-agent swarm, boss fan-out, session tools

Phase roadmap:
- Phase 1 APEX ✅ `v0.2.0-phase1-apex`
- Phase 2 CoastalOS ✅ `v0.3.0-phase2-coastalos`
- **Phase 3 ClawOS Native** ← you are here
- Phase 4 ClawTeam — multi-agent swarm
- Phase 5 Launch — APT repo, cloud AMI, open source

---

## Quick Commands Reference

```bash
# Run full test suite
pnpm test

# Run with MOCK_NAMESPACE (works on any platform)
MOCK_NAMESPACE=1 pnpm test

# Build ISO locally (Ubuntu only, requires live-build)
sudo apt-get install -y live-build
sudo bash coastalos/build/build.sh dev

# Flash USB (Linux only, requires block device)
sudo ./flash.sh coastalos-dev.iso /dev/sdX

# Start the server
pnpm --filter @coastal-claw/core dev

# Start the daemon (autonomous mode for voice)
CC_TRUST_LEVEL=autonomous pnpm --filter @coastal-claw/daemon dev
```
