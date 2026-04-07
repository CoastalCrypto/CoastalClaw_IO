#!/bin/bash
set -e
curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/CoastalClaw_IO/master/coastalclaw-release.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/coastalclaw.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/coastalclaw.gpg] \
  https://CoastalCrypto.github.io/CoastalClaw_IO stable main" | \
  sudo tee /etc/apt/sources.list.d/coastalclaw.list
sudo apt-get update
sudo apt-get install -y coastalclaw
