#!/bin/bash
set -e

VERSION="${1:-dev}"
echo "[build] Building CoastalOS ${VERSION}..."

# Ensure live-build is installed
if ! command -v lb &> /dev/null; then
  echo "Error: live-build not installed. Run: sudo apt install live-build"
  exit 1
fi

# Capture absolute paths before any cd
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COASTALOS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

# Configure live-build
lb config \
  --distribution noble \
  --archive-areas "main restricted universe multiverse" \
  --bootloader grub-efi \
  --binary-images iso \
  --iso-application "CoastalOS" \
  --iso-volume "CoastalOS-${VERSION}" \
  --bootappend-live "boot=live console=ttyS0,115200n8 console=tty0"

# Add package list
cp "${SCRIPT_DIR}/packages.list" config/package-lists/coastalos.list.chroot

# Add post-install hook
mkdir -p config/hooks/live
cp "${SCRIPT_DIR}/hooks/post-install.sh" config/hooks/live/99-coastalos.hook.chroot
chmod +x config/hooks/live/99-coastalos.hook.chroot

# Add labwc config
mkdir -p config/includes.chroot/tmp/labwc
cp "${COASTALOS_DIR}/labwc/rc.xml"    config/includes.chroot/tmp/labwc/
cp "${COASTALOS_DIR}/labwc/autostart" config/includes.chroot/tmp/labwc/

# Add waybar config
mkdir -p config/includes.chroot/opt/coastalclaw/coastalos/waybar
cp "${COASTALOS_DIR}/waybar/config.jsonc" config/includes.chroot/opt/coastalclaw/coastalos/waybar/
cp "${COASTALOS_DIR}/waybar/style.css"    config/includes.chroot/opt/coastalclaw/coastalos/waybar/

# Add systemd units
mkdir -p config/includes.chroot/etc/systemd/system
cp "${COASTALOS_DIR}/systemd/"*.service config/includes.chroot/etc/systemd/system/
cp "${COASTALOS_DIR}/systemd/"*.timer   config/includes.chroot/etc/systemd/system/

# Build
lb build

# Find the ISO — live-build may name it binary.iso or live-image-amd64.iso
ISO_SRC="$(ls -1 *.iso 2>/dev/null | head -1)"
if [[ -z "$ISO_SRC" ]]; then
  echo "[build] ERROR: no ISO found in ${WORKDIR} after lb build"
  ls -la
  exit 1
fi

mv "$ISO_SRC" "${REPO_ROOT}/coastalos-${VERSION}.iso"
echo "[build] ISO ready: ${REPO_ROOT}/coastalos-${VERSION}.iso ($(du -h "${REPO_ROOT}/coastalos-${VERSION}.iso" | cut -f1))"
