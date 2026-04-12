#!/usr/bin/env bash
# ============================================================
#  Coastal.AI — one-line installer
#  curl -fsSL https://raw.githubusercontent.com/CoastalCrypto/Coastal.AI/master/install.sh | bash
# ============================================================
set -euo pipefail

# ── Colours ─────────────────────────────────────────────────
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
RESET='\033[0m'

info()    { echo -e "${CYAN}${BOLD}[coastal-ai]${RESET} $*"; }
success() { echo -e "${GREEN}${BOLD}  ✔${RESET}  $*"; }
warn()    { echo -e "${YELLOW}${BOLD}  ⚠${RESET}  $*"; }
error()   { echo -e "${RED}${BOLD}  ✖${RESET}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}$*${RESET}"; }

# ── Banner ───────────────────────────────────────────────────
echo -e "
${CYAN}${BOLD}
   ██████╗ ██████╗  █████╗ ███████╗████████╗ █████╗ ██╗       █████╗ ██╗
  ██╔════╝██╔═══██╗██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██║      ██╔══██╗██║
  ██║     ██║   ██║███████║███████╗   ██║   ███████║██║      ███████║██║
  ██║     ██║   ██║██╔══██║╚════██║   ██║   ██╔══██║██║      ██╔══██║██║
  ╚██████╗╚██████╔╝██║  ██║███████║   ██║   ██║  ██║███████╗ ██║  ██║██║
   ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝ ╚═╝  ╚═╝╚═╝
${RESET}
  ${DIM}Your private AI executive team — running on your hardware.${RESET}
  ${DIM}Data never leaves the facility.${RESET}

"

# ── Platform detection ───────────────────────────────────────
OS="$(uname -s 2>/dev/null || echo Unknown)"
ARCH="$(uname -m 2>/dev/null || echo unknown)"

case "$OS" in
  Linux*)   PLATFORM="linux" ;;
  Darwin*)  PLATFORM="macos" ;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM="windows" ;;
  *)        PLATFORM="unknown" ;;
esac

info "Platform detected: ${BOLD}${OS} / ${ARCH}${RESET}"

# ── Install directory ────────────────────────────────────────
DEFAULT_INSTALL_DIR="${HOME}/coastal-ai"
INSTALL_DIR="${CC_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

step "① Choosing install location"
if [[ -d "$INSTALL_DIR" && -f "$INSTALL_DIR/package.json" ]]; then
  warn "Existing installation found at ${INSTALL_DIR} — will update in place."
else
  info "Installing to: ${BOLD}${INSTALL_DIR}${RESET}"
fi

# ── Helper: check if command exists ─────────────────────────
has() { command -v "$1" &>/dev/null; }

# ── Check Git ────────────────────────────────────────────────
step "② Checking prerequisites"

if ! has git; then
  error "Git is required. Install it from https://git-scm.com and re-run."
fi
success "Git $(git --version | awk '{print $3}')"

# ── Check / install Node.js 22+ ──────────────────────────────
install_node() {
  info "Installing Node.js via nvm..."
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck source=/dev/null
  [[ -s "${NVM_DIR}/nvm.sh" ]] && source "${NVM_DIR}/nvm.sh"
  nvm install 22
  nvm use 22
  nvm alias default 22
}

if has node; then
  NODE_VER="$(node --version | sed 's/v//')"
  NODE_MAJOR="$(echo "$NODE_VER" | cut -d. -f1)"
  if (( NODE_MAJOR < 22 )); then
    warn "Node.js ${NODE_VER} found but Coastal.AI requires v22+."
    if has nvm; then
      info "Upgrading via nvm..."
      nvm install 22 && nvm use 22 && nvm alias default 22
    else
      install_node
    fi
  else
    success "Node.js v${NODE_VER}"
  fi
else
  install_node
fi

# ── Check / install pnpm ─────────────────────────────────────
if ! has pnpm; then
  info "Installing pnpm..."
  npm install -g pnpm@latest
fi
success "pnpm $(pnpm --version)"

