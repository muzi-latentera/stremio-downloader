#!/bin/bash
# Stremio + Downloader wrapper
# Starts the downloader when Stremio opens, stops it when Stremio closes
# Install: copy to ~/.local/bin/stremio-with-downloader

DOWNLOADER_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Find node
if command -v node &> /dev/null; then
    NODE=node
elif [ -f "$HOME/.local/share/fnm/node" ]; then
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)" 2>/dev/null
    NODE=node
else
    echo "Node.js not found. Run setup.sh first."
    exit 1
fi

# Start downloader in background
cd "$DOWNLOADER_DIR"
$NODE server-standalone.js &
DOWNLOADER_PID=$!

# Wait a moment for server to start
sleep 2

# Start Stremio
flatpak run com.stremio.Stremio "$@" 2>/dev/null

# When Stremio closes, stop the downloader
kill $DOWNLOADER_PID 2>/dev/null
wait $DOWNLOADER_PID 2>/dev/null
