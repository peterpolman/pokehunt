# Creature Hunt — Location-based AR scavenger hunt

Walk around a park, follow a virtual compass to GPS-anchored creatures, tap
each one through your camera to catch it. Map view shows where you are
relative to all spawns; auto-switches to AR camera when you're within 20 m
of the nearest creature.

Stack: **Vite + TypeScript**, **Three.js**, **Leaflet**, **8th Wall Engine
Binary** (open-source, no app key, no account). Models + sprite icons ship
from `public/models/`. Deploys to Vercel as a static site.

---

## 1. Setup

```sh
pnpm install
```

Pinned to `pnpm@10.6.5` via `packageManager`. Three.js + Leaflet are real
dependencies bundled by Vite. 8th Wall (`engine-binary`, `xrextras`) loads
from CDN at runtime.

## 2. Local dev

```sh
pnpm dev          # vite dev server, port 3000
```

iOS Safari **requires a trusted HTTPS cert** for camera + GPS + motion. Two
working setups:

### a. mkcert (recommended for local LAN)

```sh
brew install mkcert nss
mkcert -install
mkdir -p certs && cd certs
mkcert localhost 127.0.0.1 $(ipconfig getifaddr en0)
mv localhost+*.pem ./localhost+3.pem        # adjust to whatever mkcert wrote
mv localhost+*-key.pem ./localhost+3-key.pem
cd ..
```

Then **install the mkcert root CA on your phone** so it trusts the cert:

- iOS: AirDrop `$(mkcert -CAROOT)/rootCA.pem` to phone → install profile →
  **Settings → General → About → Certificate Trust Settings → enable mkcert**.
- Android: Copy as `rootCA.crt` → Settings → Security → Install certificate.

`vite.config.ts` picks up `certs/localhost+3.pem` automatically and serves
HTTPS. From your phone: `https://<your-mac-LAN-ip>:3000`.

### b. Public tunnel (zero phone config)

```sh
cloudflared tunnel --url https://localhost:3000   # free, no signup
# or
ngrok http https://localhost:3000
```

A real public cert; phone trusts it instantly.

The app's `enforceSecureContext()` check blocks startup if `window.isSecureContext`
is `false` and shows a clear message — easy to spot when the cert isn't
trusted.

## 3. Type checking

```sh
pnpm typecheck     # tsc --noEmit (also runs as part of pnpm build)
```

## 4. Build + preview

```sh
pnpm build         # tsc --noEmit && vite build → dist/
pnpm preview       # serve dist/ locally
```

## 5. Models + sprites

`public/models/` ships:

- 21 `.glb` files (geometry-only Pokémon converted from FBX/DAE rips)
- 21 `.png` sprite icons (Pokémon DB Scarlet/Violet style)

Adding a new spawn: drop `<key>.glb` + `<key>.png` in `public/models/` and
add a row to the `SEEDS` table in `src/data/spawns.ts`.

**Do not redistribute Pokémon assets publicly** — IP belongs to The Pokémon
Company / Niantic. Fine for local play / portfolio screenshots, not for
hosting.

## 6. Coordinates

Edit `src/data/spawns.ts`. Default cluster: Staalmeesterslaan 342, Amsterdam.
Pairwise spacing ≥ 50 m so AR mode only ever shows one creature at a time.
Use Google Maps right-click → *What's here?* to grab lat/lng.

## 7. URL parameters

| Param     | Behaviour |
|----------:|-----------|
| `?here=1` | Use the real GPS coords from `src/data/spawns.ts` (deployed mode). |
| *(none)*  | After your first GPS fix, drop the 21 spawns in a multi-ring layout around you (inner ring 25 m, outer rings 60 m+) for indoor / away-from-site testing. Spacing keeps AR single-creature. |

## 8. View modes

- **Distance < 20 m** → AR camera. Tap creature in catch radius to catch.
- **Distance ≥ 20 m** → full-screen map. Sprite markers at each spawn,
  blue dot with heading arrow at your position, distance pill on top.
- Camera (XR8) keeps running underneath; toggling never re-prompts perms.

## 9. Architecture

Feature + adapter layout. Pure logic in `core/`, static data in `data/`,
browser/3rd-party wrappers in `adapters/`, domain logic in `features/`:

```
src/
├── app.ts                    # boot
├── core/
│   ├── geo-utils.ts          # haversine, bearing, angles
│   └── types.d.ts            # ambient: XR8, Spawn, Meters, etc.
├── data/spawns.ts            # 21 spawn table + ring generator
├── adapters/
│   ├── compass.ts            # GPS + DeviceOrientation
│   ├── map.ts                # Leaflet
│   ├── xr.ts                 # 8th Wall + Three scene boot
│   ├── ux.ts                 # haptics, banner, sounds
│   └── dom.ts                # $ helper + showFatal
└── features/
    ├── ar/
    │   ├── state.ts          # shared mutable AR state
    │   ├── anchor.ts         # syncCurrentModel + tickAr
    │   └── model.ts          # GLB loader + placeholder
    ├── catch.ts              # raycast + catch flow
    ├── hud.ts                # AR HUD update
    └── view-mode.ts          # ar↔map at 20 m
```

## 10. Deployment (Vercel)

Project is auto-detected as Vite. Either CLI or GitHub-connected.

```sh
pnpm dlx vercel --prod
```

`vercel.json` pins `installCommand: pnpm install --frozen-lockfile` and
`buildCommand: pnpm build`. Permissions-Policy header opens up camera,
geolocation, motion sensors. Vercel domains use real HTTPS so the phone
trusts the cert — recommended for any non-local testing.

## 11. The 8th Wall transition

The hosted 8thwall.com platform — XR Studio, the cloud editor, account-bound
app keys — was decommissioned 2026-02-28. The engine and helpers are now
open-source at <https://8thwall.org> and <https://github.com/8thwall/8thwall>.

What this project does:

- **No app key.** Engine Binary loaded from jsDelivr:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js"
          async crossorigin="anonymous" data-preload-chunks="slam"></script>
  ```
- **No `LandingPage` module** — it was the desktop-blocker that showed a QR
  code instead of running. Skipped here, so laptops can run the camera +
  map view too (`allowedDevices: 'any'` passed to `XR8.run`).
- **No cloud features.** VPS / Niantic Maps, hand tracking, anything
  requiring a Niantic licence isn't available in the open binary. SLAM,
  image targets, face effects, sky effects all work.

## 12. Limitations

- **GPS accuracy** outdoors is typically 5–15 m; trees / buildings / cloud
  cover push it past 20 m. The app surfaces a "Weak GPS signal" banner and
  keeps running.
- **Compass calibration** drifts on every phone. App shows a figure-8
  calibration prompt automatically when heading variance spikes.
- **Heading source.** iOS Safari gives true-north heading directly via
  `webkitCompassHeading`. Android Chrome uses `deviceorientationabsolute`.
  A few browsers only expose the *relative* event — in that case the compass
  drifts. Surface visible in the calibration banner.
- **SLAM tracking on a stationary laptop webcam is poor** — no parallax,
  few features. Map view + spawn markers still work; AR is wonky.
- **IP / legal.** This project uses real Pokémon assets locally for testing.
  Don't ship them publicly — Niantic and The Pokémon Company are aggressive
  about IP.
