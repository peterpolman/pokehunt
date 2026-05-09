#!/usr/bin/env bash
# Fetch transparent-PNG thumbnails for every spawn key in src/data/spawns.ts
# from pokemondb.net (Scarlet/Violet icon sheet) and auto-crop transparent
# padding. Skips files that already exist.
#
# Usage:
#   pnpm fetch-sprites             # fetch missing sprites for every spawn
#   pnpm fetch-sprites charizard   # fetch one or more by key
#
# Requires:
#   - curl
#   - python3 + Pillow for auto-crop (creates a local venv at scripts/.venv
#     on first run if Pillow isn't already importable).

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DST="$ROOT/public/models"
SPAWNS="$ROOT/src/data/spawns.ts"
VENV="$ROOT/scripts/.venv"

mkdir -p "$DST"

# Build list of keys to fetch. The key IS the pokemondb slug — no
# special-case mapping. For Pokémon with hyphens (mr-mime, ho-oh) name the
# spawn key with the hyphen.
keys=("$@")
if [ ${#keys[@]} -eq 0 ]; then
  if [ ! -f "$SPAWNS" ]; then
    echo "ERROR: $SPAWNS not found" >&2
    exit 1
  fi
  # Pull every `key: "<value>",` from the seed table.
  mapfile -t keys < <(grep -oE 'key: "[a-z-]+"' "$SPAWNS" | sed -E 's/key: "([a-z-]+)"/\1/' | sort -u)
fi

echo "Targets: ${keys[*]}"

for key in "${keys[@]}"; do
  out="$DST/${key}.png"
  if [ -f "$out" ]; then
    echo "[$key] exists, skipping"
    continue
  fi
  url="https://img.pokemondb.net/sprites/scarlet-violet/icon/${key}.png"
  code=$(curl -s -L -o "$out" -w "%{http_code}" \
    -e "https://pokemondb.net/sprites" -A "Mozilla/5.0" "$url")
  size=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out" 2>/dev/null)
  if [ "$code" != "200" ] || [ "${size:-0}" -lt 500 ]; then
    echo "[$key] FAIL  http=$code  ${size:-0}B  $url"
    rm -f "$out"
  else
    echo "[$key] OK    ${size}B"
  fi
done

# -------- Auto-crop transparent padding via Pillow --------

PY=""
if python3 -c "from PIL import Image" >/dev/null 2>&1; then
  PY="python3"
elif [ -x "$VENV/bin/python" ] && "$VENV/bin/python" -c "from PIL import Image" >/dev/null 2>&1; then
  PY="$VENV/bin/python"
else
  echo "Setting up Pillow venv at $VENV ..."
  python3 -m venv "$VENV" && "$VENV/bin/pip" install --quiet pillow >/dev/null 2>&1
  if [ -x "$VENV/bin/python" ]; then PY="$VENV/bin/python"; fi
fi

if [ -z "$PY" ]; then
  echo "WARN: Pillow not available, skipping auto-crop" >&2
  exit 0
fi

"$PY" - "$DST" <<'PY'
import sys, os, glob
from PIL import Image
d = sys.argv[1]
for path in sorted(glob.glob(os.path.join(d, '*.png'))):
    img = Image.open(path).convert('RGBA')
    bbox = img.getbbox()
    if not bbox or bbox == (0, 0, *img.size):
        continue
    cropped = img.crop(bbox)
    if cropped.size == img.size:
        continue
    cropped.save(path)
    print(f'cropped {os.path.basename(path):16} {img.size} -> {cropped.size}')
PY
