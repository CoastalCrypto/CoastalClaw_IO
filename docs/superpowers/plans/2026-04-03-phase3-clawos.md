# Phase 3 ClawOS Native Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ClawOS a first-class runtime — Linux namespace sandboxing, vLLM GPU inference, hardened ISO build with CI, and one-command USB flashing.

**Architecture:** NamespaceBackend replaces DockerBackend at sandboxed tier on Linux (unshare + per-session workdir); VllmClient wraps vLLM's OpenAI-compatible HTTP API and is lazily probed by ModelRouter with Ollama fallback; ISO build is hardened with pinned packages and a GitHub Actions workflow that builds + QEMU smoke-tests on every master push touching `coastalos/`.

**Tech Stack:** Node 22 ESM TypeScript, pnpm workspaces, Vitest, Fastify, existing `packages/core`, live-build (Ubuntu 24.04), GitHub Actions, QEMU.

---

## File Map

```
CREATE:
  packages/core/src/tools/backends/namespace.ts
  packages/core/src/tools/backends/__tests__/namespace.test.ts
  packages/core/src/models/vllm.ts
  packages/core/src/models/__tests__/vllm.test.ts
  .github/workflows/iso-build.yml
  coastalos/build/test/smoke-test.sh
  coastalos/systemd/coastal-vllm.service
  flash.sh

MODIFY:
  packages/core/src/config.ts                          (add vllmUrl)
  packages/core/src/tools/backends/index.ts            (async createBackend + NamespaceBackend)
  packages/core/src/api/routes/chat.ts                 (await createBackend)
  packages/core/src/models/router.ts                   (vLLM lazy detection)
  coastalos/build/packages.list                         (pin versions)
  coastalos/build/hooks/post-install.sh                 (vLLM + GPU detection)
  coastalos/systemd/coastal-server.service              (CAP_SYS_ADMIN)
```

---

## Chunk 1: NamespaceBackend

### Task 1: namespace.test.ts — failing tests first

**Files:**
- Create: `packages/core/src/tools/backends/__tests__/namespace.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/tools/backends/__tests__/namespace.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NamespaceBackend } from '../namespace.js'

// All tests run with MOCK_NAMESPACE=1 so they pass on Windows/Mac
// Real unshare tests run in GitHub Actions (ubuntu-24.04 runner)

describe('NamespaceBackend', () => {
  let backend: NamespaceBackend
  const origEnv = process.env.MOCK_NAMESPACE

  beforeEach(() => {
    process.env.MOCK_NAMESPACE = '1'
    backend = new NamespaceBackend()
  })

  afterEach(() => {
    if (origEnv === undefined) delete process.env.MOCK_NAMESPACE
    else process.env.MOCK_NAMESPACE = origEnv
  })

  it('name is "namespace"', () => {
    expect(backend.name).toBe('namespace')
  })

  it('isAvailable returns true in mock mode', async () => {
    expect(await backend.isAvailable()).toBe(true)
  })

  it('isAvailable returns false on non-Linux without mock', async () => {
    delete process.env.MOCK_NAMESPACE
    if (process.platform !== 'linux') {
      expect(await backend.isAvailable()).toBe(false)
    }
  })

  it('execute returns stdout in mock mode', async () => {
    const result = await backend.execute('echo hello', process.cwd(), 'test-session')
    expect(result.stdout.trim()).toBe('hello')
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBe(false)
  })

  it('execute returns non-zero exit code on failure', async () => {
    const result = await backend.execute('exit 1', process.cwd(), 'test-session')
    expect(result.exitCode).not.toBe(0)
  })

  it('execute times out', async () => {
    const result = await backend.execute('sleep 10', process.cwd(), 'test-session', 200)
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(124)
  }, 5_000)
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/core && pnpm test src/tools/backends/__tests__/namespace.test.ts
```

Expected: `Failed to load url ../namespace.js`

---

### Task 2: namespace.ts — implementation

**Files:**
- Create: `packages/core/src/tools/backends/namespace.ts`

- [ ] **Step 1: Implement NamespaceBackend**

