# Security, Bugs, Consent Gate & Sandbox Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all security issues, bugs, and add cloud-call consent gate + optional sandbox across the Coastal.AI monorepo.

**Architecture:** Targeted fixes across core routes, config, memory, installer, and web. No structural refactors — smallest safe change at each site. Auth extensions use the existing `validateSessionToken`/`verifySessionToken` infrastructure already in `server.ts`.

**Tech Stack:** TypeScript, Fastify, React, better-sqlite3, pnpm/turbo

---

## Chunk 1: Installer + README

### Task 1: Fix install.ps1 step 8 rebrand

**Files:**
- Modify: `install.ps1:148`

- [ ] Fix "Launching Coastal Claw" → "Launching Coastal.AI"
- [ ] Commit: `fix(install): rebrand step 8 from CoastalClaw to Coastal.AI`

### Task 2: README — local data + sandbox + cloud consent sections

**Files:**
- Modify: `README.md` (after the Features table)

- [ ] Add `## 🔒 Privacy & Data` section explaining: all inference local, no telemetry, what Mem0 is and that it's opt-in cloud, how to enable it
- [ ] Add `## 🛡 Sandbox Mode` section explaining trust levels, default (trusted), when to enable sandboxed
- [ ] Commit: `docs: add privacy, sandbox and cloud-consent sections to README`

---

## Chunk 2: Config & Sandbox Default

### Task 3: Change default trust level to `trusted`

**Files:**
- Modify: `packages/core/src/config.ts:77`

- [ ] Change `'sandboxed'` default → `'trusted'`
- [ ] Add `cloudConsentGranted` boolean field to `Config` (reads from `data/.cloud-consent` file)
- [ ] Commit: `feat(config): default trust level to trusted; add cloudConsentGranted flag`

---

## Chunk 3: Security Fixes

### Task 4: Fix model name regex — block path traversal

**Files:**
- Modify: `packages/core/src/api/routes/admin.ts:202`

- [ ] Change regex from `/^[a-zA-Z0-9_.:/-]+$/` to `/^[a-zA-Z0-9_.:-]+(?:\/[a-zA-Z0-9_.:-]+)*$/` (blocks `..` sequences)
- [ ] Commit: `fix(security): block path traversal in model name validation`

### Task 5: Validate sessionId in WebSocket session handler

**Files:**
- Modify: `packages/core/src/api/ws/session.ts:11`

- [ ] Add format validation: sessionId must match `/^[a-zA-Z0-9_-]{8,128}$/`
- [ ] Commit: `fix(security): validate sessionId format in WS session handler`

### Task 6: Add auth to `/ws/agent-events`

**Files:**
- Modify: `packages/core/src/api/routes/agent-events.ts`

- [ ] Read `x-admin-session` from upgrade request headers; reject connection with 401 if invalid
- [ ] Pass `adminToken` + `userStore` or `validateSessionToken` fn into `agentEventsRoute` opts
- [ ] Update `server.ts` to pass auth deps to `agentEventsRoute`
- [ ] Commit: `fix(security): require auth on /ws/agent-events WebSocket endpoint`

### Task 7: Auth on `/api/chat`, `/api/chat/stream`, `/api/upload` when network-exposed

**Files:**
- Modify: `packages/core/src/server.ts:64`

- [ ] Extend the `onRequest` auth hook: if `config.host !== '127.0.0.1'` and `config.host !== '::1'`, also enforce auth for `/api/chat`, `/api/chat/stream`, `/api/upload`
- [ ] Commit: `fix(security): require auth on chat/upload routes when server is network-exposed`

---

## Chunk 4: Bug Fixes

### Task 8: Fix hardcoded 127.0.0.1 in internal fetches

**Files:**
- Modify: `packages/core/src/api/routes/chat.ts:129`
- Modify: `packages/core/src/api/routes/stream.ts:100`
- Modify: `packages/core/src/server.ts:146`

- [ ] Replace `http://127.0.0.1:${config.port}` with `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${config.port}` in all three files
- [ ] Commit: `fix(core): replace hardcoded 127.0.0.1 with config.host in internal fetches`

### Task 9: Guard MAX_TURNS and MAX_RESULT_CHARS against NaN

**Files:**
- Modify: `packages/core/src/agents/loop.ts:13-14`

- [ ] Add `|| 10` fallback: `const MAX_TURNS = () => { const n = Number(process.env.CC_AGENT_MAX_TURNS ?? 10); return isNaN(n) || n < 1 ? 10 : n }`
- [ ] Same for `MAX_RESULT_CHARS` → fallback 4000
- [ ] Commit: `fix(core): guard CC_AGENT_MAX_TURNS and CC_TOOL_RESULT_MAX_CHARS against NaN`

### Task 10: Await pipeline store operations

**Files:**
- Modify: `packages/core/src/pipeline/runner.ts:54,141,146`

- [ ] Await `this.store?.createRun(...)` and `this.store?.finalizeRun(...)` calls
- [ ] Commit: `fix(pipeline): await store operations to ensure run history persists`

### Task 11: Fix predictive suggestion broadcast (don't send to unauthenticated clients)

**Files:**
- Modify: `packages/core/src/api/routes/chat.ts:144`

- [ ] Change `client._sessionId === sessionId || !client._sessionId` → `client._sessionId === sessionId`
- [ ] Commit: `fix(security): restrict predictive suggestion broadcast to session owner`

### Task 12: Fix DomainAssigner test act() warning

**Files:**
- Modify: `packages/web/src/components/DomainAssigner.test.tsx:29`

- [ ] Wrap `fireEvent.change` in `act()`
- [ ] Commit: `fix(test): wrap DomainAssigner fireEvent in act() to suppress React warning`

---

## Chunk 5: Cloud Consent Gate

### Task 13: Add consent check to UnifiedMemory

**Files:**
- Modify: `packages/core/src/memory/index.ts`
- Modify: `packages/core/src/config.ts`

- [ ] Add `cloudConsentGranted: boolean` to `UnifiedMemoryConfig`
- [ ] In constructor: only create `Mem0Adapter` when `mem0ApiKey` AND `cloudConsentGranted` are both true
- [ ] If `mem0ApiKey` set but no consent: log `[memory] Mem0 disabled — cloud consent not granted. Enable in Settings → Cloud Features`
- [ ] Commit: `feat(memory): gate Mem0 cloud calls behind explicit user consent`

### Task 14: Cloud consent API endpoint

**Files:**
- Modify: `packages/core/src/api/routes/admin.ts` (add GET/POST `/api/admin/cloud-consent`)

- [ ] GET: returns `{ mem0Enabled: boolean, consentGrantedAt: number | null }`
- [ ] POST: writes consent grant/revoke to `data/.cloud-consent` file
- [ ] Commit: `feat(api): add cloud consent GET/POST endpoint`

### Task 15: Cloud consent UI toggle

**Files:**
- Create: `packages/web/src/components/CloudConsent.tsx`
- Modify: existing Settings/Models page to include it

- [ ] Show warning banner: "⚠ Mem0 API key detected. Enabling sends conversation summaries to Mem0's cloud."
- [ ] Toggle to enable/disable with confirmation dialog
- [ ] Commit: `feat(web): add cloud consent toggle to settings`

---

## Chunk 6: Verify

- [ ] Run `pnpm --filter core exec tsc --noEmit` — expect zero errors
- [ ] Run `pnpm --filter web exec tsc --noEmit` — expect zero errors
- [ ] Run `pnpm test` — expect all tests pass, no act() warnings
- [ ] Commit: `chore: verify all fixes compile and tests pass`
