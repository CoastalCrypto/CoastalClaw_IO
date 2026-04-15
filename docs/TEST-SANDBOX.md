# Sandbox Testing Guide

## Overview

Coastal.AI sandbox testing allows you to spin up **ephemeral, isolated test environments** on your local machine or in CI/CD pipelines. Each sandbox is a fresh Docker container with clean state — no accumulated bugs, no leftover data from previous tests.

## Prerequisites

- **Docker Desktop** installed (Windows, Mac) or Docker Engine (Linux)
  - [Download Docker Desktop](https://docker.com)
- **Node.js 22+** installed
- Project dependencies installed: `pnpm install`

## Quick Start

### Start a Sandbox

**Using npm:**
```bash
npm run test:sandbox:start
```

**Using PowerShell (Windows):**
```powershell
.\scripts\test-sandbox.ps1 start
```

**Using Bash (Mac/Linux):**
```bash
./scripts/test-sandbox.sh start
```

The sandbox will start and output:
```
🚀 Starting Coastal.AI sandbox (sandbox-2026-04-14-143022)...
📁 Results will be saved to: ./test-artifacts/sandbox-2026-04-14-143022
🔌 Web UI will run on: http://localhost:5174
```

**Access the sandbox:**
- Web UI: http://localhost:5174
- Core API: http://localhost:5174/api (same port, different service)

### Run Your Tests

Interact with the sandbox normally:
1. Open http://localhost:5174 in your browser
2. Log in with default credentials (admin/admin)
3. Run your tests, verify behavior
4. Check console/logs for errors

### Stop the Sandbox

**Using npm:**
```bash
npm run test:sandbox:stop
```

**Using PowerShell/Bash:**
```powershell
.\scripts\test-sandbox.ps1 stop
```
or
```bash
./scripts/test-sandbox.sh stop
```

The sandbox stops, logs are preserved in `./test-artifacts/sandbox-{TIMESTAMP}/`.

### View Logs

**Using npm:**
```bash
npm run test:sandbox:logs
```

**Or directly:**
```bash
cat ./test-artifacts/sandbox-*/core.log
```

### Clean Up All Test Artifacts

**Using npm:**
```bash
npm run test:sandbox:clean
```

This removes all test results and logs. **Warning: This is permanent.**

## Sandbox Lifecycle

```
Start (npm run test:sandbox:start)
  ↓
Docker spins up container
  ↓
Core API starts on :5173
Web UI starts on :5173
  ↓
Logs written to ./test-artifacts/sandbox-{TIMESTAMP}/
  ↓
You interact with sandbox at http://localhost:5174
  ↓
Stop (npm run test:sandbox:stop)
  ↓
Container removed, logs preserved
  ↓
Results available for inspection in test-artifacts/
```

## Test Artifacts Structure

After running a sandbox, you'll find results here:

```
test-artifacts/
  sandbox-2026-04-14-143022/
    core.log         ← Core API logs
    web.log          ← Web UI logs
    status.log       ← Startup status
  sandbox-2026-04-14-143045/
    core.log
    web.log
    status.log
```

Each sandbox run is timestamped and self-contained.

## Troubleshooting

### "Docker not found"

Install Docker Desktop from https://docker.com and ensure it's running.

### "Port 5174 already in use"

The CLI automatically uses the next available port (5175, 5176, etc.). Check the console output for the actual port.

### "Sandbox won't start"

Check logs:
```bash
npm run test:sandbox:logs
```

Common issues:
- Docker Desktop not running
- Insufficient disk space
- Ollama service not available (optional, non-blocking)

### "Can't connect to Ollama"

By default, the sandbox tries to reach Ollama at `http://host.docker.internal:11434` (Windows/Mac).

On Linux, use:
```bash
CC_OLLAMA_URL=http://172.17.0.1:11434 npm run test:sandbox:start
```

Or disable Ollama by not setting it.

## Advanced Usage

### Running Multiple Sandboxes in Parallel

Each sandbox gets a unique ID and port. You can run multiple tests simultaneously:

```bash
npm run test:sandbox:start &
npm run test:sandbox:start &
npm run test:sandbox:start &
```

Each runs on a different port (5174, 5175, 5176, etc.) with isolated data.

### Custom Configuration

Set environment variables before starting:

```bash
CC_DATA_DIR=/tmp/coastal-test npm run test:sandbox:start
CC_TRUST_LEVEL=autonomous npm run test:sandbox:start
CC_DEFAULT_MODEL=llama3.2:1b npm run test:sandbox:start
```

All standard `CC_*` env vars work in the sandbox.

### Keeping Logs for CI/CD

In CI/CD pipelines, logs are automatically saved to `test-artifacts/` and can be attached as build artifacts:

```yaml
# GitHub Actions example
- name: Upload sandbox logs
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: sandbox-logs
    path: test-artifacts/
```

## When to Use Sandbox Testing

✅ **Use sandbox when:**
- Testing new features in isolation
- Reproducing bugs in a clean environment
- Integration testing multiple features
- Testing upgrade scenarios
- CI/CD validation

✅ **Don't use sandbox when:**
- Testing local filesystem access (mount a volume instead)
- Running long-lived services (use main installation)
- Performance profiling (containers add overhead)

## See Also

- [CI/CD Integration Guide](./CI-CD-SANDBOX.md)
- [Architecture Documentation](../ARCHITECTURE.md)
- [Trust Levels Documentation](../README.md#-sandbox-mode)
