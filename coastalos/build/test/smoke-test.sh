#!/usr/bin/env bash
# smoke-test.sh — boot CoastalOS ISO in QEMU and verify coastal-server starts
# Usage: bash smoke-test.sh <iso-file>
set -e

ISO="$1"
[ -f "$ISO" ] || { echo "Error: ISO not found: $ISO"; exit 1; }

TIMEOUT=120  # seconds to wait for server health check

echo "[smoke-test] Booting $ISO in QEMU..."

# Start QEMU with serial console (no display needed in CI)
qemu-system-x86_64 \
  -cdrom "$ISO" \
  -m 2048 \
  -smp 2 \
  -nographic \
  -serial mon:stdio \
  -net nic \
  -net user,hostfwd=tcp::14747-:4747 \
  -no-reboot \
  -boot d \
  &

QEMU_PID=$!

echo "[smoke-test] Waiting up to ${TIMEOUT}s for coastal-server on :14747..."

ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if curl -sf http://localhost:14747/health > /dev/null 2>&1; then
    echo "[smoke-test] ✓ coastal-server is healthy after ${ELAPSED}s"
    kill $QEMU_PID 2>/dev/null || true
    exit 0
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done

echo "[smoke-test] ✗ coastal-server did not respond within ${TIMEOUT}s"
kill $QEMU_PID 2>/dev/null || true
exit 1
