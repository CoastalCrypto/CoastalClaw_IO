# Handoff — Coastal.AI Session 5 (Hardening + UX Polish)

**Date:** 2026-05-05
**Repo:** `C:\Users\John\CoastalAI` -> `https://github.com/CoastalCrypto/Coastal.AI`
**Branch:** `master`
**Tag:** `v1.5.0` (released in session 4)

---

## Session 5 Summary (10 commits since v1.5.0)

### Performance
- **40% main bundle reduction** (1034KB -> 621KB): lazy-loaded all 12 non-Chat pages via React.lazy + Suspense
- Added `PageLoader` wrapper component for DRY loading fallback

### Security Hardening
- **Input validation**: clamped `limit` (max 500), `since` (non-negative), `range` (1-365), `comment` (max 2000 chars) across all architect API routes
- **SSE connection limit**: max 10 concurrent SSE connections with 429 response and proper cleanup on disconnect
- **Rate limiting**: added per-route rate limits on power (10/min), mode (10/min), run-now (5/min), approval (20/min), and callbacks (20/min)
- Security audit: verified HMAC + expiry validation in CallbackSigner is correct (agent false positive)

### Code Quality
- **Architect.tsx decomposed**: 669 -> 52 lines, 10 focused sub-components
- **7 `as any` casts removed**: proper FailureKind + ReviseContext types in stage-runner.ts and daemon.ts
- **DRY labels**: all 3 UI tabs now use shared architect-labels.ts utilities
- **Error boundary** wraps Architect page

### Features
- **SSE live updates**: ActivityTab, QueueTab, and StatusCard auto-refresh via useArchitectSSE hook
- **Relative timestamps**: "3 minutes ago" instead of raw dates in Activity and Receipts
- **Keyboard navigation**: press 1-5 to switch architect tabs (skipped when focus is in input fields)

### Tests
- **+14 new tests**: SSE endpoint (3), WorkItemStore (7), CycleStore (5, net +4 with fix)
- Core: **326 passed** (was 315)
- Architect: **~133 passed** (31 test files)
- All green, TSC clean, web build clean

---

## Cumulative State

| Metric | Value |
|--------|-------|
| HEAD | `c4fdec9` |
| Core tests | 326 passed, 7 skipped |
| Architect tests | ~133 passed (31 files) |
| Web main bundle | 621KB (was 1034KB) |
| Architect chunk | 22KB (lazy-loaded) |

### Remaining for Production
1. Manual smoke test with real Ollama model
2. Test callback URLs via Telegram/Discord
3. Chat.tsx decomposition (1364 lines — largest file, deferred to avoid regressions)
