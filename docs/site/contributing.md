---
title: Contributing
description: How to contribute to Coastal Claw.
---

# Contributing

Coastal Claw is open source and welcomes contributions. Whether you're fixing a bug, adding a feature, or improving documentation — we appreciate it.

## Development setup

```bash
git clone https://github.com/CoastalCrypto/CoastalClaw_IO.git
cd CoastalClaw_IO
pnpm install
pnpm build
pnpm test
```

All 77 tests should pass before you start.

## Project structure

```
packages/core/   — Fastify API, routing, memory, model management (TypeScript/ESM)
packages/web/    — React + Vite + Tailwind v4 web portal
docs/site/       — Documentation (Mintlify Markdown)
assets/          — Logo, banner
install.sh       — One-line installer
```

## Coding standards

- **TypeScript/ESM throughout** — no CommonJS, no `require()`
- **Node.js 22+** — use native APIs where possible
- **Fastify JSON Schema** on all endpoints — validate inputs, never trust them
- **TDD** — write the failing test first
- **No secrets in code** — use env vars, never hardcode tokens or URLs

## Running tests

```bash
# All tests
pnpm test

# Core only
cd packages/core && pnpm test

# Web only
cd packages/web && pnpm test

# Watch mode
pnpm test -- --watch
```

## Submitting a pull request

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. Make your changes with tests
3. Ensure `pnpm test` passes with no failures
4. Push and open a PR against `master`
5. Describe what you built and why in the PR description

## Reporting issues

Use [GitHub Issues](https://github.com/CoastalCrypto/CoastalClaw_IO/issues). Include:

- Your OS and Node.js version
- The command you ran
- The full error output
- Contents of `/tmp/coastal-claw-core.log` if relevant

## Roadmap contributions

Check the [roadmap section in the README](https://github.com/CoastalCrypto/CoastalClaw_IO#-roadmap) for planned features. Items marked **Phase 2** or **Phase 3** are great starting points for larger contributions.

## Acknowledgements

Thank you to the open-source projects that made Coastal Claw possible — see [Introduction → Open-source foundations](/introduction#open-source-foundations) for the full list.
