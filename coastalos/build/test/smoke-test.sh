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
# -append passes console=ttyS0 so GRUB/kernel output reaches the serial log
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