# ── Check / install Ollama ───────────────────────────────────
if ! has ollama; then
  info "Installing Ollama..."
  case "$PLATFORM" in
    macos)
      if has brew; then
        brew install ollama
      else
        warn "Homebrew not found. Installing Ollama via official script..."
        curl -fsSL https://ollama.com/install.sh | sh
      fi
      ;;
    linux)
      curl -fsSL https://ollama.com/install.sh | sh
      ;;
    windows)
      warn "On Windows, please install Ollama manually from https://ollama.com/download"
      warn "Then re-run this installer."
      exit 1
      ;;
    *)
      warn "Unknown platform. Install Ollama from https://ollama.com and re-run."
      exit 1
      ;;
  esac
fi
success "Ollama $(ollama --version 2>/dev/null | head -1 || echo 'installed')"

# ── Clone or update repo ─────────────────────────────────────
step "③ Fetching Coastal.AI"

REPO_URL="https://github.com/CoastalCrypto/Coastal.AI.git"
REPO_BRANCH="master"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Updating existing installation..."
  git -C "$INSTALL_DIR" fetch origin "$REPO_BRANCH"
  git -C "$INSTALL_DIR" checkout "$REPO_BRANCH"
  git -C "$INSTALL_DIR" reset --hard "origin/$REPO_BRANCH"
elif [[ -d "$INSTALL_DIR" ]]; then
  # Directory exists but is not a git repo — stale or partial previous install
  warn "Found ${INSTALL_DIR} but it is not a git repository."
  info "Removing stale directory and re-cloning..."
  rm -rf "$INSTALL_DIR"
  git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
else
  git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
success "Repository at ${INSTALL_DIR}"

# ── Install dependencies ─────────────────────────────────────
step "④ Installing dependencies"
cd "$INSTALL_DIR"
info "Running pnpm install (this may take a minute)..."
pnpm install --frozen-lockfile --reporter=append-only 2>&1 || pnpm install --reporter=append-only 2>&1
success "Dependencies installed"

# ── Build ────────────────────────────────────────────────────
step "⑤ Building"
info "Building packages (this may take 30–60s)..."
pnpm build 2>&1 | tail -5
success "Build complete"

# ── Create .env.local files ──────────────────────────────────
step "⑥ Creating configuration"

CORE_ENV="${INSTALL_DIR}/packages/core/.env.local"
WEB_ENV="${INSTALL_DIR}/packages/web/.env.local"

if [[ ! -f "$CORE_ENV" ]]; then
  cat > "$CORE_ENV" <<EOF
CC_PORT=4747
CC_HOST=127.0.0.1
CC_DATA_DIR=./data
CC_OLLAMA_URL=http://127.0.0.1:11434
CC_DEFAULT_MODEL=llama3.2
CC_VRAM_BUDGET_GB=24
CC_ROUTER_CONFIDENCE=0.7
EOF
  success "Created ${CORE_ENV}"
else
  info "Core config already exists — skipping."
fi

if [[ ! -f "$WEB_ENV" ]]; then
  cat > "$WEB_ENV" <<EOF
VITE_CORE_PORT=4747
EOF
  success "Created ${WEB_ENV}"
else
  info "Web config already exists — skipping."
fi

# ── Pull default model ───────────────────────────────────────
step "⑦ Pulling default model (llama3.2)"

# Start Ollama in background if not already running
if ! ollama list &>/dev/null; then
  info "Starting Ollama service..."
  ollama serve &>/dev/null &
  OLLAMA_PID=$!
  sleep 3
  info "Ollama started (PID ${OLLAMA_PID})"
fi

if ollama list 2>/dev/null | grep -q "llama3.2"; then
  success "llama3.2 already pulled"
else
  info "Pulling llama3.2 (~2 GB)..."
  ollama pull llama3.2
  success "llama3.2 ready"
fi

# ── Add to PATH (shell profile) ──────────────────────────────
step "⑧ Setting up CLI shortcut"

CC_BIN_DIR="${HOME}/.local/bin"
mkdir -p "$CC_BIN_DIR"

