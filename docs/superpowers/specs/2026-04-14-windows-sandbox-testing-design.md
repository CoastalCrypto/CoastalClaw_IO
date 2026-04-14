# Windows Sandbox Testing Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable ephemeral, isolated test environments on Windows (and all platforms) using Docker Compose, allowing developers to spin up fresh Coastal.AI instances, test them, and tear them down without accumulating bugs from old installations.

**Architecture:** Docker Compose orchestrates ephemeral containers with mounted result volumes. Each test run is a clean environment; logs/artifacts persist on the host for post-test inspection.

**Tech Stack:** Docker, Docker Compose, Node.js/npm scripts, PowerShell/Bash wrapper scripts

---

## Problem Statement

During live testing on Windows, developers must constantly update old installations that accumulate bugs and state from previous changes. Each iteration requires cleanup and recovery, slowing down testing cycles. Solution: Disposable, containerized test environments with clean state on every run.

---

## Design Decisions

### 1. Why Docker Compose?

**Option considered:** Custom npm/Docker CLI scripts
- Docker Compose is industry standard for test orchestration
- Single source of truth in `docker-compose.test.yml`
- Works identically on Windows, Mac, Linux
- CI/CD pipelines natively support it (GitHub Actions, GitLab CI, etc.)
- Volume mounting and environment variable injection are declarative and clear
- Easy to extend later (add more services: Ollama, databases, etc.)

**Trade-off:** Requires Docker Desktop (already common for Windows developers)

### 2. Sandbox Lifecycle

Each sandbox instance is **ephemeral by design**:
- **Spin-up:** Fresh container, clean `/app/data` (isolated state)
- **Run:** Logs written to mounted `/results` volume (host's `./test-artifacts/`)
- **Tear-down:** Container removed, data deleted, results preserved for inspection

This solves the core problem: no leftover bugs, no accumulated state, clean slate for next test.

### 3. Isolation Strategy

- **Container filesystem:** Clean, isolated per-instance
- **Results volume:** Mounted from host at `./test-artifacts/sandbox-{TIMESTAMP}/`
- **Port mapping:** Sandbox runs on `localhost:5174` (not default 5173) to avoid conflicts with main install
- **Network:** Isolated from other containers; can run parallel sandboxes without collision

### 4. Cross-Platform Support

Single `docker-compose.test.yml` works on:
- Windows (Docker Desktop) ✓
- macOS (Docker Desktop) ✓
- Linux (Docker Engine) ✓
- CI/CD pipelines (any platform with Docker) ✓

Wrapper scripts (`test-sandbox.ps1` for Windows, `test-sandbox.sh` for Unix) provide user-friendly CLI.

---

## File Structure

### New Files

```
docker-compose.test.yml              # Docker Compose definition for sandbox
packages/core/Dockerfile.test        # Lightweight test image
scripts/test-sandbox.ps1             # Windows wrapper script
scripts/test-sandbox.sh              # Unix wrapper script (Mac/Linux)
docs/TEST-SANDBOX.md                 # Testing guide
```

### Modified Files

```
package.json                         # Add npm test:sandbox:* scripts
README.md                            # Reference sandbox testing
```

---

## User Interface

### Local Development (Windows)

```powershell
# Start a fresh sandbox
pnpm test:sandbox:start

# ✓ Sandbox running at http://127.0.0.1:5174
# ✓ Logs streaming to ./test-artifacts/sandbox-{TIMESTAMP}/

# Run your tests, interact with the app, verify behavior
# ...

# Stop and clean sandbox
pnpm test:sandbox:stop

# View results (logs persisted)
Get-Content ./test-artifacts/sandbox-*/core.log
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Run sandbox tests
  run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit

- name: Capture results
  if: always()
  run: |
    mkdir -p test-results
    cp -r test-artifacts/* test-results/
```

---

## Docker Compose Configuration

The `docker-compose.test.yml` will:

1. **Define sandbox service** with:
   - Base image: Node.js 22 (same as production)
   - Build context: Copy Coastal.AI code into `/app`
   - Environment variables: Port (5174), data directory, Ollama URL
   - Volumes: Mount `./test-artifacts/sandbox-{TIMESTAMP}/` to `/results`
   - Command: Build and start Core API + Web UI
   - Logging: Write to `/results/sandbox.log`

2. **Define volumes** for persistent test artifacts

3. **Support scaling** (can define multiple sandbox instances for parallel testing)

---

## Sandbox Image (`Dockerfile.test`)

Lightweight image (~200MB) with:
- Node.js 22 runtime
- Pre-built Coastal.AI code (from `pnpm build`)
- Ollama client configured
- Clean `/app/data` directory
- Entrypoint script that:
  - Creates `/results` if not present
  - Starts Core API, redirects logs to `/results/core.log`
  - Starts Web UI, redirects logs to `/results/web.log`
  - Waits for both services

---

## Test Artifacts Directory

After each run, `./test-artifacts/` contains:

```
test-artifacts/
  sandbox-2026-04-14-143022/
    core.log           # Core API logs
    web.log            # Web UI logs
    sandbox.log        # Docker compose output
  sandbox-2026-04-14-143045/
    ...
```

Developer can:
- Inspect logs to debug test failures
- Keep results for audit trail
- Delete manually or via `pnpm test:sandbox:clean`

---

## Commands

### npm Scripts (in `package.json`)

```json
{
  "scripts": {
    "test:sandbox:start": "node scripts/sandbox-cli.js start",
    "test:sandbox:stop": "node scripts/sandbox-cli.js stop",
    "test:sandbox:clean": "node scripts/sandbox-cli.js clean",
    "test:sandbox:logs": "node scripts/sandbox-cli.js logs",
    "test:sandbox:status": "node scripts/sandbox-cli.js status"
  }
}
```

### Wrapper Script Responsibilities (`sandbox-cli.js`)

- **start:** Run `docker-compose up` with timestamped volume, echo URLs
- **stop:** Run `docker-compose down`, preserve logs
- **clean:** Remove all test-artifacts/ (optional, with confirmation)
- **logs:** Display logs from latest sandbox
- **status:** Show running sandbox containers

---

## Error Handling

**If Docker not installed:**
- `pnpm test:sandbox:start` fails with clear message: "Docker Desktop required. Install from https://docker.com"

**If port 5174 in use:**
- Compose uses next available port (5175, 5176, etc.), logs actual URL

**If build fails:**
- Compose output shown in terminal, developer can debug

**If Ollama not available to sandbox:**
- Graceful fallback or error message (depends on test requirements)

---

## Testing Strategy

1. **Unit tests:** Verify sandbox CLI scripts work (start/stop/clean)
2. **Integration tests:** Spin up sandbox, verify it responds at expected URL
3. **CI/CD tests:** Run in GitHub Actions to verify Docker Compose flow

---

## Future Extensions

This design enables:
- **Parallel testing:** Run multiple sandboxes simultaneously for load testing
- **Version matrix:** Test multiple Coastal.AI versions in parallel
- **Services layer:** Add Ollama, databases, etc. to compose file for full E2E testing
- **Snapshot testing:** Save/compare sandbox states across versions

---

## Success Criteria

✓ Sandbox starts cleanly in <30 seconds
✓ Each run has isolated state (no leftover bugs)
✓ Logs/results persist for inspection
✓ Works identically on Windows, Mac, Linux
✓ CI/CD integration is straightforward
✓ Developer can test multiple sandbox instances in parallel without conflict

