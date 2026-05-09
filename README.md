# Creature Hunt

A location-based AR scavenger hunt. Walk around an outdoor area, follow a
compass to GPS-anchored creatures, tap each one through your phone's camera
to catch it. The app shows a map when no creature is nearby and switches to
the AR camera automatically when you're within 20 m of one.

## Stack

- **Vite + TypeScript** for the build.
- **Three.js** for AR rendering, **Leaflet** for the map view.
- **8th Wall Engine Binary** (open-source) for camera + SLAM tracking.
- Static deploy on Vercel.

## Project layout

```
src/
├── app.ts                # boot
├── core/                 # pure helpers + ambient types
├── data/spawns.ts        # spawn table + ring generator
├── adapters/             # browser / 3rd-party wrappers
│   ├── compass.ts        # GPS + DeviceOrientation
│   ├── map.ts            # Leaflet
│   ├── xr.ts             # 8th Wall + Three scene boot
│   ├── ux.ts             # haptics, banner, sounds
│   └── dom.ts
└── features/             # domain logic
    ├── ar/{state,anchor,model}.ts
    ├── catch.ts
    ├── hud.ts
    └── view-mode.ts
public/models/            # 21 .glb models + 21 .png sprite icons
```

## Usage

```sh
pnpm install
pnpm dev          # vite dev server, port 3000
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

The app's secure-context check blocks startup with a clear error if the cert
is untrusted.

## Spawns + assets

- Coordinates and per-spawn config: `src/data/spawns.ts`. Pairwise distance
  is kept ≥ 50 m so AR mode shows one creature at a time.
- Models + sprites: `public/models/<key>.glb` and `<key>.png`. Filename stem
  matches the `key` field in the spawn table.

## View modes

- **< 20 m** → AR camera, tap the creature in the catch radius to catch.
- **≥ 20 m** → full-screen map, sprite markers per spawn, blue dot with
  heading arrow at your position, distance pill on top.

The XR8 camera stream stays alive across mode switches, so toggling never
re-prompts for permissions.

## Deploy (Vercel)

```sh
pnpm dlx vercel --prod
```

`vercel.json` pins pnpm install + build commands and sets the
`Permissions-Policy` header for camera + geolocation + motion.

## Notes

- Real Pokémon assets sit in `public/models/`. Fine for personal use; do
  not redistribute publicly — IP belongs to The Pokémon Company / Niantic.
- SLAM tracking on a stationary laptop webcam is degraded (no parallax).
  Map view + spawn markers still work.
- GPS accuracy outdoors is typically 5–15 m; the app shows a "Weak GPS
  signal" banner when accuracy degrades past 20 m.
