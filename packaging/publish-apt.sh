#!/usr/bin/env bash
# publish-apt.sh — update the apt/ branch with a new .deb and regenerate Packages index
# Requires: dpkg-scanpackages, gzip, gpg (optional signing)
# Usage: bash packaging/publish-apt.sh <path-to.deb>
set -euo pipefail

DEB_PATH="$(realpath "$1")"
DEB_FILE="$(basename "$DEB_PATH")"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APT_BRANCH="apt"
WORK_DIR="$(mktemp -d)"
# Inject GITHUB_TOKEN for authenticated pushes on CI
REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url origin)"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  REMOTE_URL="${REMOTE_URL/https:\/\//https:\/\/x-access-token:${GITHUB_TOKEN}@}"
fi

cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT

echo "[apt] Publishing ${DEB_FILE}..."

# Clone the apt branch (or create it)
if git -C "$REPO_ROOT" ls-remote --exit-code --heads origin "$APT_BRANCH" &>/dev/null; then
  git clone --depth=1 --branch "$APT_BRANCH" "$REMOTE_URL" "$WORK_DIR/apt"
else
  mkdir -p "$WORK_DIR/apt"
  git -C "$WORK_DIR/apt" init
  git -C "$WORK_DIR/apt" checkout -b "$APT_BRANCH"
  git -C "$WORK_DIR/apt" remote add origin "$REMOTE_URL"
fi

mkdir -p "$WORK_DIR/apt/pool/main"

# Copy new deb
cp "$DEB_PATH" "$WORK_DIR/apt/pool/main/"

# Generate Packages index
cd "$WORK_DIR/apt"
dpkg-scanpackages --arch amd64 pool/ > Packages
gzip -k Packages

# Write Release file
cat > Release <<EOF
Origin: CoastalClaw
Label: CoastalClaw
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Date: $(date -Ru)
EOF

# Optional: sign with GPG if key is available
if [[ -n "${GPG_KEY_ID:-}" ]]; then
  gpg --default-key "$GPG_KEY_ID" -abs -o Release.gpg Release
  gpg --default-key "$GPG_KEY_ID" --clearsign -o InRelease Release
  echo "[apt] Release signed with $GPG_KEY_ID"
fi

# Write setup script (users run this to add the repo)
cat > setup.sh <<'SETUP'
#!/bin/bash
set -e
curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/coastalclaw-release.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/coastalclaw.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/coastalclaw.gpg] \
  https://CoastalCrypto.github.io/CoastalClaw_IO stable main" | \
  sudo tee /etc/apt/sources.list.d/coastalclaw.list
sudo apt-get update
sudo apt-get install -y coastalclaw
SETUP
chmod +x setup.sh

# Commit and push
git add -A
git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git commit -m "apt: publish ${DEB_FILE}" || echo "[apt] Nothing to commit"
git push origin "$APT_BRANCH" --force

echo "[apt] Published. Users can install with:"
echo "  curl -fsSL https://CoastalCrypto.github.io/CoastalClaw_IO/setup.sh | sudo bash"
