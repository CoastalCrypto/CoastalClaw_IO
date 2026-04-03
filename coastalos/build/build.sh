#!/bin/bash
set -e

VERSION="${1:-dev}"
echo "[build] Building CoastalOS ${VERSION}..."

# Ensure live-build is installed
if ! command -v lb &> /dev/null; then
  echo "Error: live-build not installed. Run: sudo apt install live-build"
  exit 1
fi

WORKDIR="$(mktemp -d)"
cd "$WORKDIR"

# Configure live-build
lb config \
  --distribution noble \
  --archive-areas "main restricted universe multiverse" \
  --debian-installer live \
  --bootloaders grub-efi,grub-pc \
  --binary-images iso-hybrid \
  --iso-application "CoastalOS" \
  --iso-volume "CoastalOS-${VERSION}"

# Add package list
cp "$(dirname "$0")/packages.list" config/package-lists/coastalos.list.chroot

# Add post-install hook
mkdir -p config/hooks/live
cp "$(dirname "$0")/hooks/post-install.sh" config/hooks/live/99-coastalos.hook.chroot
chmod +x config/hooks/live/99-coastalos.hook.chroot

# Add labwc config
mkdir -p config/includes.chroot/tmp/labwc
cp "$(dirname "$0")/../labwc/rc.xml" config/includes.chroot/tmp/labwc/
cp "$(dirname "$0")/../labwc/autostart" config/includes.chroot/tmp/labwc/

# Add systemd units
mkdir -p config/includes.chroot/etc/systemd/system
cp "$(dirname "$0")/../systemd/"*.service config/includes.chroot/etc/systemd/system/
cp "$(dirname "$0")/../systemd/"*.timer config/includes.chroot/etc/systemd/system/

# Build
lb build

# Move ISO to project root
mv live-image-amd64.hybrid.iso "$(dirname "$0")/../../coastalos-${VERSION}.iso"
echo "[build] ISO ready: coastalos-${VERSION}.iso"
