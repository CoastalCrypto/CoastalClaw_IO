# Sandbox Testing in CI/CD

This guide shows how to integrate Coastal.AI sandbox testing into your CI/CD pipelines.

## GitHub Actions

### Basic Sandbox Test

```yaml
name: Sandbox Tests

on: [push, pull_request]

jobs:
  sandbox-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Install dependencies
        run: pnpm install

      - name: Build project
        run: pnpm build

      - name: Start sandbox
        run: npm run test:sandbox:start &

      - name: Wait for sandbox readiness
        run: |
          for i in {1..30}; do
            if curl -s http://localhost:5174/api/version > /dev/null; then
              echo "Sandbox ready!"
              exit 0
            fi
            sleep 2
          done
          echo "Sandbox failed to start"
          exit 1

      - name: Run tests
        run: |
          # Your test commands here
          curl http://localhost:5174/api/version
          echo "Test passed!"

      - name: Stop sandbox
        if: always()
        run: npm run test:sandbox:stop

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: sandbox-logs
          path: test-artifacts/
          retention-days: 7
```

### Parallel Test Matrix

Test multiple configurations in parallel:

```yaml
jobs:
  sandbox-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        trust-level: [trusted, sandboxed]
        model: [llama3.2, llama3.2:1b]

    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'

      - name: Install dependencies
        run: pnpm install

      - name: Start sandbox
        env:
          CC_TRUST_LEVEL: ${{ matrix.trust-level }}
          CC_DEFAULT_MODEL: ${{ matrix.model }}
        run: npm run test:sandbox:start &

      - name: Run tests
        run: npm run test

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: sandbox-results-${{ matrix.trust-level }}-${{ matrix.model }}
          path: test-artifacts/
```

## GitLab CI

```yaml
stages:
  - build
  - test

sandbox-test:
  stage: test
  image: docker:latest
  services:
    - docker:dind
  script:
    - apk add --no-cache node npm curl
    - npm install -g pnpm
    - pnpm install
    - pnpm build
    - npm run test:sandbox:start &
    - sleep 10  # Wait for startup
    - curl http://localhost:5174/api/version || exit 1
    - npm run test
    - npm run test:sandbox:stop
  artifacts:
    when: always
    paths:
      - test-artifacts/
    expire_in: 1 week
```

## Local Development

### Pre-commit Sandbox Test

Run a quick sandbox test before committing:

```bash
#!/bin/bash
# .git/hooks/pre-commit

npm run test:sandbox:start &
sleep 5

if ! curl -s http://localhost:5174/api/version > /dev/null; then
  npm run test:sandbox:stop
  echo "Sandbox health check failed"
  exit 1
fi

npm run test:sandbox:stop
exit 0
```

### Watch Mode with Sandbox

Test changes in real-time with a sandbox:

```bash
# Terminal 1: Start sandbox
npm run test:sandbox:start

# Terminal 2: Watch for changes and rebuild
pnpm watch

# Terminal 3: Run your test suite
npm test -- --watch
```

## Best Practices

### 1. Always Clean Up

Ensure sandboxes are stopped even if tests fail:

```yaml
finally:
  - npm run test:sandbox:stop
```

### 2. Collect Artifacts

Save logs for post-mortem analysis:

```yaml
- name: Collect sandbox logs
  if: always()
  run: |
    mkdir -p test-results
    cp -r test-artifacts/* test-results/ || true
```

### 3. Set Timeouts

Prevent hanging CI jobs:

```yaml
- name: Run sandbox tests
  timeout-minutes: 10
  run: npm run test
```

### 4. Health Checks

Verify sandbox is ready before running tests:

```bash
#!/bin/bash
RETRIES=30
until curl -s http://localhost:5174/api/version > /dev/null; do
  ((RETRIES--))
  if [ $RETRIES -eq 0 ]; then
    echo "Sandbox failed to become ready"
    exit 1
  fi
  sleep 1
done
```

### 5. Parallel Execution

Run multiple sandboxes for load testing:

```bash
for i in {1..5}; do
  npm run test:sandbox:start &
done
wait
```

## Environment Variables

Pass any `CC_*` env var to the sandbox:

```bash
# Custom Ollama URL
CC_OLLAMA_URL=http://localhost:11434 npm run test:sandbox:start

# Custom data directory
CC_DATA_DIR=/tmp/test-data npm run test:sandbox:start

# Custom trust level
CC_TRUST_LEVEL=sandboxed npm run test:sandbox:start

# All at once
CC_OLLAMA_URL=... CC_TRUST_LEVEL=sandboxed npm run test:sandbox:start
```

## Debugging Failed Sandboxes

If a sandbox fails in CI:

1. **Check logs:**
   ```bash
   npm run test:sandbox:logs
   ```

2. **Reproduce locally:**
   ```bash
   npm run test:sandbox:start
   npm run test:sandbox:logs
   ```

3. **Inspect container:**
   ```bash
   docker ps -a
   docker logs <container-id>
   ```

4. **Review artifacts:**
   Download and inspect `test-artifacts/` from CI run.

## See Also

- [Sandbox Testing Guide](./TEST-SANDBOX.md)
- [README](../README.md)