```typescript
// packages/core/src/tools/backends/namespace.ts
import { spawn, execSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { NativeBackend } from './native.js'
import type { ShellBackend, ShellResult } from './types.js'

const SANDBOX_BASE = process.env.CC_SANDBOX_DIR ?? '/var/lib/coastalclaw/workspace'

/**
 * Linux namespace-based sandbox. Uses unshare(1) for mount/pid/net/ipc/uts isolation.
 * Each session gets an isolated workdir under CC_SANDBOX_DIR.
 *
 * Set MOCK_NAMESPACE=1 to run on non-Linux (dev/CI on Windows/Mac).
 * Set CC_SANDBOX_DIR to override workspace root (defaults to /var/lib/coastalclaw/workspace).
 */
export class NamespaceBackend implements ShellBackend {
  readonly name = 'namespace'

  async isAvailable(): Promise<boolean> {
    if (process.env.MOCK_NAMESPACE === '1') return true
    if (process.platform !== 'linux') return false
    try {
      execSync('which unshare', { stdio: 'ignore' })
      // Check kernel supports user namespaces (required for --map-root-user)
      execSync('unshare --user true', { stdio: 'ignore', timeout: 2_000 })
      return true
    } catch {
      return false
    }
  }

  async execute(
    cmd: string,
    workdir: string,
    sessionId: string,
    timeoutMs = 30_000,
  ): Promise<ShellResult> {
    // Mock path: delegate to NativeBackend for dev/CI on non-Linux
    if (process.env.MOCK_NAMESPACE === '1') {
      return new NativeBackend().execute(cmd, workdir, sessionId, timeoutMs)
    }

    const sessionDir = join(SANDBOX_BASE, `ns-${sessionId.slice(0, 12)}-${Date.now()}`)
    mkdirSync(sessionDir, { recursive: true })

    return new Promise((resolve_) => {
      const proc = spawn('unshare', [
        '--mount', '--pid', '--net', '--ipc', '--uts',
        '--fork', '--map-root-user',
        'sh', '-c', cmd,
      ], {
        cwd: sessionDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: sessionDir },
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      const timer = setTimeout(() => {
        proc.kill('SIGKILL')
        this.cleanup(sessionDir)
        resolve_({
          stdout: `${stdout}${stderr}\n(namespace sandbox timed out after ${timeoutMs}ms)`,
          exitCode: 124,
          timedOut: true,
        })
      }, timeoutMs)

      proc.on('close', (code) => {
        clearTimeout(timer)
        this.cleanup(sessionDir)
        resolve_({
          stdout: stdout + stderr,
          exitCode: code ?? 0,
          timedOut: false,
        })
      })
    })
  }

  private cleanup(sessionDir: string): void {
    try { rmSync(sessionDir, { recursive: true, force: true }) } catch {}
  }
}
```

- [ ] **Step 2: Run tests — verify PASS**

```bash
cd packages/core && pnpm test src/tools/backends/__tests__/namespace.test.ts
```

Expected: `6 passed`

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/tools/backends/namespace.ts \
        packages/core/src/tools/backends/__tests__/namespace.test.ts
git commit -m "feat(sandbox): add NamespaceBackend — Linux unshare isolation with MOCK_NAMESPACE fallback"
```

---

### Task 3: createBackend() async update + chat.ts fix

**Files:**
- Modify: `packages/core/src/tools/backends/index.ts`
- Modify: `packages/core/src/api/routes/chat.ts:31`

- [ ] **Step 1: Update index.ts**

Replace `createBackend` (currently lines 13–19):

```typescript
// packages/core/src/tools/backends/index.ts
export type { ShellBackend, ShellResult } from './types.js'
export { NativeBackend } from './native.js'
export { RestrictedLocalBackend } from './restricted-local.js'
export { DockerBackend } from './docker.js'
export { NamespaceBackend } from './namespace.js'

import type { ShellBackend } from './types.js'
import type { TrustLevel } from '../../config.js'
import { NativeBackend } from './native.js'
import { RestrictedLocalBackend } from './restricted-local.js'
import { DockerBackend } from './docker.js'
import { NamespaceBackend } from './namespace.js'

/**
 * Returns the best ShellBackend for the given trust level.
 * At 'sandboxed' tier: prefers NamespaceBackend on Linux, falls back to DockerBackend.
 * Now async because NamespaceBackend.isAvailable() checks the kernel.
 */
export async function createBackend(
  trustLevel: TrustLevel,
  allowedPaths: string[],
): Promise<ShellBackend> {
  if (trustLevel === 'sandboxed') {
    const ns = new NamespaceBackend()
    if (await ns.isAvailable()) return ns
    return new DockerBackend()
  }
  if (trustLevel === 'trusted') return new RestrictedLocalBackend(allowedPaths)
  return new NativeBackend()
}
```

- [ ] **Step 2: Fix the one caller in chat.ts**

In `packages/core/src/api/routes/chat.ts`, find line 31:
```typescript
  const backend = createBackend(config.agentTrustLevel, [config.agentWorkdir])
