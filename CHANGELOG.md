# Changelog

All notable changes to Coastal.AI are documented here.

## [1.5.0] — 2026-05-04

### The Self-Healing Release

Coastal.AI now includes an autonomous Architect that takes work items, writes plans, runs against your real models, opens PRs, and shows its work.

### Added

**Architect Daemon**
- Queue-driven autonomous improvement system with 3-phase poll loop
- Planning stage: LLM-generated plans with `<plan>/<diff>` parsing, locked-path enforcement, budget checks
- Building stage: sequential lint/typecheck/build/test gates scoped to touched packages
- PR creation: `gh pr create` with generated body, trailers, draft mode for full-approval policy
- PR review polling: daemon monitors open PRs, transitions on merge/close
- Auto-merge for `approval_policy=none` via `gh pr merge --squash --auto`
- Time-Travel snapshots: shadow-git repo captures workspace state before builds, restorable to recovery branches
- Curriculum mode: idle-time self-improvement that harvests codebase signals (stale TODOs, churn hotspots) and proposes low-priority work items
- 30-day suppression for rejected curriculum proposals
- Event log (`architect_events` table) for SSE streaming to web UI
- HMAC-signed callback tokens for one-tap approval from notification channels
- Model router adapter: bridges existing ModelRouter to architect's tier-aware interface

**REST API (12 endpoints)**
- `GET/POST /api/admin/architect/work-items` — CRUD with status filters
- `PATCH /api/admin/architect/work-items/:id` — pause/resume/priority changes
- `GET /api/admin/architect/activity` — cycle timeline with stage/time filters
- `GET /api/admin/architect/cycles/:id` — full cycle detail
- `POST /api/admin/architect/cycles/:id/approval` — approve/revise/reject
- `GET/POST /api/admin/architect/power` — on/off control
- `POST /api/admin/architect/mode` — hands-on/hands-off/autopilot/custom
- `POST /api/admin/architect/run-now` — trigger immediate tick
- `GET /api/admin/architect/insights` — aggregate stats (success rate, iterations, time saved)
- `GET /api/admin/architect/receipts` — merged PRs with attribution
- `POST/GET /api/admin/architect/callbacks/:token` — HMAC callback resolution
- `GET /api/admin/architect/events` — SSE event stream

**CLI**
- `coastal-ai architect on|off` — power control
- `coastal-ai architect status` — plain-English summary
- `coastal-ai architect mode <hands-on|hands-off|autopilot>` — mode switch
- `coastal-ai architect ask "description"` — create work item
- `coastal-ai architect queue` — list missions
- `coastal-ai architect approve|reject|revise <id>` — gate decisions
- `coastal-ai architect last` — recent activity
- `coastal-ai architect digest` — 24h summary

**Web Dashboard**
- Architect page with status card ("What's happening right now")
- Missions tab: work item list with create/pause/resume/cancel
- Activity tab: cycle timeline with inline expansion, filter chips, plan/test/PR detail
- Approval flow: approve/revise/reject buttons with comment input
- Insights tab: 6 stat tiles (success rate, avg iterations, time saved, queue depth, errors, top failure)
- Receipts tab: merged PR list with attribution metadata
- Settings tab: power toggle, mode selector (3 tiles), Run Now button

**Infrastructure**
- `architect_events` table for event streaming
- `snapshots` table for Time-Travel metadata
- `curriculum_suppressions` table for proposal dedup
- `CycleStore.listByStage()`, `.listRecent()`, `.recordApproval()`, `.getInsights()`, `.listMergedWithPR()`
- `WorkItemStore.listByStatus()`, `.listAll()`, `.countByStatus()`
- `Patcher.pushBranch()`, `.branchExistsOnRemote()`
- Output Channel notifications via existing ChannelManager (Telegram, Discord, Slack, Zapier)
- Daily digest timer in daemon

### Architecture

The architect is structured as a set of pure functions (planning, building, PR creation, PR review) wired into a daemon via dependency injection. All I/O is injected as closures, making every stage independently testable without filesystem, network, or LLM calls. The stage runner orchestrates plan-build-PR with a revise loop (exponential cooldown, budget exhaustion), and the daemon adds PR polling and curriculum scanning on top.

---

## [1.0.0] — 2026-04-15

Initial release of Coastal.AI.
