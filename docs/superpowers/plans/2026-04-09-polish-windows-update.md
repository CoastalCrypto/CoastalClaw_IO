# Polish & Windows Update Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invisible layout toggle button in the multi-pane chat UI, fix Windows auto-update restart, and clean dead code from the multi-pane additions.

**Architecture:** Three independent surgical edits — UI-only toggle redesign in `Chat.tsx`, platform-aware restart extracted into `system-restart.ts` and wired into `system.ts`, and a dead-code/quality pass across the multi-pane files. New files: `system-restart.ts` (production), `ChatPane.test.tsx` and `system.test.ts` (tests).

**Tech Stack:** React + Tailwind v4 (web), Fastify + Node 22 ESM (core), vitest + @testing-library/react (tests), pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-04-09-polish-windows-update-design.md`

---

## File Map

| File | Change |
|------|--------|
| `packages/web/src/pages/Chat.tsx` | Replace bare unicode button with styled pill + SVG; remove `LAYOUT_ICONS`; add return type to `LayoutIcon`; add `display:none` comment |
| `packages/web/src/components/ChatPane.tsx` | Fix `compact` comment; add return type; remove any console.log/TODO |
| `packages/web/src/components/ChatPane.test.tsx` | New — tests for layout toggle visibility |
| `packages/core/src/api/routes/system-restart.ts` | New — platform-aware restart logic extracted for testability |
| `packages/core/src/api/routes/system.ts` | Import `restartServer`; replace restart block; add `GIT_TERMINAL_PROMPT` guard |
| `packages/core/src/api/routes/__tests__/system.test.ts` | New — unit tests for Windows and Linux restart paths |

---

## Chunk 1: Layout Toggle Redesign

### Task 1: Write the failing test for the layout toggle button

**File:** `packages/web/src/components/ChatPane.test.tsx` (create new)

The test renders Chat and verifies the layout picker button has a visible background. Use static imports — `vi.mock` calls are hoisted by Vitest's transformer before any imports, so no dynamic import is needed.

- [ ] **Step 1: Create the test file**

```tsx
// packages/web/src/components/ChatPane.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Chat from '../pages/Chat'

// vi.mock is hoisted to before imports by Vitest — mocks are in place when Chat loads
vi.mock('../api/client', () => ({
  CoreClient: vi.fn().mockImplementation(() => ({
    listAgents: vi.fn().mockResolvedValue([]),
    getCredentials: vi.fn().mockResolvedValue({}),
  })),
}))
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