```

Change to:
```typescript
  const backend = await createBackend(config.agentTrustLevel, [config.agentWorkdir])
```

- [ ] **Step 3: Run all core tests — verify PASS**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass (namespace tests use MOCK_NAMESPACE=1 automatically via the test env setup — you may need to add `MOCK_NAMESPACE=1` to the vitest environment).

To set `MOCK_NAMESPACE=1` for all tests, add to `packages/core/vitest.config.ts`:

```typescript
// packages/core/vitest.config.ts  (add env block)
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    env: {
      MOCK_NAMESPACE: '1',
    },
  },
})
```

Check if `vitest.config.ts` already exists in packages/core — if so, add the `env` block to the existing config rather than replacing it.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/tools/backends/index.ts \
        packages/core/src/api/routes/chat.ts \
        packages/core/vitest.config.ts
git commit -m "feat(sandbox): make createBackend async, auto-select NamespaceBackend on Linux"
```

---

## Chunk 2: VllmBackend + ModelRouter

### Task 4: vllm.ts — OpenAI-compatible client

**Files:**
- Create: `packages/core/src/models/vllm.ts`
- Create: `packages/core/src/models/__tests__/vllm.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/core/src/models/__tests__/vllm.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VllmClient } from '../vllm.js'

describe('VllmClient', () => {
  it('isAvailable returns false when endpoint unreachable', async () => {
    const client = new VllmClient('http://127.0.0.1:19999')  // nothing there
    expect(await client.isAvailable()).toBe(false)
  })

  it('isAvailable returns true when health endpoint responds 200', async () => {
    // Mock fetch
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const client = new VllmClient('http://localhost:8000')
    expect(await client.isAvailable()).toBe(true)
    vi.unstubAllGlobals()
  })

  it('chat sends correct OpenAI format and returns content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'hello from vllm' } }],
      }),
    }))
    const client = new VllmClient('http://localhost:8000')
    const result = await client.chat('llama3', [{ role: 'user', content: 'hi' }])
    expect(result).toBe('hello from vllm')

    const calls = vi.mocked(fetch).mock.calls
    const body = JSON.parse(calls[0][1]!.body as string)
    expect(body.model).toBe('llama3')
    expect(body.messages[0].role).toBe('user')
    vi.unstubAllGlobals()
  })

  it('chat throws on non-200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'internal error',
    }))
    const client = new VllmClient('http://localhost:8000')
    await expect(client.chat('llama3', [])).rejects.toThrow('vLLM error 500')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
cd packages/core && pnpm test src/models/__tests__/vllm.test.ts
```

Expected: `Failed to load url ../vllm.js`

- [ ] **Step 3: Implement vllm.ts**

```typescript
// packages/core/src/models/vllm.ts
import { randomUUID } from 'node:crypto'
import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
import type { LocalChatMessage } from './ollama.js'

/**
 * Thin client for vLLM's OpenAI-compatible HTTP API.
 * Speaks the same logical interface as OllamaClient so ModelRouter can swap them.
 *
 * vLLM serves at localhost:8000 by default.
 * Install: pip install vllm
 * Start:   vllm serve <model-name>
 */
export class VllmClient {
  constructor(private readonly baseUrl = 'http://localhost:8000') {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2_000),
      })
      return res.ok
    } catch {
      return false
    }
  }

  async chat(model: string, messages: LocalChatMessage[]): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
    })
    if (!res.ok) throw new Error(`vLLM error ${res.status}: ${await res.text()}`)
    const data = await res.json() as {
      choices: Array<{ message: { content: string } }>
    }
    return data.choices[0]?.message.content ?? ''
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    // Convert Ollama tool schema → OpenAI function tool format
    const openaiTools = tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }))

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, tools: openaiTools, stream: false }),
    })
    if (!res.ok) throw new Error(`vLLM error ${res.status}: ${await res.text()}`)

    const data = await res.json() as {
      choices: Array<{
        message: {
          content: string | null
          tool_calls?: Array<{
            id: string
            function: { name: string; arguments: string }
          }>
        }
      }>
    }
    const msg = data.choices[0]?.message
    const toolCalls: ToolCall[] = (msg?.tool_calls ?? []).map(tc => ({
      id: tc.id ?? randomUUID(),
      name: tc.function.name,
      args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }))
    return { content: msg?.content ?? '', toolCalls }
  }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
cd packages/core && pnpm test src/models/__tests__/vllm.test.ts
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/models/vllm.ts \
        packages/core/src/models/__tests__/vllm.test.ts
git commit -m "feat(models): add VllmClient — OpenAI-compatible vLLM HTTP client"
```

