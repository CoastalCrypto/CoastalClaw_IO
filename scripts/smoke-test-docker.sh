#!/usr/bin/env bash
# smoke-test-docker.sh — build + boot CoastalClaw in Docker, verify the server starts
# Usage: bash scripts/smoke-test-docker.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="coastalclaw-smoke:local"
CONTAINER="cc-smoke-$$"
PORT=14747   # host port (mapped to 4747 inside container)
TIMEOUT=60   # seconds to wait for /health

cleanup() {
  docker rm -f "$CONTAINER" 2>/dev/null || true
}
trap cleanup EXIT

echo "[smoke] Building image from $REPO_ROOT..."
docker build \
  -f "$REPO_ROOT/coastalos/build/test/Dockerfile.smoke" \
  -t "$IMAGE" \
  "$REPO_ROOT"

echo "[smoke] Starting container..."
docker run -d \
  --name "$CONTAINER" \
  -p "${PORT}:4747" \
  "$IMAGE"

echo "[smoke] Waiting up to ${TIMEOUT}s for /health on :${PORT}..."
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -sf "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
    echo "[smoke] ✓ /health responded after ${ELAPSED}s"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "[smoke] ✗ /health did not respond within ${TIMEOUT}s"
    echo "--- container logs ---"
    docker logs "$CONTAINER" 2>&1 | tail -40
    exit 1
  fi
done

BASE="http://127.0.0.1:${PORT}"

echo -n "[smoke] GET /health ... "
HEALTH=$(curl -sf "$BASE/health")
echo "$HEALTH" | grep -q '"status":"ok"' && echo "✓" || { echo "✗ FAIL: $HEALTH"; exit 1; }

echo -n "[smoke] POST /api/chat ... "
CHAT=$(curl -sf -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping","sessionId":"smoke-test"}')
echo "$CHAT" | grep -q '"reply"' && echo "✓" || { echo "✗ FAIL: $CHAT"; exit 1; }

echo -n "[smoke] GET /api/persona ... "
PERSONA=$(curl -sf "$BASE/api/persona")
echo "$PERSONA" | grep -q '"configured"' && echo "✓" || { echo "✗ FAIL: $PERSONA"; exit 1; }

echo ""
echo "[smoke] All checks passed."
