#!/bin/bash
set -e

# Build script for Stremio Downloader AppImage
# Run this on a Linux x86_64 system (e.g., SteamOS)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
APPDIR="$BUILD_DIR/StremioDownloader.AppDir"

NODE_VERSION="18.20.4"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz"
FFMPEG_URL="https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"
APPIMAGETOOL_URL="https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage"

echo "=== Stremio Downloader AppImage Builder ==="
echo ""

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$APPDIR/bin" "$APPDIR/app"

# Step 1: Download Node.js
echo "[1/5] Downloading Node.js v${NODE_VERSION}..."
if [ ! -f "/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz" ]; then
    curl -L -o "/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz" "$NODE_URL"
fi
echo "  Extracting Node.js..."
tar -xf "/tmp/node-v${NODE_VERSION}-linux-x64.tar.xz" -C /tmp
cp "/tmp/node-v${NODE_VERSION}-linux-x64/bin/node" "$APPDIR/bin/node"
chmod +x "$APPDIR/bin/node"

# Step 2: Download ffmpeg
echo "[2/5] Downloading static ffmpeg..."
if [ ! -f "/tmp/ffmpeg-release-amd64-static.tar.xz" ]; then
    curl -L -o "/tmp/ffmpeg-release-amd64-static.tar.xz" "$FFMPEG_URL"
fi
echo "  Extracting ffmpeg..."
FFMPEG_DIR=$(tar -tf "/tmp/ffmpeg-release-amd64-static.tar.xz" | head -1 | cut -d/ -f1)
tar -xf "/tmp/ffmpeg-release-amd64-static.tar.xz" -C /tmp
cp "/tmp/${FFMPEG_DIR}/ffmpeg" "$APPDIR/bin/ffmpeg"
cp "/tmp/${FFMPEG_DIR}/ffprobe" "$APPDIR/bin/ffprobe"
chmod +x "$APPDIR/bin/ffmpeg" "$APPDIR/bin/ffprobe"

# Step 3: Copy app files
echo "[3/5] Copying application files..."
cp "$PROJECT_DIR/server-standalone.js" "$APPDIR/app/"
cp "$PROJECT_DIR/package.json" "$APPDIR/app/"
cp -r "$PROJECT_DIR/lib" "$APPDIR/app/lib"
cp -r "$PROJECT_DIR/downloader" "$APPDIR/app/downloader"
cp -r "$PROJECT_DIR/assets" "$APPDIR/app/assets"

# Install production dependencies
echo "  Installing dependencies..."
cd "$APPDIR/app"
"$APPDIR/bin/node" -e "
// Minimal npm install equivalent - copy node_modules from project
" 2>/dev/null || true
cp -r "$PROJECT_DIR/node_modules" "$APPDIR/app/node_modules"
cd "$PROJECT_DIR"

# Step 4: Copy AppImage metadata
echo "[4/5] Setting up AppImage metadata..."
cp "$SCRIPT_DIR/AppRun" "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"
cp "$SCRIPT_DIR/stremio-downloader.desktop" "$APPDIR/stremio-downloader.desktop"

# Use existing icon or create placeholder
if [ -f "$SCRIPT_DIR/icons/downloader.png" ]; then
    cp "$SCRIPT_DIR/icons/downloader.png" "$APPDIR/stremio-downloader.png"
elif [ -f "$PROJECT_DIR/assets/addonLogo.png" ]; then
    cp "$PROJECT_DIR/assets/addonLogo.png" "$APPDIR/stremio-downloader.png"
else
    echo "  Warning: No icon found, creating placeholder"
    # Create a 1x1 pixel PNG as placeholder
    printf '\x89\x50\x4e\x47\x0d\x0a\x1a\x0a\x00\x00\x00\x0d\x49\x48\x44\x52\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90\x77\x53\xde\x00\x00\x00\x0c\x49\x44\x41\x54\x08\xd7\x63\xf8\x4f\x00\x00\x00\x01\x01\x00\x05\x18\xd8\x4e\x00\x00\x00\x00\x49\x45\x4e\x44\xae\x42\x60\x82' > "$APPDIR/stremio-downloader.png"
fi

# Step 5: Build AppImage
echo "[5/5] Building AppImage..."
if [ ! -f "/tmp/appimagetool" ]; then
    curl -L -o "/tmp/appimagetool" "$APPIMAGETOOL_URL"
    chmod +x "/tmp/appimagetool"
fi

# appimagetool needs FUSE or --appimage-extract-and-run
ARCH=x86_64 /tmp/appimagetool --appimage-extract-and-run "$APPDIR" "$BUILD_DIR/StremioDownloader-x86_64.AppImage" 2>/dev/null || \
ARCH=x86_64 /tmp/appimagetool "$APPDIR" "$BUILD_DIR/StremioDownloader-x86_64.AppImage"

echo ""
echo "=== Build complete! ==="
echo "AppImage: $BUILD_DIR/StremioDownloader-x86_64.AppImage"
echo ""
echo "To use on SteamOS:"
echo "  1. Copy StremioDownloader-x86_64.AppImage to your device"
echo "  2. chmod +x StremioDownloader-x86_64.AppImage"
echo "  3. ./StremioDownloader-x86_64.AppImage"
echo ""
echo "Or install to your home directory:"
echo "  cp StremioDownloader-x86_64.AppImage ~/.local/bin/stremio-downloader"
echo "  chmod +x ~/.local/bin/stremio-downloader"
