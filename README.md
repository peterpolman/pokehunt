# Poké Safari

A location-based AR scavenger hunt. An admin places creatures on a map of your chosen area; players walk to each spot, line up the creature in their phone camera, snap a photo to catch it. The app starts on a map and switches to the AR camera automatically when the player is within range of a creature.

## Stack

- **React 19 + Vite + TypeScript** for the build and UI.
- **react-router-dom** for routing (`/home`, `/pokedex`, `/admin`).
- **Three.js** for AR rendering, **Leaflet** for the map view.
- **8th Wall Engine Binary** (open-source) for camera + SLAM tracking.
- **localStorage** as the persistence layer (no backend).
- Static deploy on Vercel.

## Project layout

```
src/
├── main.tsx                # boot, BrowserRouter
├── App.tsx                 # route table
├── core/                   # pure helpers + ambient types
├── data/
│   ├── spawns.ts           # roster (22 creatures + national dex#)
│   ├── placed.ts           # admin-placed coordinates (localStorage)
│   └── found.ts            # caught spawn ids (localStorage)
├── adapters/
│   ├── compass.ts          # GPS + DeviceOrientation
│   └── xr.ts               # 8th Wall + Three scene boot
├── features/
│   ├── ar/{state,anchor,model}.ts
│   ├── catch.ts            # catch flow (banner, mark found, next target)
│   └── photo.ts            # canvas → PNG download
├── pages/
│   ├── Home.tsx            # landing
│   ├── Pokedex.tsx         # the hunt experience
│   └── Admin.tsx           # spawn placement
├── components/             # Header, Footer, MapView, Hud, Shutter,
│                           # PokemonDialog, ConfirmDialog, EmptyHunt, …
└── hooks/                  # useCompass, useLongPress
public/models/              # .glb models + .png sprite icons
```

## Usage

```sh
pnpm install
pnpm dev          # vite dev server
pnpm build        # tsc --noEmit && vite build → dist/
pnpm preview      # serve dist/ locally
pnpm typecheck    # tsc only
```

### Local HTTPS

iOS Safari needs a trusted HTTPS cert for camera + GPS + motion sensors.
Two options:

**mkcert (LAN testing):**

```sh
brew install mkcert nss
mkcert -install
mkdir -p certs && cd certs
mkcert localhost 127.0.0.1 $(ipconfig getifaddr en0)
```

`vite.config.ts` picks up `certs/localhost+3.pem` automatically. Install
the mkcert root CA on your phone (Settings → General → About → Certificate
Trust Settings) so the cert is trusted.

**Public tunnel:**

```sh
cloudflared tunnel --url https://localhost:3000
# or
ngrok http https://localhost:3000
```

## Routes

- **`/home`** — landing screen.
- **`/pokedex`** — the hunt. Shows a map until the player is within range,
  then switches to the AR camera with a shutter button to catch.
- **`/admin`** — spawn placement. Click the map → pick a creature from the
  roster dialog → marker drops at that coordinate. Click a placed marker
  to remove it. "Reset all" wipes both placed coords and caught state.

The admin route is reachable via long-press on the blue Header lens from
`/pokedex`.

## Hunt flow

- The roster lives in code (`src/data/spawns.ts`). The active hunt is the
  subset the admin has placed; unplaced creatures don't appear.
- Players see an empty-state CTA on `/pokedex` until at least one creature
  is placed.
- Distance thresholds drive view + interaction state:
  - **≥ 20 m** → map view.
  - **< 20 m** → AR camera with HUD (compass arrow + sensor banners).
  - **≤ catch radius** (default 10 m) → shutter button enabled.
- Tapping the shutter triggers a flash, captures the WebGL canvas to PNG,
  downloads it to the device, and marks the creature caught. Caught state
  persists across reloads; map markers dim, the Header counter ticks up.

## Spawns + assets

- Roster + per-creature config (name, dex#, model key, scale, optional
  catch radius): `src/data/spawns.ts`.
- Models + sprites: `public/models/<key>.glb` and `<key>.png`. Filename
  stem matches the `key` field in the roster.
- Coordinates are not in code — the admin places them at runtime.

## Storage

All persistence is per-device in `localStorage`:

| Key                     | Shape                       | Purpose                  |
| ----------------------- | --------------------------- | ------------------------ |
| `pokemon-hunt:placed`   | `[{id, lat, lng}, …]`       | admin-placed spawn coords |
| `pokemon-hunt:found`    | `[id, …]`                   | caught creature ids       |

There is no backend; clearing browser data resets the hunt.

## Deploy (Vercel)

```sh
pnpm dlx vercel --prod
```

`vercel.json` pins pnpm install + build commands, adds an SPA rewrite for
client-side routing, and sets the `Permissions-Policy` header for camera +
geolocation + motion sensors.

## Notes

- Real Pokémon assets sit in `public/models/`. Fine for personal use; do
  not redistribute publicly — IP belongs to The Pokémon Company / Niantic.
- SLAM tracking on a stationary laptop webcam is degraded (no parallax).
  Map view + spawn placement still work.
- GPS accuracy outdoors is typically 5–15 m; the HUD surfaces a "weak GPS"
  banner when accuracy degrades past 20 m.
- The WebGL context is created with `preserveDrawingBuffer: true` so the
  shutter can read pixels off the canvas after each frame.