cat > "${CC_BIN_DIR}/coastal-ai" <<SCRIPT
#!/usr/bin/env bash
cd "${INSTALL_DIR}" && node packages/core/dist/main.js "\$@"
SCRIPT
chmod +x "${CC_BIN_DIR}/coastal-ai"

# Add to PATH if not already there
SHELL_RC=""
if [[ "$SHELL" == *zsh ]]; then SHELL_RC="${HOME}/.zshrc"
elif [[ "$SHELL" == *bash ]]; then SHELL_RC="${HOME}/.bashrc"
fi

if [[ -n "$SHELL_RC" ]]; then
  if ! grep -q "${CC_BIN_DIR}" "$SHELL_RC" 2>/dev/null; then
    echo "export PATH=\"${CC_BIN_DIR}:\$PATH\"" >> "$SHELL_RC"
    info "Added ${CC_BIN_DIR} to PATH in ${SHELL_RC}"
  fi
fi

success "CLI shortcut created at ${CC_BIN_DIR}/coastal-ai"

# ── Launch ───────────────────────────────────────────────────
step "⑨ Launching Coastal.AI"

# Start core in background
info "Starting core service on :4747..."
cd "$INSTALL_DIR"
nohup node packages/core/dist/main.js > /tmp/coastal-ai-core.log 2>&1 &
CORE_PID=$!
echo $CORE_PID > /tmp/coastal-ai-core.pid

# Wait for core to be ready
MAX_WAIT=15
for i in $(seq 1 $MAX_WAIT); do
  if curl -sf http://127.0.0.1:4747/health &>/dev/null; then
    success "Core service ready (PID ${CORE_PID})"
    break
  fi
  if (( i == MAX_WAIT )); then
    warn "Core didn't respond within ${MAX_WAIT}s. Check /tmp/coastal-ai-core.log"
  fi
  sleep 1
done

# Start web portal in background
info "Starting web portal on :5173..."
cd "${INSTALL_DIR}/packages/web"
nohup pnpm preview --port 5173 --host 127.0.0.1 > /tmp/coastal-ai-web.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > /tmp/coastal-ai-web.pid
sleep 2
success "Web portal ready (PID ${WEB_PID})"

# Open browser
open_browser() {
  local url="$1"
  case "$PLATFORM" in
    macos)   open "$url" ;;
    linux)   xdg-open "$url" 2>/dev/null || sensible-browser "$url" 2>/dev/null || true ;;
    windows) start "$url" 2>/dev/null || true ;;
  esac
}

open_browser "http://127.0.0.1:5173"

# ── Admin token ───────────────────────────────────────────────
ADMIN_TOKEN_FILE="${INSTALL_DIR}/packages/core/data/.admin-token"
sleep 2  # give core a moment to write the token

echo ""
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Coastal.AI is running!${RESET}"
echo ""
echo -e "  ${BOLD}Web portal:${RESET}   http://127.0.0.1:5173"
echo -e "  ${BOLD}Core API:${RESET}     http://127.0.0.1:4747"
echo ""
if [[ -f "$ADMIN_TOKEN_FILE" ]]; then
  echo -e "  ${BOLD}Admin token:${RESET}  $(cat "$ADMIN_TOKEN_FILE")"
  echo -e "  ${DIM}(saved to ${ADMIN_TOKEN_FILE})${RESET}"
fi
echo ""
echo -e "  ${DIM}Logs:  /tmp/coastal-ai-core.log${RESET}"
echo -e "  ${DIM}       /tmp/coastal-ai-web.log${RESET}"
echo ""
echo -e "  ${DIM}To stop: kill \$(cat /tmp/coastal-ai-core.pid /tmp/coastal-ai-web.pid)${RESET}"
echo -e "${CYAN}${BOLD}════════════════════════════════════════════════════${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo -e "  ${DIM}1. Open the web portal and complete onboarding${RESET}"
echo -e "  ${DIM}2. Go to Models → enter your admin token → install a model${RESET}"
echo -e "  ${DIM}3. Assign models to agent domains (COO / CFO / CTO)${RESET}"
echo -e "  ${DIM}4. Start chatting with your AI executive team${RESET}"
echo ""
