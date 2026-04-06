#!/usr/bin/env bash
# build-deb.sh — produce coastalclaw_<version>_amd64.deb
# Usage: bash packaging/build-deb.sh [version]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-$(node -p "require('${REPO_ROOT}/package.json').version")}"
PKG="coastalclaw_${VERSION}_amd64"
STAGING="${REPO_ROOT}/dist-deb/${PKG}"

echo "[deb] Building ${PKG}.deb..."

# Clean staging
rm -rf "${REPO_ROOT}/dist-deb"
mkdir -p "${STAGING}"

# ── Application files ─────────────────────────────────────────
INSTALL_DIR="${STAGING}/opt/coastalclaw"
mkdir -p "${INSTALL_DIR}"

# Copy source (no node_modules or dist — postinst builds on target)
rsync -a --exclude='node_modules' --exclude='dist' --exclude='dist-electron' \
  --exclude='.git' --exclude='dist-deb' --exclude='*.iso' \
  "${REPO_ROOT}/" "${INSTALL_DIR}/"

# ── Systemd units ─────────────────────────────────────────────
SYSTEMD_DIR="${STAGING}/lib/systemd/system"
mkdir -p "${SYSTEMD_DIR}"
cp "${REPO_ROOT}/coastalos/systemd/coastal-server.service"    "${SYSTEMD_DIR}/coastalclaw-server.service"
cp "${REPO_ROOT}/coastalos/systemd/coastal-daemon.service"    "${SYSTEMD_DIR}/coastalclaw-daemon.service"
cp "${REPO_ROOT}/coastalos/systemd/coastal-architect.service" "${SYSTEMD_DIR}/coastalclaw-architect.service"
cp "${REPO_ROOT}/coastalos/systemd/coastal-architect.timer"   "${SYSTEMD_DIR}/coastalclaw-architect.timer"

# Fix ExecStart paths in the copied units
sed -i 's|/usr/bin/node packages/core/dist/main.js|/usr/bin/node /opt/coastalclaw/packages/core/dist/main.js|g' \
  "${SYSTEMD_DIR}/coastalclaw-server.service"

# ── CLI wrapper ───────────────────────────────────────────────
BIN_DIR="${STAGING}/usr/bin"
mkdir -p "${BIN_DIR}"
cat > "${BIN_DIR}/coastalclaw" <<'SCRIPT'
#!/bin/bash
exec node /opt/coastalclaw/packages/core/dist/main.js "$@"
SCRIPT
chmod 755 "${BIN_DIR}/coastalclaw"

# ── Debian control files ──────────────────────────────────────
DEBIAN_DIR="${STAGING}/DEBIAN"
mkdir -p "${DEBIAN_DIR}"

# Update version in control
sed "s/^Version:.*/Version: ${VERSION}/" \
  "${REPO_ROOT}/packaging/debian/control" > "${DEBIAN_DIR}/control"

cp "${REPO_ROOT}/packaging/debian/postinst" "${DEBIAN_DIR}/postinst"
cp "${REPO_ROOT}/packaging/debian/prerm"    "${DEBIAN_DIR}/prerm"
chmod 755 "${DEBIAN_DIR}/postinst" "${DEBIAN_DIR}/prerm"

# ── Build ─────────────────────────────────────────────────────
dpkg-deb --build --root-owner-group "${STAGING}" "${REPO_ROOT}/dist-deb/${PKG}.deb"

echo "[deb] Done: dist-deb/${PKG}.deb ($(du -sh "${REPO_ROOT}/dist-deb/${PKG}.deb" | cut -f1))"
