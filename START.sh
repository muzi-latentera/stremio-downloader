#!/bin/bash
# Double-click this file to start Stremio Downloader
# Or right-click > Run in Konsole

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Find node
if command -v node &> /dev/null; then
    NODE=node
elif [ -f "$HOME/.local/share/fnm/node" ]; then
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)" 2>/dev/null
    NODE=node
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    source "$HOME/.nvm/nvm.sh"
    NODE=node
else
    # Try to install node automatically
    echo "Node.js not found. Installing..."
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)" 2>/dev/null
    fnm install 18
    NODE=node
fi

# Install dependencies if needed
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo "Installing dependencies..."
    cd "$SCRIPT_DIR"
    npm install --production
fi

cd "$SCRIPT_DIR"
echo ""
echo "Starting Stremio Downloader..."
echo "Close this window to stop."
echo ""
$NODE server-standalone.js