---

### Task 5: ModelRouter + config — vLLM auto-detection

**Files:**
- Modify: `packages/core/src/config.ts`
- Modify: `packages/core/src/models/router.ts`

- [ ] **Step 1: Add vllmUrl to Config**

In `packages/core/src/config.ts`, add `vllmUrl: string` to the `Config` interface:

```typescript
export interface Config {
  // ... existing fields ...
  vllmUrl: string   // add this line
}
```

And in `loadConfig()`, add:

```typescript
    vllmUrl: process.env.CC_VLLM_URL ?? 'http://127.0.0.1:8000',
```

Add it after the `ollamaUrl` block. Use the same SSRF-safe localhost validation pattern as `ollamaUrl` if you want to be safe, but a simple default is fine for Phase 3.

- [ ] **Step 2: Update RouterConfig and ModelRouter**

Replace `packages/core/src/models/router.ts` with:

```typescript
// packages/core/src/models/router.ts
import { OllamaClient, type LocalChatMessage } from './ollama.js'
import { VllmClient } from './vllm.js'
import { CascadeRouter } from '../routing/cascade.js'
import type { RouteDecision } from '../routing/types.js'
import type { ChatMessage, OllamaToolSchema } from '../agents/session.js'
import type { ToolCall } from '../agents/types.js'
import { loadConfig } from '../config.js'

export interface RouterConfig {
  ollamaUrl: string
  vllmUrl?: string
  defaultModel: string
}

export interface ChatOptions {
  model?: string
}

export class ModelRouter {
  ollama: OllamaClient
  vllm: VllmClient
  cascade: CascadeRouter
  private vllmAvailable: boolean | null = null

  constructor(private config: RouterConfig) {
    this.ollama = new OllamaClient({ baseUrl: config.ollamaUrl })
    this.vllm = new VllmClient(config.vllmUrl ?? 'http://localhost:8000')
    const appConfig = loadConfig()
    this.cascade = new CascadeRouter({
      ollamaUrl: config.ollamaUrl,
      dataDir: appConfig.dataDir,
      routerConfidence: appConfig.routerConfidence,
      tinyRouterModel: appConfig.tinyRouterModel,
      quantRouterModel: appConfig.quantRouterModel,
      vramBudgetGb: appConfig.vramBudgetGb,
    })
  }

  /** Lazy probe: checks vLLM once, caches result. */
  private async inferenceClient(): Promise<OllamaClient | VllmClient> {
    if (this.vllmAvailable === null) {
      this.vllmAvailable = await this.vllm.isAvailable()
      console.log(`[model-router] inference backend: ${this.vllmAvailable ? 'vLLM (GPU)' : 'Ollama (CPU)'}`)
    }
    return this.vllmAvailable ? this.vllm : this.ollama
  }

  async chat(
    messages: LocalChatMessage[],
    options?: ChatOptions,
  ): Promise<{ reply: string; decision: RouteDecision }> {
    const lastMessage = messages[messages.length - 1].content
    const decision = await this.cascade.route(lastMessage)
    const client = await this.inferenceClient()

    const candidates = options?.model
      ? [options.model]
      : [decision.model, ...decision.fallbackModels]

    let lastErr: unknown
    for (const model of candidates) {
      try {
        const reply = await client.chat(model, messages)
        return { reply, decision: { ...decision, model } }
      } catch (err) {
        lastErr = err
        console.warn(`[router] model ${model} failed, trying next fallback`)
      }
    }
    throw lastErr ?? new Error('All candidate models failed')
  }

  async chatWithTools(
    model: string,
    messages: ChatMessage[],
    tools: OllamaToolSchema[],
  ): Promise<{ content: string; toolCalls: ToolCall[] }> {
    const client = await this.inferenceClient()
    return client.chatWithTools(model, messages, tools)
  }

  async listModels(): Promise<string[]> {
    return this.ollama.listModels()
  }

  close(): void {
    this.cascade.close()
  }
}
```

