#!/usr/bin/env bash
set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Eva Consciousness — macOS Setup     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Homebrew ──────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  echo "▶ Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
  echo "✓ Homebrew already installed"
fi

# ── Node.js ───────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "▶ Installing Node.js..."
  brew install node
else
  echo "✓ Node.js $(node --version) already installed"
fi

# ── Python 3 ──────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
  echo "▶ Installing Python 3..."
  brew install python3
else
  echo "✓ Python $(python3 --version) already installed"
fi

# ── uv ────────────────────────────────────────────────────────────
if ! command -v uv &>/dev/null; then
  echo "▶ Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
else
  echo "✓ uv $(uv --version) already installed"
fi

# ── git ───────────────────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  echo "▶ Installing git..."
  brew install git
else
  echo "✓ git already installed"
fi

# ── opencode ──────────────────────────────────────────────────────
if ! command -v opencode &>/dev/null; then
  echo "▶ Installing opencode..."
  curl -fsSL https://opencode.ai/install | bash
else
  echo "✓ opencode already installed"
fi

# ── Claude Code ───────────────────────────────────────────────────
if ! command -v claude &>/dev/null; then
  echo "▶ Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
else
  echo "✓ Claude Code already installed"
fi

# ── Clone eva-consciousness ───────────────────────────────────────
REPO_DIR="$HOME/eva-consciousness"
if [ ! -d "$REPO_DIR" ]; then
  echo "▶ Cloning eva-consciousness..."
  git clone https://github.com/dwinomarll/eva-consciousness.git "$REPO_DIR"
else
  echo "✓ eva-consciousness already at $REPO_DIR"
fi

# ── Build and link CLI ────────────────────────────────────────────
echo "▶ Building CLI..."
cd "$REPO_DIR"
npm install
npm run build
npm link

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Setup complete!                     ║"
echo "║                                      ║"
echo "║  Run: eva-consciousness spawn        ║"
echo "╚══════════════════════════════════════╝"
echo ""
