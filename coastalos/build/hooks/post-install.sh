#!/bin/bash
set -e

echo "[post-install] Installing CoastalClaw..."

# Install pnpm
npm install -g pnpm

# Install Ollama (always — CPU fallback)
curl -fsSL https://ollama.com/install.sh | sh

# Install piper-tts
pip3 install piper-tts --break-system-packages

# Install openwakeword
pip3 install openwakeword --break-system-packages

# Install vLLM only if GPU present (CUDA or ROCm)
if nvidia-smi &>/dev/null 2>&1 || rocm-smi &>/dev/null 2>&1; then
  echo "[post-install] GPU detected — installing vLLM..."
  pip3 install vllm --break-system-packages || echo "[post-install] vLLM install failed — Ollama fallback active"
  systemctl enable coastal-vllm.service || true
else
  echo "[post-install] No GPU detected — vLLM skipped, using Ollama"
fi

# Create coastal user
useradd -m -s /bin/bash coastal || true
mkdir -p /opt/coastalclaw /var/lib/coastalclaw/data /var/lib/coastalclaw/workspace
chown -R coastal:coastal /opt/coastalclaw /var/lib/coastalclaw

# Set up cgroup slice for namespace sandbox
mkdir -p /etc/systemd/system/coastal.slice.d
cat > /etc/systemd/system/coastal.slice.d/limits.conf << 'SLICE_EOF'
[Slice]
MemoryMax=512M
CPUQuota=200%
SLICE_EOF

# Copy labwc config
mkdir -p /home/coastal/.config/labwc
cp /tmp/labwc/rc.xml /home/coastal/.config/labwc/
cp /tmp/labwc/autostart /home/coastal/.config/labwc/
chmod +x /home/coastal/.config/labwc/autostart
chown -R coastal:coastal /home/coastal/.config

# Enable core services
systemctl enable coastal-server.service
systemctl enable coastal-daemon.service
systemctl enable coastal-architect.timer
systemctl enable coastal-shell.service

# Set autologin for coastal user
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << 'EOF'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin coastal --noclear %I $TERM
EOF

echo "[post-install] Done."