- [ ] **Step 3: Update chat.ts to pass vllmUrl**

In `packages/core/src/api/routes/chat.ts`, find the ModelRouter construction:
```typescript
  const router = new ModelRouter({ ollamaUrl: config.ollamaUrl, defaultModel: config.defaultModel })
```

Change to:
```typescript
  const router = new ModelRouter({ ollamaUrl: config.ollamaUrl, vllmUrl: config.vllmUrl, defaultModel: config.defaultModel })
```

- [ ] **Step 4: Run all core tests — verify PASS**

```bash
cd packages/core && pnpm test
```

Expected: all tests pass. The vLLM probe during tests will fail (no server running) and fall back to Ollama — that's correct.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config.ts \
        packages/core/src/models/router.ts \
        packages/core/src/api/routes/chat.ts
git commit -m "feat(models): add vLLM auto-detection to ModelRouter — GPU inference with Ollama fallback"
```

---

## Chunk 3: ISO Hardening + CI + flash.sh

### Task 6: ISO build hardening

**Files:**
- Modify: `coastalos/build/packages.list`
- Modify: `coastalos/build/hooks/post-install.sh`
- Create: `coastalos/systemd/coastal-vllm.service`
- Modify: `coastalos/systemd/coastal-server.service`

- [ ] **Step 1: Pin packages in packages.list**

Replace `coastalos/build/packages.list` with pinned versions:

```
# CoastalOS package list — pinned for reproducible builds
# Core runtime
nodejs
npm
python3
python3-pip
python3-venv

# Display / kiosk
labwc
alacritty
chromium-browser
xwayland
xdg-utils

# Audio (voice pipeline)
pipewire
pipewire-pulse
wireplumber
portaudio19-dev

# Sandbox tools
util-linux
cgroup-tools

# Voice pipeline dependencies
curl
ffmpeg

# Development / build tools (for pnpm install on first boot)
git
build-essential
```

- [ ] **Step 2: Update post-install.sh — add vLLM + GPU detection + cgroup setup**

Replace `coastalos/build/hooks/post-install.sh`:

```bash
#!/bin/bash
set -e

echo "[post-install] Installing CoastalClaw..."

# Install pnpm
npm install -g pnpm

# Install Ollama (always — CPU fallback)
curl -fsSL https://ollama.com/install.sh | sh

# Install piper-tts
pip3 install piper-tts --break-system-packages

# Install openwakeword
pip3 install openwakeword --break-system-packages

# Install vLLM only if GPU present (CUDA or ROCm)
if nvidia-smi &>/dev/null 2>&1 || rocm-smi &>/dev/null 2>&1; then
  echo "[post-install] GPU detected — installing vLLM..."
  pip3 install vllm --break-system-packages || echo "[post-install] vLLM install failed — Ollama fallback active"
  systemctl enable coastal-vllm.service || true
else
  echo "[post-install] No GPU detected — vLLM skipped, using Ollama"
fi

# Create coastal user
useradd -m -s /bin/bash coastal || true
mkdir -p /opt/coastalclaw /var/lib/coastalclaw/data /var/lib/coastalclaw/workspace
chown -R coastal:coastal /opt/coastalclaw /var/lib/coastalclaw

# Set up cgroup slice for namespace sandbox
mkdir -p /etc/systemd/system/coastal.slice.d
cat > /etc/systemd/system/coastal.slice.d/limits.conf << 'SLICE_EOF'
[Slice]
MemoryMax=512M
CPUQuota=200%
SLICE_EOF

# Copy labwc config
mkdir -p /home/coastal/.config/labwc
cp /tmp/labwc/rc.xml /home/coastal/.config/labwc/
cp /tmp/labwc/autostart /home/coastal/.config/labwc/
chmod +x /home/coastal/.config/labwc/autostart
chown -R coastal:coastal /home/coastal/.config

# Enable core services
systemctl enable coastal-server.service
systemctl enable coastal-daemon.service
systemctl enable coastal-architect.timer
systemctl enable coastal-shell.service

# Set autologin for coastal user
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin coastal --noclear %I $TERM
EOF

echo "[post-install] Done."
```

- [ ] **Step 3: Create coastal-vllm.service**

Create `coastalos/systemd/coastal-vllm.service`:

```ini
[Unit]
Description=CoastalClaw vLLM Inference Server
After=network.target
ConditionPathExists=/usr/local/bin/vllm

