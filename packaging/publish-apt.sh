#!/usr/bin/env bash
# publish-apt.sh — update the apt/ branch with a new .deb and regenerate the
# APT repository using the correct dists/stable/ hierarchy.
#
# Correct layout expected by `apt-get update`:
#   dists/stable/Release
#   dists/stable/InRelease
#   dists/stable/Release.gpg
#   dists/stable/main/binary-amd64/Packages
#   dists/stable/main/binary-amd64/Packages.gz
#   pool/main/<package>.deb
#
# Requires: dpkg-scanpackages, apt-ftparchive (apt-utils), gzip, gpg
# Usage: bash packaging/publish-apt.sh <path-to.deb>
set -euo pipefail

DEB_PATH="$(realpath "$1")"
DEB_FILE="$(basename "$DEB_PATH")"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APT_BRANCH="apt"
WORK_DIR="$(mktemp -d)"
REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  REMOTE_URL="${REMOTE_URL/https:\/\//https:\/\/x-access-token:${GITHUB_TOKEN}@}"
fi

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

echo "[apt] Publishing ${DEB_FILE}..."

# ── Clone the apt branch (or create it fresh) ────────────────
if git -C "$REPO_ROOT" ls-remote --exit-code --heads origin "$APT_BRANCH" &>/dev/null; then
  git clone --depth=1 --branch "$APT_BRANCH" "$REMOTE_URL" "$WORK_DIR/apt"
else
  mkdir -p "$WORK_DIR/apt"
  git -C "$WORK_DIR/apt" init
  git -C "$WORK_DIR/apt" checkout -b "$APT_BRANCH"
  git -C "$WORK_DIR/apt" remote add origin "$REMOTE_URL"
fi

cd "$WORK_DIR/apt"

# ── Repository layout ─────────────────────────────────────────
POOL_DIR="pool/main"
BINARY_DIR="dists/stable/main/binary-amd64"
DIST_DIR="dists/stable"

mkdir -p "$POOL_DIR" "$BINARY_DIR"

# Copy .deb into pool
cp "$DEB_PATH" "$POOL_DIR/"

# ── Generate Packages index ───────────────────────────────────
# Paths in Packages must be relative to the repo root (pool/main/foo.deb)
dpkg-scanpackages --arch amd64 "$POOL_DIR" > "$BINARY_DIR/Packages"
gzip -kf "$BINARY_DIR/Packages"

echo "[apt] Packages index generated ($(wc -l < "$BINARY_DIR/Packages") lines)"

# ── Generate Release file with checksums ─────────────────────
# apt-ftparchive computes the required MD5/SHA1/SHA256 hashes automatically
if command -v apt-ftparchive &>/dev/null; then
  apt-ftparchive \
    -o APT::FTPArchive::Release::Origin="Coastal.AI" \
    -o APT::FTPArchive::Release::Label="Coastal.AI" \
    -o APT::FTPArchive::Release::Suite="stable" \
    -o APT::FTPArchive::Release::Codename="stable" \
    -o APT::FTPArchive::Release::Architectures="amd64" \
    -o APT::FTPArchive::Release::Components="main" \
    release "$DIST_DIR" > "$DIST_DIR/Release"
else
  # Fallback: generate checksums manually
  MD5_PKG=$(md5sum    "$BINARY_DIR/Packages"    | awk '{print $1}')
  MD5_GZ=$(md5sum     "$BINARY_DIR/Packages.gz" | awk '{print $1}')
  SHA1_PKG=$(sha1sum  "$BINARY_DIR/Packages"    | awk '{print $1}')
  SHA1_GZ=$(sha1sum   "$BINARY_DIR/Packages.gz" | awk '{print $1}')
  SHA256_PKG=$(sha256sum "$BINARY_DIR/Packages"    | awk '{print $1}')
  SHA256_GZ=$(sha256sum  "$BINARY_DIR/Packages.gz" | awk '{print $1}')
  SIZE_PKG=$(wc -c < "$BINARY_DIR/Packages")
  SIZE_GZ=$(wc -c < "$BINARY_DIR/Packages.gz")

  cat > "$DIST_DIR/Release" <<EOF
Origin: Coastal.AI
Label: Coastal.AI
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Date: $(date -Ru)
MD5Sum:
 ${MD5_PKG} ${SIZE_PKG} main/binary-amd64/Packages
 ${MD5_GZ} ${SIZE_GZ} main/binary-amd64/Packages.gz
SHA1:
 ${SHA1_PKG} ${SIZE_PKG} main/binary-amd64/Packages
 ${SHA1_GZ} ${SIZE_GZ} main/binary-amd64/Packages.gz
SHA256:
 ${SHA256_PKG} ${SIZE_PKG} main/binary-amd64/Packages
 ${SHA256_GZ} ${SIZE_GZ} main/binary-amd64/Packages.gz
EOF
fi

echo "[apt] Release file generated"

# ── Optional GPG signing ──────────────────────────────────────
if [[ -n "${GPG_KEY_ID:-}" ]]; then
  rm -f "$DIST_DIR/Release.gpg" "$DIST_DIR/InRelease"
  gpgconf --kill gpg-agent 2>/dev/null || true
  GPG_OPTS="--batch --yes --no-tty --pinentry-mode loopback --no-autostart --default-key $GPG_KEY_ID"
  gpg $GPG_OPTS --armor --detach-sign -o "$DIST_DIR/Release.gpg" "$DIST_DIR/Release"
  gpg $GPG_OPTS --clearsign                -o "$DIST_DIR/InRelease"  "$DIST_DIR/Release"
  echo "[apt] Release signed with $GPG_KEY_ID"
fi

# ── Write setup.sh for end-users ─────────────────────────────
cat > setup.sh <<'SETUP'
#!/bin/bash
set -e
curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI_IO/master/coastal-ai-release.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/coastal-ai.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/coastal-ai.gpg] \
  https://CoastalCrypto.github.io/Coastal.AI_IO stable main" | \
  sudo tee /etc/apt/sources.list.d/coastal-ai.list
sudo apt-get update
sudo apt-get install -y coastal-ai
SETUP
chmod +x setup.sh

# ── Commit and push ───────────────────────────────────────────
git add -A
git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git commit -m "apt: publish ${DEB_FILE}" || echo "[apt] Nothing to commit"
git push origin "$APT_BRANCH" --force

echo "[apt] Published. Install with:"
echo "  curl -fsSL https://CoastalCrypto.github.io/Coastal.AI_IO/setup.sh | sudo bash"
