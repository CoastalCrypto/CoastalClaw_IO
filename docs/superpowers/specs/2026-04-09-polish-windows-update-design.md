# Coastal.AI — Polish & Windows Update Fix Design

**Date:** 2026-04-09
**Branch:** `master`
**Scope:** Layout toggle visibility, Windows auto-update restart, code quality pass

---

## Problem Statement

Three issues identified after v1.2.1 / multi-pane chat launch:

1. **Layout toggle invisible** — the pane count picker button in the Chat header is a bare unicode character (`□ ⊟ ⊞`) colored `#4a5568` with no background or border. Invisible at rest on the dark UI.
2. **Windows update broken** — `POST /api/admin/update` pulls and builds successfully but then calls `systemctl restart` (Linux-only). On Windows this throws, falls through to `process.exit(0)`, and the server dies permanently with nothing to restart it.
3. **Code quality** — the multi-pane additions have dead code (`LAYOUT_ICONS` unicode map), imperative style mutations on hover, and minor TypeScript gaps.

---

## Section 1: Layout Toggle Redesign

### File
`packages/web/src/pages/Chat.tsx`

### Changes

**Trigger button — before:**
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

**Trigger button — after:**
- Replace unicode char with `<LayoutIcon count={paneCount} size={16} />`
- Add pill shape: `borderRadius: '6px'`, background + border using cyan alpha
- Inactive (1 pane): `rgba(0,212,255,0.08)` bg, `1px solid rgba(0,212,255,0.25)` border
- Active (2+ panes): `rgba(0,212,255,0.20)` bg, `1px solid rgba(0,212,255,0.55)` border
- Add count label when active: `{paneCount > 1 && <span>{paneCount}×</span>}`
- Remove imperative `onMouseEnter`/`onMouseLeave` color mutations — use CSS transition on the pill styles instead
- No hover state needed beyond the border brightening (pill shape provides affordance)

**Dead code removal:**
- Delete `const LAYOUT_ICONS: Record<number, string> = { ... }` — unused once SVG is the trigger

### Acceptance Criteria
- Button is clearly visible at rest on the dark UI
- Active state (2+ panes) is distinctly brighter than inactive
- Dropdown grid behaviour unchanged
- No TypeScript errors

---

## Section 2: Windows Update Fix

### File
`packages/core/src/api/routes/system.ts`

### Root Cause
After `pnpm build`, the update handler does:
```ts
execSync('systemctl restart Coastal.AI-server 2>/dev/null || true', { timeout: 10_000 })
```
On Windows, `systemctl` doesn't exist. The `2>/dev/null` redirect is also a bash-ism. The whole call throws, the catch block runs `process.exit(0)`, and the server dies permanently.

### Fix — Restart logic

Replace the restart block with platform detection:

```ts
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'  // already imported as readFileSync — extend
import { tmpdir } from 'node:os'

// After pnpm build succeeds:
if (process.platform === 'win32') {
  // Write a detached .cmd that waits 2s then re-launches the server
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
  // Linux/Mac — existing systemd path
  try {
    execSync('systemctl restart Coastal.AI-server', { timeout: 10_000 })
  } catch {
    process.exit(0)
  }
}
```

### Fix — Update check hardening

`GET /api/admin/update-check` calls `git ls-remote origin HEAD`. On Windows, if git credentials aren't cached, this can hang waiting for an interactive prompt.

Add `GIT_TERMINAL_PROMPT: '0'` to the env to prevent interactive prompts:

```ts
execSync('git ls-remote origin HEAD', {
  timeout: 10_000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
})
```

### New imports needed
- `spawn` from `node:child_process` (add to existing `execSync` import)
- `writeFileSync` from `node:fs` (add to existing `readFileSync` import)
- `tmpdir` from `node:os` (new import)

### Acceptance Criteria
- On Windows: after clicking Update, server pulls + builds, restarts within ~5s, UI reconnects
- On Linux: existing systemd behaviour unchanged
- `git ls-remote` doesn't hang on Windows with uncached credentials

---

## Section 3: Code Quality Pass

### Files
- `packages/web/src/pages/Chat.tsx` (multi-pane additions)
- `packages/web/src/components/ChatPane.tsx`
- `packages/core/src/api/routes/system.ts`

### Checklist
- [ ] `LAYOUT_ICONS` map removed (dead after Section 1)
- [ ] No `console.log` debug artifacts in `ChatPane.tsx`
- [ ] `compact` prop consistently applied in `ChatPane.tsx` (font-size + padding)
- [ ] Add comment on `display: paneCount > 1 ? 'none' : 'flex'` explaining why `none` avoids remount
- [ ] TypeScript: all props and return types explicit in `LayoutIcon`, `ChatPane`
- [ ] `system.ts` imports clean and complete after adding `spawn`, `writeFileSync`, `tmpdir`
- [ ] No stray TODOs or incomplete branches

---

## Implementation Order

1. **Section 1** — layout toggle (UI only, zero risk)
2. **Section 2** — Windows update fix (`system.ts`)
3. **Section 3** — quality pass across all three files
4. Build + verify: `pnpm --filter @coastal-claw/core build && pnpm --filter web build`

---

## Out of Scope

- Changing the dropdown grid layout or pane count options
- Changing the Linux/Mac update flow
- Any other pages or packages
