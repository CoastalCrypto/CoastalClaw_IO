# Coastal.AI Rebrand Design

**Goal:** Rename every user-visible and package-level reference from CoastalClaw to Coastal.AI across the codebase and GitHub.

**Architecture:** Mechanical find-and-replace across package.json files, source string literals, HTML, docs, and install scripts, followed by a GitHub repo rename. Historical plan/spec docs and the local directory name are left untouched.

**Tech Stack:** pnpm, TypeScript, gh CLI

---

## Change Map

| Layer | From | To |
|-------|------|----|
| Root `package.json` name | `coastal-claw` | `coastal-ai` |
| `packages/core/package.json` name | `@coastal-claw/core` | `@coastal-ai/core` |
| `packages/daemon/package.json` | any `coastal-claw` refs | `coastal-ai` |
| `packages/shell/package.json` | any `coastal-claw` refs | `coastal-ai` |
| `packages/architect/package.json` | any `coastal-claw` refs | `coastal-ai` |
| `packages/video/package.json` | any `coastal-claw` refs | `coastal-ai` |
| Source string literals (NavBar, Onboarding, System, ErrorBoundary, config, channels, skills) | `"CoastalClaw"` / `"Coastal Claw"` | `"Coastal.AI"` |
| `packages/web/index.html` `<title>` | `CoastalClaw` | `Coastal.AI` |
| `packages/core/src/config.ts` | app name constant | `Coastal.AI` |
| Install scripts (`install.sh`, `install.ps1`) | display name + paths | `Coastal.AI` / `coastal-ai` |
| `docs/site/*` active docs | throughout | `Coastal.AI` |
| `README.md` | full rebrand | `Coastal.AI` |
| GitHub repo | `CoastalCrypto/CoastalClaw_IO` | `CoastalCrypto/Coastal.AI` |

## Out of Scope

- Local directory name `coastal-claw/` — no rename (avoids git worktree issues)
- `docs/superpowers/plans/` and `docs/superpowers/specs/` — frozen historical records
- HANDOFF, CONTRIBUTING, PHASE3-HANDOFF — internal historical docs
- `dist/` build output — regenerated on next build
- `pnpm-lock.yaml` — regenerated after `pnpm install`

## Execution Order

1. Update all `package.json` files
2. Update source string literals in TypeScript/TSX files
3. Update HTML files (`index.html`)
4. Update `docs/site/*` markdown files
5. Update `README.md`
6. Update install scripts
7. Run `pnpm install` to regenerate lockfile
8. Run `npx tsc --noEmit` to verify no type errors
9. Commit
10. `gh repo rename Coastal.AI --yes`
