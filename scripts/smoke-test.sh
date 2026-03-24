#!/usr/bin/env bash
set -e

BASE="http://127.0.0.1:4747"
echo "=== Coastal Claw Phase 1 Smoke Test ==="

# Health
echo -n "[ ] GET /health ... "
HEALTH=$(curl -sf "$BASE/health")
echo "$HEALTH" | grep -q '"status":"ok"' && echo "✓" || (echo "✗ FAIL"; exit 1)

# Chat
echo -n "[ ] POST /api/chat ... "
CHAT=$(curl -sf -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","sessionId":"smoke-test"}')
echo "$CHAT" | grep -q '"reply"' && echo "✓" || (echo "✗ FAIL"; exit 1)

echo ""
echo "=== All checks passed ==="
