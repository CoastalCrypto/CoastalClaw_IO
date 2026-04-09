# Polish & Windows Update Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invisible layout toggle button in the multi-pane chat UI, fix Windows auto-update restart, and clean dead code from the multi-pane additions.

**Architecture:** Three independent surgical edits — UI-only toggle redesign in `Chat.tsx`, platform-aware restart in `system.ts`, and a dead-code/quality pass across the multi-pane files. No new abstractions, no new files (except a test file for the toggle).

**Tech Stack:** React + Tailwind v4 (web), Fastify + Node 22 ESM (core), vitest + @testing-library/react (tests), pnpm monorepo

**Spec:** `docs/superpowers/specs/2026-04-09-polish-windows-update-design.md`

---

## File Map

| File | Change |
|------|--------|
| `packages/web/src/pages/Chat.tsx` | Replace bare unicode button with styled pill + SVG; remove `LAYOUT_ICONS` |
| `packages/web/src/components/ChatPane.test.tsx` | New — tests for layout toggle visibility |
| `packages/core/src/api/routes/system.ts` | Platform-aware restart; `GIT_TERMINAL_PROMPT` guard |
| `packages/core/src/api/routes/__tests__/system.test.ts` | New test for Windows restart path |

---

## Chunk 1: Layout Toggle Redesign

### Task 1: Write the failing test for the layout toggle button

**File:** `packages/web/src/components/ChatPane.test.tsx` (create new)

The test renders Chat and verifies the layout picker button has a visible background (not just a bare unicode char with a near-black color).

- [ ] **Step 1: Create the test file**

```tsx
// packages/web/src/components/ChatPane.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chat.tsx has many dependencies — mock the heaviest ones
vi.mock('../api/client', () => ({
  CoreClient: vi.fn().mockImplementation(() => ({
    listAgents: vi.fn().mockResolvedValue([]),
    getCredentials: vi.fn().mockResolvedValue({}),
  })),
}))
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

// Dynamically import after mocks are in place
const { default: Chat } = await import('../pages/Chat')

describe('Layout toggle button', () => {
  beforeEach(() => {
    // Mock fetch for agent list
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ agents: [] }),
    } as unknown as Response)
  })

  it('has a visible background at rest (not just a bare unicode char)', async () => {
    render(<Chat />)
    const btn = await screen.findByTitle('Split panes')
    const bg = btn.style.background || btn.style.backgroundColor
    // Must have some background — not empty string
    expect(bg).not.toBe('')
    expect(bg).not.toBe('transparent')
  })

  it('renders an SVG grid icon inside the trigger (not a unicode char)', async () => {
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

Expected output: FAIL — `background` is `''`, no SVG found (button currently has unicode char).

---

### Task 2: Implement the styled pill trigger button

**File:** `packages/web/src/pages/Chat.tsx` — lines 786–795

Replace the bare button with a styled pill that uses the existing `LayoutIcon` SVG.

- [ ] **Step 3: Replace the trigger button**

Find this block (lines 786–795):
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

- [ ] **Step 4: Delete the dead `LAYOUT_ICONS` map**

Find and delete line 146:
```tsx
const LAYOUT_ICONS: Record<number, string> = { 1: '□', 2: '⊟', 3: '≡', 4: '⊞', 6: '⊟', 8: '⊟', 9: '⊠' }
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd packages/web && pnpm test -- ChatPane.test
```

Expected: PASS (background set, SVG present).

- [ ] **Step 6: Build web to verify no TS errors**

```bash
cd packages/web && pnpm build
```

Expected: exits 0, no TypeScript errors. (`LAYOUT_ICONS` was the only consumer of itself — deleting it won't break anything.)

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/pages/Chat.tsx packages/web/src/components/ChatPane.test.tsx
git commit -m "feat(web): restyle layout toggle as visible pill with SVG icon"
```

---

## Chunk 2: Windows Update Fix

### Task 3: Add Windows restart path to the update route

**File:** `packages/core/src/api/routes/system.ts`

- [ ] **Step 1: Write the failing test**

Find the existing test file for system routes (or check if one exists):

```bash
ls packages/core/src/api/routes/__tests__/
```

If no `system.test.ts` exists, create it. If it exists, add the test case.

