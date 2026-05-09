#!/usr/bin/env bash
# Copy 8th Wall runtime files from node_modules into public/vendor/ so they
# ship from our own origin (no CDN). Engine binary's chunked loader (xr-slam.js,
# resources/) prevents inlining into main.js — it self-discovers chunks
# relative to its own URL. Same-origin = no third-party at runtime.
#
# Runs automatically on `pnpm install` via the "prepare" lifecycle script.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/vendor/8thwall"
ENGINE="$ROOT/node_modules/@8thwall/engine-binary/dist"
XREXTRAS="$ROOT/node_modules/@8thwall/xrextras/dist"

[ -d "$ENGINE" ] || { echo "skip sync-vendor: $ENGINE not present"; exit 0; }

mkdir -p "$DEST"
rm -rf "$DEST"/*

cp "$ENGINE/xr.js" "$DEST/"
cp "$ENGINE/xr-slam.js" "$DEST/" 2>/dev/null || true
cp "$ENGINE/xr-face.js" "$DEST/" 2>/dev/null || true
[ -d "$ENGINE/resources" ] && cp -R "$ENGINE/resources" "$DEST/"

cp "$XREXTRAS/xrextras.js" "$DEST/"
[ -d "$XREXTRAS/resources" ] && cp -R "$XREXTRAS/resources" "$DEST/xrextras-resources" 2>/dev/null || true

echo "synced 8thwall runtime to $DEST"
