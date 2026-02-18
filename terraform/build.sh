#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$SCRIPT_DIR/.build"
ESBUILD="$PROJECT_DIR/node_modules/.bin/esbuild"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/webhookListener" "$BUILD_DIR/clientWebsocket"

# Bundle each handler with esbuild (CJS for Lambda compatibility)
"$ESBUILD" "$PROJECT_DIR/handlers/webhookListener.js" \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile="$BUILD_DIR/webhookListener/index.js"

"$ESBUILD" "$PROJECT_DIR/handlers/clientWebsocket.js" \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile="$BUILD_DIR/clientWebsocket/index.js"

# Create zip archives for Lambda deployment
(cd "$BUILD_DIR/webhookListener" && zip -qr "$BUILD_DIR/webhookListener.zip" .)
(cd "$BUILD_DIR/clientWebsocket" && zip -qr "$BUILD_DIR/clientWebsocket.zip" .)

echo "Lambda bundles built successfully."
