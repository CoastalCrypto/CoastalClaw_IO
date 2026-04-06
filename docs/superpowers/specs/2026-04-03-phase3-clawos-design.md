# CoastalClaw Phase 3 — ClawOS Native Layer Design Spec

**Date:** 2026-04-03
**Status:** Approved for implementation planning
**Scope:** NamespaceBackend · VllmBackend · ISO CI pipeline · Bootable USB

---

## Goal

Phase 3 makes ClawOS a first-class runtime target. The sandboxed execution tier switches from Docker to Linux namespaces (faster, no daemon dependency), model inference switches from Ollama to vLLM on GPU-equipped systems (3–24× throughput), the ISO build becomes CI-validated and reproducible, and delivery becomes one command (`./flash.sh`).

Everything degrades gracefully: NamespaceBackend falls back to DockerBackend on non-Linux; VllmBackend falls back to Ollama when no GPU or vLLM not running.

---

## Architecture

### Four deliverables

```
packages/core/src/tools/backends/
  namespace.ts          ← NEW: Linux unshare + cgroups v2 sandbox

packages/core/src/models/
  vllm.ts               ← NEW: OpenAI-compatible vLLM client

packages/core/src/tools/backends/
  index.ts              ← MODIFY: auto-detect NamespaceBackend on Linux

packages/core/src/models/
  router.ts             ← MODIFY: auto-detect vLLM, fall back to Ollama

coastalos/
  build/build.sh        ← MODIFY: hardened, pinned packages, vLLM install
  build/packages.list   ← MODIFY: pinned versions
  build/hooks/post-install.sh  ← MODIFY: install vLLM, grant CAP_SYS_ADMIN
  systemd/coastal-server.service ← MODIFY: AmbientCapabilities=CAP_SYS_ADMIN

.github/workflows/
  iso-build.yml         ← NEW: Ubuntu runner, live-build, QEMU smoke test

flash.sh                ← NEW: USB flashing helper (root of repo)
```

---

## 1. NamespaceBackend

### What it does

Replaces `DockerBackend` at the `sandboxed` trust tier on Linux. Each agent session gets:

- **Mount namespace** — overlayfs workspace isolated per session
- **PID namespace** — agent processes cannot see host PIDs
- **Network namespace** — `--net` isolation, no outbound internet
- **IPC + UTS namespaces** — further isolation
- **cgroups v2** — 256 MB memory cap, 0.5 CPU cap (matches DockerBackend)

### Interface

Implements `ShellBackend` exactly — drop-in replacement for `DockerBackend`.

```typescript
export class NamespaceBackend implements ShellBackend {
  readonly name = 'namespace'
  async isAvailable(): Promise<boolean>   // Linux + unshare + overlayfs check
  async execute(cmd, workdir, sessionId, timeoutMs): Promise<ShellResult>
}
```

### Availability check

```typescript
async isAvailable(): Promise<boolean> {
  if (process.platform !== 'linux') return false
  // Check unshare binary exists
  try { execSync('which unshare', { stdio: 'ignore' }) } catch { return false }
  // Check overlayfs kernel module
  try { execSync('grep -q overlay /proc/filesystems', { stdio: 'ignore' }) } catch { return false }
  return true
}
```

### Execution

```bash
unshare --mount --pid --net --ipc --uts --fork --map-root-user \
  sh -c "
    mount -t overlay overlay \
      -o lowerdir=/opt/coastalclaw/base,upperdir=$SESSION_DIR/upper,workdir=$SESSION_DIR/work \
      $SESSION_DIR/merged
    mount -t proc proc $SESSION_DIR/merged/proc
    cgexec -g memory,cpu:coastal-$SESSION_ID \
      chroot $SESSION_DIR/merged /bin/sh -c '$CMD'
  "
```

### cgroups v2 setup

Service unit creates cgroup slice on startup. Each session spawns into its own cgroup:

```
/sys/fs/cgroup/coastal/
  memory.max   = 268435456   (256 MB)
  cpu.max      = 50000 100000 (0.5 CPU)
```

### Mock path

`MOCK_NAMESPACE=1` → `isAvailable()` returns `true`, `execute()` shells out directly (same as NativeBackend). Lets the test suite run on Windows/Mac without Linux kernel features.

### Tests

- `isAvailable()` returns false on non-Linux (mocked `process.platform`)
- `execute()` runs a command and returns stdout (Linux CI only, tagged `@linux`)
- Timeout kills the unshare process tree correctly
- cgroup cleanup on session end

---

## 2. VllmBackend

### What it does

Thin model client that speaks vLLM's OpenAI-compatible HTTP API. Same interface as the existing Ollama client in `ModelRouter`. When vLLM is running (`localhost:8000`), use it. When not, fall back to Ollama transparently.

### Why vLLM on ClawOS

| Feature | Ollama | vLLM |
|---------|--------|------|
| Throughput | Baseline | 3–24× higher (PagedAttention) |
| Quantization | GGUF Q4/Q8 | AWQ, GPTQ, FP8, INT4, INT8 |
| Multi-GPU | No | Tensor + pipeline parallelism |
| API format | OpenAI-compatible | OpenAI-compatible |
| Install | Single binary | `pip install vllm` + CUDA |
| GPU required | No | Yes (CUDA/ROCm) |

### Interface

```typescript
// packages/core/src/models/vllm.ts
export class VllmClient {
  private baseUrl: string  // default: http://localhost:8000

  async isAvailable(): Promise<boolean>   // GET /health → 200
  async chat(messages, model, opts): Promise<string>
  async chatStream(messages, model, opts): AsyncGenerator<string>
}
```

### Auto-detection in ModelRouter

