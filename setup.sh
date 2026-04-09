#!/bin/bash
# Stremio Downloader - One-click setup for SteamOS
# Run this once: bash setup.sh
set -e

echo "=== Stremio Downloader Setup ==="
echo ""

# Step 1: Install Node.js via fnm (no root needed)
if command -v node &> /dev/null; then
    NODE_VER=$(node -v)
    echo "[OK] Node.js already installed: $NODE_VER"
else
    echo "[1/4] Installing Node.js..."
    curl -fsSL https://fnm.vercel.app/install | bash
    export PATH="$HOME/.local/share/fnm:$PATH"
    eval "$(fnm env)"
    fnm install 18
    echo "[OK] Node.js installed: $(node -v)"
fi

# Step 2: Install dependencies
echo "[2/4] Installing dependencies..."
cd "$(dirname "$0")"
INSTALL_DIR="$(pwd)"
npm install --production 2>&1 | tail -1
echo "[OK] Dependencies installed"

# Step 3: Create launcher scripts
echo "[3/4] Creating launchers..."

mkdir -p "$HOME/.local/bin"

# Downloader-only launcher
cat > "$HOME/.local/bin/stremio-downloader" << LAUNCHER
#!/bin/bash
export PATH="\$HOME/.local/share/fnm:\$PATH"
eval "\$(fnm env)" 2>/dev/null
cd "$INSTALL_DIR"
node server-standalone.js
LAUNCHER
chmod +x "$HOME/.local/bin/stremio-downloader"

# Stremio + Downloader combined launcher
cat > "$HOME/.local/bin/stremio-with-downloader" << WRAPPER
#!/bin/bash
export PATH="\$HOME/.local/bin:\$HOME/.local/share/fnm:\$PATH"
eval "\$(fnm env)" 2>/dev/null

# Start Stremio (forks to background on its own)
flatpak run com.stremio.Stremio "\$@" &

# Run downloader in foreground (keeps terminal open)
cd "$INSTALL_DIR"
exec node server-standalone.js
WRAPPER
chmod +x "$HOME/.local/bin/stremio-with-downloader"

# Step 4: Override the Stremio desktop entry so the normal icon starts both
echo "[4/4] Setting up Stremio icon to auto-start downloader..."

mkdir -p "$HOME/.local/share/applications"

# Override the Flatpak Stremio desktop entry
cat > "$HOME/.local/share/applications/com.stremio.Stremio.desktop" << DESKTOP
[Desktop Entry]
Name=Stremio
Comment=Watch videos with Stremio + Downloader
Exec=$HOME/.local/bin/stremio-with-downloader
Icon=com.stremio.Stremio
Terminal=false
Type=Application
Categories=AudioVideo;Video;Player;TV;
Keywords=stremio;video;stream;download;
DESKTOP

# Also create a standalone downloader entry
cat > "$HOME/.local/share/applications/stremio-downloader.desktop" << DESKTOP2
[Desktop Entry]
Name=Stremio Downloader
Comment=Download manager for Stremio
Exec=$HOME/.local/bin/stremio-downloader
Terminal=true
Type=Application
Categories=AudioVideo;Network;Video;
DESKTOP2

# Update desktop database
update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

echo ""
echo "=== Setup complete! ==="
echo ""
echo "From now on, just open Stremio normally from your app menu."
echo "The downloader will start automatically with it."
echo ""
echo "Starting now..."
echo ""

node server-standalone.js
