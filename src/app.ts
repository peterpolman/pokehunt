// Boot entry. Wires permissions, view-mode, AR pipeline, and UI bindings.
// Heavy lifting lives in features/ and adapters/.

import * as THREE from 'three';
import '../styles.css';
import { Compass } from './adapters/compass.ts';
import { generateRingAround } from './data/spawns.ts';
import { showBanner, vibrateProximity, playSound } from './adapters/ux.ts';
import { attachMap } from './adapters/map.ts';
import { $, showFatal } from './adapters/dom.ts';
import { bootXR } from './adapters/xr.ts';
import { updateHud } from './features/hud.ts';
import { applyViewMode } from './features/view-mode.ts';
import { onCanvasTap, hideCompletion } from './features/catch.ts';

// 8th Wall reads window.THREE on init.
(window as any).THREE = THREE;

const params = new URLSearchParams(location.search);
// `?here=1` uses the GPS coords from data/spawns.ts. Without it, a fresh
// ring is generated around the user's current position so the hunt is
// testable anywhere.
const USE_GPS_SPAWNS = params.get('here') === '1';

// HTTPS + trusted cert required for camera + sensors on iOS Safari.
// `window.isSecureContext` is the browser's authoritative answer — it's
// false on http, AND on https with a self-signed cert that the device's
// trust store doesn't recognise (the most common LAN-IP-on-phone case).
(function enforceSecureContext() {
  const isLocalhost =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isLocalhost) return; // localhost is always a secure context
  if (!window.isSecureContext) {
    showFatal(
      `This page isn't a secure context (${location.protocol}//${location.hostname}). ` +
      `Geolocation + motion sensors will be denied silently. Use https with a ` +
      `trusted cert: install the mkcert root CA on the device, or use a public ` +
      `tunnel (ngrok / cloudflared / Vercel preview URL).`
    );
    throw new Error('insecure-context');
  }
})();

const compass = new Compass();
const mapHandle = attachMap(compass);

function wireCompass(): void {
  compass.onUpdate = (s) => {
    updateHud(s);
    applyViewMode(s.distance, mapHandle);
    mapHandle.refresh();
  };
  compass.onEnterRadius = (spawn) => {
    vibrateProximity();
    playSound('enterRadius');
    showBanner(`${spawn.name} is right here — look around with your camera!`, 1800);
  };
  compass.onLeaveRadius = (spawn) => {
    showBanner(`${spawn.name} slipped away — get closer.`, 1500);
  };
  compass.onError = (code) => {
    if (code === 'motion-denied')
      showFatal('Motion access is needed for the compass. Reload and tap Allow.');
    else if (code === 'geolocation-denied')
      showFatal('Location access denied. Browser settings → Site settings → enable Location, then reload.');
    else if (code === 'geolocation-unavailable')
      showFatal('Phone reports location unavailable. Check that Location Services are on and the browser has permission.');
    else if (code === 'geolocation-timeout')
      showFatal('GPS timed out. Move outdoors and reload.');
    else if (code === 'geolocation-missing')
      showFatal('Geolocation isn\'t available on this device.');
  };
}

function onStartTap(): void {
  $('start').classList.add('overlay-hidden');
  // Order matters: motion (iOS, gesture-required) -> geo prompt -> camera
  // (XR8). Compass.start() enforces the first two.
  compass
    .start()
    .then(() => {
      if (!USE_GPS_SPAWNS && compass.position) {
        generateRingAround(compass.position.lat, compass.position.lng);
        compass.target = null;
        showBanner('Creatures placed around you', 2000);
      }
      wireCompass();
      bootXR(compass);
    })
    .catch((e: unknown) => {
      console.warn('[hunt] start failed', e);
      const overlay = $('error');
      if (!overlay.classList.contains('overlay-visible')) {
        showFatal('Couldn\'t start the hunt. Check your permissions and reload.');
      }
    });
}

let uiBound = false;
function bindUi(): void {
  if (uiBound) return;
  uiBound = true;
  $('start-button').addEventListener('click', onStartTap);
  $('completion-replay').addEventListener('click', () => {
    compass.reset();
    hideCompletion();
  });
  $('reload-button').addEventListener('click', () => location.reload());
  $('camerafeed').addEventListener('pointerdown', (e) => onCanvasTap(e as PointerEvent, compass));
}

// XR8 fires `xrloaded` once the engine binary is ready. Bind on either
// xrloaded or DOMContentLoaded — whichever fires first — so the start
// screen is interactive even before the engine finishes streaming. The
// uiBound guard makes this idempotent.
if (typeof XR8 !== 'undefined') {
  bindUi();
} else {
  window.addEventListener('xrloaded', bindUi);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUi, { once: true });
  } else {
    bindUi();
  }
}