describe('Layout toggle button', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agents: [] }),
    } as unknown as Response)
  })

  it('has a visible background at rest (not just bare color)', async () => {
    render(<Chat />)
    const btn = await screen.findByTitle('Split panes')
    const bg = btn.style.background || btn.style.backgroundColor
    expect(bg).not.toBe('')
    expect(bg).not.toBe('transparent')
  })

  it('renders an SVG grid icon inside the trigger button', async () => {
    render(<Chat />)
    const btn = await screen.findByTitle('Split panes')
    expect(btn.querySelector('svg')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd packages/web && pnpm test -- ChatPane.test
```

Expected output: FAIL — `background` is `''`, no SVG inside the button (currently a unicode char).

---

### Task 2: Implement the styled pill trigger button

**File:** `packages/web/src/pages/Chat.tsx`

- [ ] **Step 3: Replace the trigger button (lines 786–795)**

Find:
```tsx
<button
  onClick={() => setLayoutOpen(o => !o)}
  title="Split panes"
  className="text-xs font-mono transition-colors"
  style={{ color: paneCount > 1 ? '#00D4FF' : '#4a5568' }}
  onMouseEnter={e => { if (paneCount === 1) (e.currentTarget as HTMLElement).style.color = '#a0aec0' }}
  onMouseLeave={e => { if (paneCount === 1) (e.currentTarget as HTMLElement).style.color = '#4a5568' }}
>
  {LAYOUT_ICONS[paneCount] ?? '⊞'}
</button>
```

Replace with:
```tsx
<button
  onClick={() => setLayoutOpen(o => !o)}
  title="Split panes"
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 10px',
    borderRadius: '6px',
    background: paneCount > 1 ? 'rgba(0,212,255,0.20)' : 'rgba(0,212,255,0.08)',
    border: paneCount > 1 ? '1px solid rgba(0,212,255,0.55)' : '1px solid rgba(0,212,255,0.25)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }}
  onMouseEnter={e => {
    if (paneCount === 1) {
      (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.14)'
      ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.40)'
    }
  }}
  onMouseLeave={e => {
    if (paneCount === 1) {
      (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.08)'
      ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,212,255,0.25)'
    }
  }}
>
  <LayoutIcon count={paneCount} size={16} />
  {paneCount > 1 && (
    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00D4FF', lineHeight: 1 }}>
      {paneCount}×
    </span>
  )}
</button>
```

- [ ] **Step 4: Delete the dead `LAYOUT_ICONS` map (line 146)**

Find and delete:
```tsx
const LAYOUT_ICONS: Record<number, string> = { 1: '□', 2: '⊟', 3: '≡', 4: '⊞', 6: '⊟', 8: '⊟', 9: '⊠' }
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd packages/web && pnpm test -- ChatPane.test
```

Expected: PASS.

- [ ] **Step 6: Build web to verify no TS errors**

```bash
cd packages/web && pnpm build
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/pages/Chat.tsx packages/web/src/components/ChatPane.test.tsx
git commit -m "feat(web): restyle layout toggle as visible pill with SVG icon"
```

---

## Chunk 2: Windows Update Fix

### Task 3: Add Windows restart path to the update route

- [ ] **Step 1: Write the failing test**

Create **`packages/core/src/api/routes/__tests__/system.test.ts`**:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('restartServer', () => {
  // vi.resetModules() ensures each test gets a fresh module instance
  // with its own set of mocks — prevents cache bleeding between win32/linux tests
  beforeEach(() => { vi.resetModules() })
  afterEach(() => { vi.restoreAllMocks() })

  it('spawns a detached cmd.exe on win32 instead of calling systemctl', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const spawnMock = vi.fn().mockReturnValue({ unref: vi.fn() })
    vi.doMock('node:child_process', () => ({ execSync: vi.fn(), spawn: spawnMock }))
    vi.doMock('node:fs', () => ({ writeFileSync: vi.fn() }))
    vi.doMock('node:os', () => ({ tmpdir: () => '/tmp' }))
    vi.doMock('node:path', () => ({ join: (...p: string[]) => p.join('/') }))

    const { restartServer } = await import('../system-restart.js')
    // Intercept process.exit so the test doesn't actually exit
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)

    restartServer('/install/dir')

    expect(spawnMock).toHaveBeenCalledWith(
      'cmd.exe',
      expect.arrayContaining(['/c', expect.stringContaining('Coastal.AI-restart.cmd')]),
      expect.objectContaining({ detached: true }),
    )
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('calls systemctl on linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const execSyncMock = vi.fn()
    vi.doMock('node:child_process', () => ({ execSync: execSyncMock, spawn: vi.fn() }))
    vi.doMock('node:fs', () => ({ writeFileSync: vi.fn() }))
    vi.doMock('node:os', () => ({ tmpdir: () => '/tmp' }))
    vi.doMock('node:path', () => ({ join: (...p: string[]) => p.join('/') }))

    const { restartServer } = await import('../system-restart.js')

    restartServer('/install/dir')

    expect(execSyncMock).toHaveBeenCalledWith(
      'systemctl restart Coastal.AI-server',
      expect.objectContaining({ timeout: 10_000 }),
    )
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/core && pnpm test -- system.test
```

Expected: FAIL — `system-restart.js` module not found.

- [ ] **Step 3: Create `system-restart.ts`**

Create **`packages/core/src/api/routes/system-restart.ts`**:

```ts
import { execSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Restart the server process after an in-place update.
 *
 * Windows: writes a detached .cmd that waits 2 s then re-launches node.
 *          cmd.exe is always available; no external service manager needed.
 * Linux/Mac: tries systemctl first (systemd installations), falls back to
 *            process.exit(0) so a supervisor (systemd Restart=always, pm2, etc.) restarts us.
 */
export function restartServer(installDir: string): void {
  if (process.platform === 'win32') {
    const script = join(tmpdir(), 'Coastal.AI-restart.cmd')
    writeFileSync(script, [
      '@echo off',
      'timeout /t 2 /nobreak > nul',
      `cd /d "${installDir}"`,
      'node packages/core/dist/main.js',
    ].join('\r\n'))
    const child = spawn('cmd.exe', ['/c', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
    process.exit(0)
  } else {
    try {
      execSync('systemctl restart Coastal.AI-server', { timeout: 10_000 })
    } catch {
      process.exit(0)
    }
  }
}
```

- [ ] **Step 4: Wire `restartServer` into `system.ts`**

**Add import** at end of existing imports in `packages/core/src/api/routes/system.ts`:
```ts
import { restartServer } from './system-restart.js'
```

**Replace the restart block** (lines 217–222):

Find:
```ts
        // Restart via systemd if running under it, otherwise send SIGHUP
        try {
          execSync('systemctl restart Coastal.AI-server 2>/dev/null || true', { timeout: 10_000 })
        } catch {
          process.exit(0) // supervisor (systemd Restart=always) will restart us
        }
```

Replace with:
```ts
        // Platform-aware restart: Windows uses detached cmd.exe, Linux uses systemd
        restartServer(installDir)
```

**Add `GIT_TERMINAL_PROMPT` guard** in `GET /api/admin/update-check` (line 192):

Find:
```ts
      const remoteLine = execSync('git ls-remote origin HEAD', { timeout: 10_000 }).toString().trim()
```

Replace with:
```ts
      const remoteLine = execSync('git ls-remote origin HEAD', {
        timeout: 10_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }).toString().trim()
```

- [ ] **Step 5: Run the tests**

```bash
cd packages/core && pnpm test -- system.test
```

Expected: PASS — both win32 spawn and linux systemctl assertions pass.

- [ ] **Step 6: Build core**

```bash
cd packages/core && pnpm build
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/api/routes/system-restart.ts \
        packages/core/src/api/routes/system.ts \
        packages/core/src/api/routes/__tests__/system.test.ts
git commit -m "fix(core): Windows-aware update restart + git credential guard"
```

---

## Chunk 3: Code Quality Pass

### Task 4: Clean up multi-pane additions

- [ ] **Step 1: Add `display:none` comment in `Chat.tsx` (line ~920)**

Find:
```tsx
<div className="flex flex-1 min-h-0" style={{ display: paneCount > 1 ? 'none' : 'flex' }}>
```

Replace with:
```tsx
{/* display:none (not conditional render) preserves the single-pane state — avoids
    remounting the SSE stream and scroll position when switching back from multi-pane */}
<div className="flex flex-1 min-h-0" style={{ display: paneCount > 1 ? 'none' : 'flex' }}>
```

- [ ] **Step 2: Add explicit return type to `LayoutIcon` in `Chat.tsx`**

Find:
```tsx
function LayoutIcon({ count, size }: { count: number; size: number }) {
```

Replace with:
```tsx
function LayoutIcon({ count, size }: { count: number; size: number }): JSX.Element {
```

- [ ] **Step 3: Add explicit return type to `ChatPane` in `ChatPane.tsx`**

Find (line 23):
```tsx
export function ChatPane({ paneIndex, agents, focused, onFocus, compact }: Props) {
```

Replace with:
```tsx
export function ChatPane({ paneIndex, agents, focused, onFocus, compact }: Props): JSX.Element {
```

- [ ] **Step 4: Fix the `compact` comment in `ChatPane.tsx` (line 20)**

Find:
```ts
  compact: boolean   // true when 3+ panes — shrinks font/padding
```

Replace with:
```ts
  compact: boolean   // true at 4+ panes — shrinks font/padding for dense layouts
```

- [ ] **Step 5: Check for console.log / TODO artifacts in `ChatPane.tsx`**

```bash
grep -n "console\.\|TODO\|FIXME\|XXX" packages/web/src/components/ChatPane.tsx
```

Expected: no output. Remove anything found.

- [ ] **Step 6: Run full build**

```bash
pnpm --filter @coastal-claw/core build && pnpm --filter web build
```

Expected: both exit 0, zero TypeScript errors.

- [ ] **Step 7: Run full test suite**

```bash
pnpm --filter @coastal-claw/core test && pnpm --filter web test
```

Expected: all tests pass.

- [ ] **Step 8: Commit and push to master**

```bash
git add packages/web/src/pages/Chat.tsx \
        packages/web/src/components/ChatPane.tsx
git commit -m "chore: quality pass — LayoutIcon/ChatPane return types, display:none comment, compact threshold"
git push origin HEAD:master
```
