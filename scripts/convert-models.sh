#!/usr/bin/env bash
# Convert every pokemon folder under models-downloads/ into a single .glb
# in public/models/<lowercase>.glb.
#
# Sources:
#   - Pokedex 3D Pro folders (model.obj + model.mtl + textures)  -> Blender OBJ
#   - X/Y rip folders (FBX 6100 + DAE + SMD, no PNG textures)    -> fbx2gltf
#
# Prerequisites:
#   - Blender installed at /Applications/Blender.app
#   - @robertlong/fbx2gltf devDep installed (auto via pnpm install)

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/models-downloads"
DST="$ROOT/public/models"
BLENDER="/Applications/Blender.app/Contents/MacOS/Blender"
FBX2GLTF="$ROOT/node_modules/@robertlong/fbx2gltf/bin/Darwin/FBX2glTF"
PY="$ROOT/scripts/blender-convert.py"

if [ ! -d "$SRC" ]; then
  echo "ERROR: $SRC not found. Drop unzipped pokemon folders there." >&2
  exit 1
fi
if [ ! -x "$BLENDER" ]; then
  echo "ERROR: Blender not found at $BLENDER" >&2
  exit 1
fi
if [ ! -x "$FBX2GLTF" ]; then
  echo "ERROR: $FBX2GLTF not found. Run: pnpm install" >&2
  exit 1
fi

mkdir -p "$DST"
cd "$SRC"

for dir in */; do
  name="${dir%/}"
  # Lowercase + strip dots & spaces. Hyphens preserved so "Mr-Mime" -> "mr-mime".
  # Rename source folders to use hyphens instead of spaces / dots.
  lower=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -d '. ')
  out="$DST/${lower}.glb"

  if [ -f "$dir/model.obj" ]; then
    echo "[$name] OBJ -> $out"
    "$BLENDER" --background --python "$PY" -- "$SRC/$dir/model.obj" "$out" >/dev/null 2>&1
    rc=$?
  elif fbx=$(find "$dir" -maxdepth 1 -iname '*.fbx' -print -quit 2>/dev/null) && [ -n "$fbx" ]; then
    echo "[$name] FBX -> $out  ($(file -b "$fbx" | cut -d, -f2))"
    base="${out%.glb}"
    "$FBX2GLTF" --binary --input "$fbx" --output "$base" >/dev/null 2>&1
    rc=$?
  else
    echo "[$name] SKIP - no obj or fbx"
    continue
  fi

  if [ -f "$out" ]; then
    size=$(stat -f%z "$out" 2>/dev/null || stat -c%s "$out" 2>/dev/null)
    echo "    -> ${size} bytes (rc=$rc)"
  else
    echo "    !! FAILED (rc=$rc)"
  fi
done
