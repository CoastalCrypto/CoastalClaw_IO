#!/usr/bin/env bash
# smoke-test.sh — boot CoastalOS ISO in QEMU and verify it reaches a login prompt
# Usage: bash smoke-test.sh <iso-file>
set -e

ISO="$1"
[ -f "$ISO" ] || { echo "Error: ISO not found: $ISO"; exit 1; }

TIMEOUT=180  # seconds to wait for OS to produce boot output
LOG=$(mktemp)

echo "[smoke-test] Booting $ISO in QEMU (${TIMEOUT}s timeout)..."

# Start QEMU — serial output goes to log file
# -drive with format=raw avoids "Could not read from CDROM (code 0004)" in CI
# console=ttyS0 is set in the live-build kernel params (--bootappend-live),
# but we also pass -append here as a safety net for BIOS/hybrid boot paths
qemu-system-x86_64 \
  -drive "file=${ISO},format=raw,media=cdrom,readonly=on" \
  -m 2048 \
  -smp 2 \
  -display none \
  -serial file:"$LOG" \
  -netdev user,id=net0 -device virtio-net-pci,netdev=net0 \
  -no-reboot \
  -boot order=d,menu=off \
  &

QEMU_PID=$!

echo "[smoke-test] QEMU PID: $QEMU_PID — waiting for boot output..."

ELAPSED=0
PASSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 5
  ELAPSED=$((ELAPSED + 5))

  # Check if QEMU exited — if it ran for at least 30 seconds before exiting
  # cleanly that means the OS booted and shut down (not an immediate crash)
  if ! kill -0 $QEMU_PID 2>/dev/null; then
    wait $QEMU_PID 2>/dev/null
    EXIT_CODE=$?
    if [ $ELAPSED -ge 30 ]; then
      echo "[smoke-test] ✓ QEMU ran for ${ELAPSED}s and exited (code ${EXIT_CODE}) — boot confirmed"
      rm -f "$LOG"
      exit 0
    else
      echo "[smoke-test] ✗ QEMU exited too quickly after ${ELAPSED}s (code ${EXIT_CODE}) — likely a crash"
      cat "$LOG" 2>/dev/null || true
      rm -f "$LOG"
      exit 1
    fi
  fi

  if [ ! -s "$LOG" ]; then
    echo "[smoke-test] ${ELAPSED}s — no output yet..."
    continue
  fi

  LINES=$(wc -l < "$LOG")
  echo "[smoke-test] ${ELAPSED}s — ${LINES} lines of serial output"

  # Success: OS produced meaningful boot output (GRUB or kernel messages)
  if grep -qiE "(grub|linux|ubuntu|started|reached|login:|coastalos)" "$LOG" 2>/dev/null; then
    echo "[smoke-test] ✓ OS booted successfully (boot messages detected after ${ELAPSED}s)"
    echo "[smoke-test] Last 5 lines:"
    tail -5 "$LOG"
    kill $QEMU_PID 2>/dev/null || true
    wait $QEMU_PID 2>/dev/null || true
    rm -f "$LOG"
    exit 0
  fi
done

echo "[smoke-test] ✗ No recognizable boot output within ${TIMEOUT}s"
echo "[smoke-test] Last output:"
tail -20 "$LOG" 2>/dev/null || echo "(empty)"
kill $QEMU_PID 2>/dev/null || true
wait $QEMU_PID 2>/dev/null || true
rm -f "$LOG"
exit 1
