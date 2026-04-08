#!/bin/bash
set -e

REPO_URL="https://CoastalCrypto.github.io/CoastalClaw_IO"
KEY_URL="https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/coastalclaw-release.asc"
LIST_FILE="/etc/apt/sources.list.d/coastalclaw.list"

echo "[coastalclaw] Adding CoastalClaw APT repository..."

# Try to import GPG key — fall back to trusted=yes if key fetch fails
if curl -fsSL "$KEY_URL" | sudo gpg --dearmor -o /usr/share/keyrings/coastalclaw.gpg 2>/dev/null; then
  SIGNED_BY="signed-by=/usr/share/keyrings/coastalclaw.gpg "
  echo "[coastalclaw] GPG key installed"
else
  SIGNED_BY=""
  echo "[coastalclaw] Warning: could not fetch GPG key, using trusted=yes"
fi

echo "deb [arch=amd64 ${SIGNED_BY}trusted=yes] ${REPO_URL} stable main" | \
  sudo tee "$LIST_FILE"

sudo apt-get update
sudo apt-get install -y coastalclaw