```typescript
// Probe order: vLLM → Ollama → throw
const vllm = new VllmClient()
const useVllm = await vllm.isAvailable()
// Log which backend is active at startup
console.log(`[model-router] inference: ${useVllm ? 'vLLM (GPU)' : 'Ollama (CPU)'}`)
```

### Installation on ClawOS

`post-install.sh` adds:
```bash
pip3 install vllm --break-system-packages || true   # optional, skip on no-GPU
```

vLLM service unit auto-starts only if GPU detected:
```bash
# In post-install.sh
if nvidia-smi &>/dev/null || rocm-smi &>/dev/null; then
  systemctl enable coastal-vllm.service
fi
```

### Tests

- `isAvailable()` returns false when endpoint unreachable (no mock server)
- `chat()` sends correct OpenAI message format
- ModelRouter falls back to Ollama when vLLM unavailable

---

## 3. `createBackend()` auto-detection update

```typescript
export async function createBackend(
  trustLevel: TrustLevel,
  allowedPaths: string[],
): Promise<ShellBackend> {
  if (trustLevel === 'sandboxed') {
    const ns = new NamespaceBackend()
    if (await ns.isAvailable()) return ns
    return new DockerBackend()  // fallback
  }
  if (trustLevel === 'trusted') return new RestrictedLocalBackend(allowedPaths)
  return new NativeBackend()
}
```

Note: `createBackend` becomes `async` (breaking change — callers in `chat.ts` must `await`).

---

## 4. ISO build hardening

### Pinned packages

`coastalos/build/packages.list` pins critical package versions to ensure reproducible builds:

```
nodejs=22.*
python3-pip=24.*
labwc=0.7.*
alacritty=0.13.*
chromium-browser=124.*
```

### GitHub Actions CI

`.github/workflows/iso-build.yml`:

```yaml
on:
  push:
    branches: [master]
    paths: ['coastalos/**']
  workflow_dispatch:
    inputs:
      version:
        description: 'ISO version tag'
        default: 'dev'

jobs:
  build-iso:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - name: Install live-build
        run: sudo apt-get install -y live-build qemu-system-x86
      - name: Build ISO
        run: sudo bash coastalos/build/build.sh ${{ inputs.version || 'ci' }}
      - name: QEMU smoke test
        run: bash coastalos/build/test/smoke-test.sh coastalos-ci.iso
      - name: Upload ISO artifact
        uses: actions/upload-artifact@v4
        with:
          name: coastalos-${{ inputs.version || 'ci' }}.iso
          path: coastalos-*.iso
          retention-days: 7
```

### QEMU smoke test

`coastalos/build/test/smoke-test.sh`:
- Boot ISO in QEMU (headless, KVM if available)
- Wait up to 90s for `coastal-server.service` to reach `active` state via serial console
- Check HTTP: `curl -sf http://localhost:4747/health`
- Exit 0 = pass, exit 1 = fail

### systemd capability grant

`coastalos/systemd/coastal-server.service`:
```ini
[Service]
AmbientCapabilities=CAP_SYS_ADMIN CAP_NET_ADMIN
CapabilityBoundingSet=CAP_SYS_ADMIN CAP_NET_ADMIN
```

Required for `unshare` without root.

---

## 5. Bootable USB — `flash.sh`

```bash
#!/usr/bin/env bash
# flash.sh — write CoastalOS ISO to USB drive
# Usage: sudo ./flash.sh [iso-file] [device]

ISO="${1:-coastalos-latest.iso}"
DEVICE="${2:-}"

if [ -z "$DEVICE" ]; then
  echo "Available drives:"
  lsblk -d -o NAME,SIZE,MODEL | grep -v "loop\|sr"
  read -rp "Enter device (e.g. /dev/sdb): " DEVICE
fi

[ -b "$DEVICE" ] || { echo "Error: $DEVICE is not a block device"; exit 1; }
[ -f "$ISO" ]    || { echo "Error: $ISO not found"; exit 1; }

echo "WARNING: This will ERASE all data on $DEVICE"
echo "ISO: $ISO → $DEVICE"
read -rp "Type YES to continue: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "Aborted."; exit 0; }

dd if="$ISO" of="$DEVICE" bs=4M status=progress oflag=sync
sync
echo "Done. Remove USB and boot."
```

---

## Auto-detection Summary

| Feature | Condition | Fallback |
|---------|-----------|----------|
| NamespaceBackend | Linux + unshare + overlayfs | DockerBackend |
| VllmBackend | localhost:8000 responds | Ollama |
| coastal-vllm.service | nvidia-smi or rocm-smi present | disabled |
| ISO build CI | push to master touching coastalos/ | manual |

---

## Testing Strategy

| Test type | Where runs | How |
|-----------|-----------|-----|
| NamespaceBackend unit | Everywhere | MOCK_NAMESPACE=1 |
| NamespaceBackend integration | Linux CI (GH Actions Ubuntu runner) | Real unshare |
| VllmBackend unit | Everywhere | Mock HTTP server (vitest) |
| ISO build | GH Actions Ubuntu 24.04 | live-build |
| ISO smoke | GH Actions | QEMU headless boot |
| Flash script | Manual | Dry-run flag |

---

## Phase Roadmap

- **Phase 1 APEX** ✅ — pluggable backends, trust tiers, daemon, skill-gaps
- **Phase 2 CoastalOS** ✅ — coastal-architect, browser tools, Electron shell, voice pipeline
- **Phase 3 ClawOS Native** ← THIS — NamespaceBackend, vLLM, ISO CI, USB flash
- **Phase 4 ClawTeam** — multi-agent swarm, HKUDS boss/specialist, session tools
- **Phase 5 Launch** — APT repo, cloud AMI, architect submits PRs to open-source community
