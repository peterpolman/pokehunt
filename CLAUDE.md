# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm dev          # vite dev server (--host for LAN/phone testing)
pnpm build        # tsc --noEmit && vite build → dist/
pnpm preview      # serve dist/ on :3000
pnpm typecheck    # tsc --noEmit only
pnpm fetch-pokemon       # fetch PokeAPI metadata → src/data/pokemon.json
                         #   no args        → fetch every dex# found in models-downloads/
                         #   <id> [id...]   → fetch only these dex ids
pnpm convert-models      # unzip + convert every models-downloads/*.zip → public/models/<pokeapi-name>.glb
                         #   FBX → FBX2glTF, OBJ → Blender, DAE → assimp
                         #   --force rebuilds; positional dex ids restrict scope
```

No test runner or linter is configured. `pnpm typecheck` is the only correctness gate before build.

`convert-models` external deps: Blender at `/Applications/Blender.app` (for OBJ rips), `assimp` (`brew install assimp`, for DAE-only rips). FBX2glTF auto-installed via `pnpm install`.

## HTTPS for device testing

iOS Safari requires trusted HTTPS for camera + GPS + DeviceOrientation. `vite.config.ts` auto-picks up `certs/localhost+3.pem` when present (generate via `mkcert`). Otherwise tunnel with `cloudflared` or `ngrok`.

## Architecture

Single-page React 19 app, no backend. State lives in `localStorage` only — there is no server, no auth, no sync.

### Runtime split: map ↔ AR

The hunt experience (`/pokedex`) is one route that swaps between two rendering modes based on geo-distance to the nearest placed spawn:

- **≥ 20 m**: Leaflet map (`components/MapView`) — markers, user arrow.
- **< 20 m**: AR camera scene (`adapters/xr.ts`) — 8th Wall Engine Binary handles camera feed + SLAM, Three.js renders the `.glb` model anchored at a GPS lat/lng.
- **≤ catch radius** (default 10 m, per-spawn override allowed): shutter enabled.

Distance + heading drive both views via `hooks/useCompass` (wraps `adapters/compass.ts`, which fuses `navigator.geolocation` + `DeviceOrientationEvent`).

### AR layer (`src/features/ar/`, `adapters/xr.ts`)

- `xr.ts` boots the 8th Wall engine, creates a Three scene, and exposes the WebGL canvas. **Critical**: context is created with `preserveDrawingBuffer: true` so `features/photo.ts` can `toBlob` the canvas after a frame for the shutter PNG download.
- `features/ar/anchor.ts` converts the target spawn's lat/lng to a world-space position relative to the user; `model.ts` loads the `.glb`; `state.ts` holds the active target.

### Data model (`src/data/`)

One **generated** file; do not hand-edit:

- `pokemon.json` — PokeAPI `/pokemon/<id>` data, pruned to fields the app uses (`id`, `name`, `height`, `weight`, `types`, `stats`, `abilities`, `sprites.{front_default,showdown,official_artwork,home}`). Sorted by `id`. Written by `scripts/fetch-pokemon.mjs`. Model URL is derived from `name` — `pokemon.json` and `public/models/*.glb` are 1:1 because both are built from the same `models-downloads/` zip set.

And two hand-maintained:

- `placed.ts` — admin-placed coordinates, `localStorage` key `pokemon-hunt:placed`, shape `[{id, lat, lng}, …]`. `id` here means **dex#** (= `pokemon.json` entry's `id`).
- `found.ts` — caught spawn dex#s, `localStorage` key `pokemon-hunt:found`.

`spawns.ts` maps each `pokemon.json` entry to a `RosterEntry`: model URL `/models/<name>.glb`. Thumbnails prefer `sprites.showdown` (animated GIF) then `official_artwork` then `home` then `front_default`.

The **active hunt is the intersection** of `ROSTER` and admin placements. Unplaced creatures are invisible to players. `EmptyHunt` renders on `/pokedex` until at least one is placed.

**Adding more creatures**: drop the zip(s) under `models-downloads/<NNNN>_Name_xxx.zip`, then `pnpm fetch-pokemon && pnpm convert-models`. The convert script picks the "base form" FBX (skips Mega/Primal/Alola/Galar/Hisui/Paldea/Gmax variants), shortest name wins.

### Catch flow (`features/catch.ts`, `features/photo.ts`)

Tap shutter → flash overlay → `photo.ts` reads canvas to PNG and triggers a download → `catch.ts` marks the spawn `found`, picks the next target (nearest unfound placed spawn), updates HUD counter.

### Admin route

`/admin` is intentionally hidden — reached by long-press on the Header lens icon from `/pokedex` (`hooks/useLongPress`). Click map to drop, click marker to remove. "Reset all" wipes both `placed` and `found` keys.

## Conventions worth knowing

- **Path style**: ESM, `"type": "module"`. TypeScript strict. No path aliases — relative imports.
- **Styling**: SCSS modules (`*.module.scss`) co-located with components.
- **No state library**: hooks + `localStorage` wrappers in `core/storage.ts`. Don't reach for Redux/Zustand.
- **Geo math** lives in `core/geo-utils.ts` (haversine, bearing). Reuse from there rather than re-deriving.
- **Pokémon IP**: `public/models/` contains real Pokémon assets. Personal use only — do not redistribute, do not commit new assets to a public fork without thinking about it.