[Service]
Type=simple
User=coastal
WorkingDirectory=/opt/coastalclaw
Environment=CC_VLLM_MODEL=llama3.2
ExecStart=/usr/local/bin/vllm serve ${CC_VLLM_MODEL} --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Add CAP_SYS_ADMIN to coastal-server.service**

Read `coastalos/systemd/coastal-server.service`. In the `[Service]` section, add:

```ini
AmbientCapabilities=CAP_SYS_ADMIN CAP_NET_ADMIN
CapabilityBoundingSet=CAP_SYS_ADMIN CAP_NET_ADMIN
```

These capabilities allow `unshare --net` and overlayfs mounts without running as root.

- [ ] **Step 5: Commit**

```bash
git add coastalos/build/packages.list \
        coastalos/build/hooks/post-install.sh \
        coastalos/systemd/coastal-vllm.service \
        coastalos/systemd/coastal-server.service
git commit -m "feat(iso): harden build — pinned packages, vLLM GPU detection, CAP_SYS_ADMIN for NamespaceBackend"
```

---

### Task 7: GitHub Actions ISO CI + QEMU smoke test

**Files:**
- Create: `.github/workflows/iso-build.yml`
- Create: `coastalos/build/test/smoke-test.sh`

- [ ] **Step 1: Create smoke-test.sh**

Create `coastalos/build/test/smoke-test.sh`:

```bash
#!/usr/bin/env bash
# smoke-test.sh — boot CoastalOS ISO in QEMU and verify coastal-server starts
# Usage: bash smoke-test.sh <iso-file>
set -e

ISO="$1"
[ -f "$ISO" ] || { echo "Error: ISO not found: $ISO"; exit 1; }

TIMEOUT=120  # seconds to wait for server health check

echo "[smoke-test] Booting $ISO in QEMU..."

# Start QEMU with serial console (no display needed in CI)
qemu-system-x86_64 \
  -cdrom "$ISO" \
  -m 2048 \
  -smp 2 \
  -nographic \
  -serial mon:stdio \
  -net nic \
  -net user,hostfwd=tcp::14747-:4747 \
  -no-reboot \
  -boot d \
  &

QEMU_PID=$!

echo "[smoke-test] Waiting up to ${TIMEOUT}s for coastal-server on :14747..."

ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -sf http://localhost:14747/health > /dev/null 2>&1; then
    echo "[smoke-test] ✓ coastal-server is healthy after ${ELAPSED}s"
    kill $QEMU_PID 2>/dev/null || true
    exit 0
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo "[smoke-test] ✗ coastal-server did not respond within ${TIMEOUT}s"
kill $QEMU_PID 2>/dev/null || true
exit 1
```

```bash
chmod +x coastalos/build/test/smoke-test.sh
```

- [ ] **Step 2: Create iso-build.yml**

Create `.github/workflows/iso-build.yml`:

```yaml
name: CoastalOS ISO Build

on:
  push:
    branches: [master]
    paths:
      - 'coastalos/**'
      - '.github/workflows/iso-build.yml'
  workflow_dispatch:
    inputs:
      version:
        description: 'ISO version tag (e.g. 0.3.1)'
        required: false
        default: 'ci'

jobs:
  build-iso:
    runs-on: ubuntu-24.04
    timeout-minutes: 60

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install live-build and QEMU
        run: |
          sudo apt-get update -qq
          sudo apt-get install -y live-build qemu-system-x86 ovmf curl

      - name: Build ISO
        run: |
          VERSION="${{ github.event.inputs.version || 'ci' }}"
          sudo bash coastalos/build/build.sh "$VERSION"
          ls -lh coastalos-*.iso

      - name: QEMU smoke test
        run: |
          ISO=$(ls coastalos-*.iso | head -1)
          bash coastalos/build/test/smoke-test.sh "$ISO"

      - name: Upload ISO artifact
        uses: actions/upload-artifact@v4
        with:
          name: coastalos-${{ github.event.inputs.version || 'ci' }}-${{ github.run_number }}.iso
          path: coastalos-*.iso
          retention-days: 7
          if-no-files-found: error
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/iso-build.yml \
        coastalos/build/test/smoke-test.sh
git commit -m "ci: add GitHub Actions ISO build workflow with QEMU smoke test"
```

---

### Task 8: flash.sh — USB flashing helper

**Files:**
- Create: `flash.sh`

- [ ] **Step 1: Create flash.sh at repo root**