**New test file or additions at:** `packages/core/src/api/routes/__tests__/system.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'

// We test the restart logic in isolation — not the full Fastify route.
// Extract the restart function from system.ts so it can be unit-tested.

describe('Windows restart path', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('spawns a detached cmd.exe on win32 instead of calling systemctl', async () => {
    // Arrange: mock process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const spawnMock = vi.fn().mockReturnValue({ unref: vi.fn() })
    vi.doMock('node:child_process', () => ({
      execSync: vi.fn(),
      spawn: spawnMock,
    }))
    vi.doMock('node:fs', () => ({
      readFileSync: vi.fn(),
      existsSync: vi.fn(),
      writeFileSync: vi.fn(),
    }))
    vi.doMock('node:os', () => ({ tmpdir: () => '/tmp' }))

    const { restartServer } = await import('../system-restart.js')
    restartServer('/install/dir')

    expect(spawnMock).toHaveBeenCalledWith(
      'cmd.exe',
      expect.arrayContaining(['/c', expect.stringContaining('coastalclaw-restart.cmd')]),
      expect.objectContaining({ detached: true }),
    )
  })

  it('calls systemctl on linux', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const execSyncMock = vi.fn()
    vi.doMock('node:child_process', () => ({ execSync: execSyncMock, spawn: vi.fn() }))
    vi.doMock('node:fs', () => ({ readFileSync: vi.fn(), existsSync: vi.fn(), writeFileSync: vi.fn() }))
    vi.doMock('node:os', () => ({ tmpdir: () => '/tmp' }))

    const { restartServer } = await import('../system-restart.js')
    restartServer('/install/dir')

    expect(execSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('systemctl'),
      expect.any(Object),
    )
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd packages/core && pnpm test -- system.test
```

Expected: FAIL — `system-restart.js` doesn't exist yet.

- [ ] **Step 3: Extract restart logic into `system-restart.ts`**

Create **`packages/core/src/api/routes/system-restart.ts`**:

```ts
import { execSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Restart the server process after an update.
 * On Windows: writes a detached .cmd script that waits 2s then re-launches node.
 * On Linux/Mac: tries systemctl, falls back to process.exit(0) for non-systemd supervisors.
 */
export function restartServer(installDir: string): void {
  if (process.platform === 'win32') {
    const script = join(tmpdir(), 'coastalclaw-restart.cmd')
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
      execSync('systemctl restart coastalclaw-server', { timeout: 10_000 })
    } catch {
      process.exit(0)
    }
  }
}
```

- [ ] **Step 4: Update `system.ts` to use `restartServer` and add the git credential guard**

In `packages/core/src/api/routes/system.ts`:

**Add import** at the top (after existing imports):
```ts
import { restartServer } from './system-restart.js'
```

**Update `execSync` import** to also include `spawn` only if needed elsewhere — `spawn` is now in `system-restart.ts` so no change needed here.

**Replace the restart block** in `POST /api/admin/update` (lines 217–222):

Find:
```ts
        // Restart via systemd if running under it, otherwise send SIGHUP
        try {
          execSync('systemctl restart coastalclaw-server 2>/dev/null || true', { timeout: 10_000 })
        } catch {
          process.exit(0) // supervisor (systemd Restart=always) will restart us
        }
```

Replace with:
```ts
        // Restart — platform-aware (Windows uses detached cmd.exe; Linux uses systemd)
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
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' },
      }).toString().trim()
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd packages/core && pnpm test -- system.test
```

Expected: PASS — both win32 and linux paths verified.

- [ ] **Step 6: Build core to verify no TS errors**

```bash
cd packages/core && pnpm build
```

Expected: exits 0, no errors.

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

- [ ] **Step 1: Add explanatory comment for the `display: none` single-pane wrapper in `Chat.tsx`**

Find (line ~920):
```tsx
<div className="flex flex-1 min-h-0" style={{ display: paneCount > 1 ? 'none' : 'flex' }}>
```

Replace with:
```tsx
{/* display:none (not conditional render) preserves the full single-pane chat state — avoids
    remounting AgentSession, SSE stream, and scroll position when switching back from multi-pane */}
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

- [ ] **Step 3: Check `ChatPane.tsx` for any `console.log` or incomplete TODO**

Run:
```bash
grep -n "console\.\|TODO\|FIXME\|XXX" packages/web/src/components/ChatPane.tsx
```

Expected: no output. If any are found, remove them.

- [ ] **Step 4: Verify `compact` comment accuracy in `ChatPane.tsx`**

Line 20 currently says `// true when 3+ panes`. The design says compact activates at 4+ panes. Verify the comment matches the actual threshold in `Chat.tsx`.

In `Chat.tsx` find: `compact={paneCount >= 4}` — threshold is 4, not 3. Fix the comment:

Find in `ChatPane.tsx`:
```ts
  compact: boolean   // true when 3+ panes — shrinks font/padding
```

Replace with:
```ts
  compact: boolean   // true at 4+ panes — shrinks font/padding for dense layouts
```

- [ ] **Step 5: Run full build to confirm everything is clean**

```bash
pnpm --filter @coastal-claw/core build && pnpm --filter web build
```

Expected: both exit 0, zero TypeScript errors.

- [ ] **Step 6: Run full test suite**

```bash
pnpm --filter @coastal-claw/core test && pnpm --filter web test
```

Expected: all tests pass.

- [ ] **Step 7: Commit and push to master**

```bash
git add packages/web/src/pages/Chat.tsx packages/web/src/components/ChatPane.tsx
git commit -m "chore: clean up multi-pane dead comment, LayoutIcon return type, compact threshold"
git push origin HEAD:master
```
