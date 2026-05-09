// Boot entry. Wires permissions, view-mode, AR pipeline, and UI bindings.
// Heavy lifting lives in features/ and adapters/.

import * as THREE from 'three';
import '../styles.css';
import { Compass } from './adapters/compass.ts';
import { showBanner, vibrateProximity, playSound } from './adapters/ux.ts';
import { attachMap } from './adapters/map.ts';
import { $, showFatal } from './adapters/dom.ts';
import { bootXR } from './adapters/xr.ts';
import { updateHud } from './features/hud.ts';
import { applyViewMode } from './features/view-mode.ts';
import { onCanvasTap, hideCompletion } from './features/catch.ts';

// 8th Wall reads window.THREE on init.
(window as any).THREE = THREE;


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
    showFatal(`Couldn't start: ${code}. Reload and grant permissions.`);
  };
}

function onStartTap(): void {
  $('start').classList.add('overlay-hidden');
  // Order matters: motion (iOS, gesture-required) -> geo prompt -> camera
  // (XR8). Compass.start() enforces the first two.
  compass
    .start()
    .then(() => {
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