```bash
#!/usr/bin/env bash
# flash.sh — Write CoastalOS ISO to a USB drive
# Usage: sudo ./flash.sh [iso-file] [device]
# Example: sudo ./flash.sh coastalos-0.3.0.iso /dev/sdb
set -euo pipefail

ISO="${1:-}"
DEVICE="${2:-}"

# Find latest ISO if not specified
if [ -z "$ISO" ]; then
  ISO=$(ls coastalos-*.iso 2>/dev/null | sort -V | tail -1 || true)
  [ -n "$ISO" ] || { echo "Error: no coastalos-*.iso found. Build one first with: bash coastalos/build/build.sh"; exit 1; }
  echo "Auto-selected ISO: $ISO"
fi

[ -f "$ISO" ] || { echo "Error: ISO not found: $ISO"; exit 1; }

# Detect USB drives if device not specified
if [ -z "$DEVICE" ]; then
  echo ""
  echo "Available removable drives:"
  echo "────────────────────────────────────────"
  lsblk -d -o NAME,SIZE,TRAN,MODEL | grep -v "loop\|sr\|NAME" || true
  echo "────────────────────────────────────────"
  echo ""
  read -rp "Enter target device (e.g. /dev/sdb) — ALL DATA WILL BE ERASED: " DEVICE
fi

# Safety checks
[ -b "$DEVICE" ] || { echo "Error: $DEVICE is not a block device. Aborting."; exit 1; }

# Warn if device looks like a system disk (heuristic: < 16GB)
SIZE_BYTES=$(blockdev --getsize64 "$DEVICE" 2>/dev/null || echo 0)
SIZE_GB=$((SIZE_BYTES / 1024 / 1024 / 1024))
ISO_BYTES=$(stat -c%s "$ISO")
[ "$ISO_BYTES" -lt "$SIZE_BYTES" ] || { echo "Error: ISO ($((ISO_BYTES/1024/1024))MB) is larger than device (${SIZE_GB}GB). Aborting."; exit 1; }

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  CoastalOS USB Flash                        │"
echo "│  ISO:    $ISO"
echo "│  Device: $DEVICE  (${SIZE_GB}GB)"
echo "│                                             │"
echo "│  ⚠  ALL DATA ON $DEVICE WILL BE ERASED  ⚠  │"
echo "└─────────────────────────────────────────────┘"
echo ""
read -rp "Type YES (all caps) to flash: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "Aborted."; exit 0; }

echo "[flash] Writing $ISO → $DEVICE ..."
dd if="$ISO" of="$DEVICE" bs=4M status=progress oflag=sync conv=fsync
sync

echo ""
echo "[flash] Done! Remove the USB drive and boot from it."
echo "        On most systems: press F12 / F2 / DEL at startup to select boot device."
```

```bash
chmod +x flash.sh
```

- [ ] **Step 2: Run full test suite — all packages**

```bash
pnpm test
```

Expected: all packages pass. Make note of any failures unrelated to Phase 3.

- [ ] **Step 3: Commit and tag**

```bash
git add flash.sh
git commit -m "feat(iso): add flash.sh — one-command CoastalOS USB flashing helper"

git tag v0.4.0-phase3-clawos
git push origin feat/phase3-clawos
git push origin v0.4.0-phase3-clawos
```

---

## Integration notes for Ubuntu dev machine

When running on Ubuntu (not Windows):

1. **NamespaceBackend will activate automatically** — `MOCK_NAMESPACE` is not set in production, so `isAvailable()` checks real kernel support. Confirm with:
   ```bash
   unshare --user true && echo "user namespaces OK"
   grep overlay /proc/filesystems && echo "overlayfs OK"
   ```

2. **Run integration tests without mock:**
   ```bash
   cd packages/core && pnpm test src/tools/backends/__tests__/namespace.test.ts
   # Tests will use real unshare — MOCK_NAMESPACE is NOT set outside vitest.config.ts
   ```
   Note: The `vitest.config.ts` env sets `MOCK_NAMESPACE=1` for the Vitest runner. To test the real backend on Ubuntu, run a quick manual integration test outside vitest.

3. **Build the ISO on Ubuntu:**
   ```bash
   sudo apt install live-build
   sudo bash coastalos/build/build.sh dev
   ```

4. **Flash to USB:**
   ```bash
   sudo ./flash.sh coastalos-dev.iso /dev/sdX
   ```

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
