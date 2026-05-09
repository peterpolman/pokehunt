// Catch flow: tap the on-screen creature, raycast against the model, mark
// found, banner + haptics, switch to next nearest target. Completion screen
// when all 21 are caught.

import * as THREE from 'three';
import { $ } from '../adapters/dom.ts';
import { arState, raycaster, resetCurrentModel } from './ar/state.ts';
import { SPAWNS } from '../data/spawns.ts';
import { flashScreen, showBanner, vibrateCatch, playSound } from '../adapters/ux.ts';
import type { Compass } from '../adapters/compass.ts';

export function onCanvasTap(e: PointerEvent, compass: Compass): void {
  const s = arState;
  if (!s.camera || !s.currentModel) return;
  const cs = compass.state();
  if (!cs.target || cs.distance === undefined || cs.distance > cs.target.catchRadius) return;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(ndc, s.camera);
  if (raycaster.intersectObject(s.currentModel, true).length === 0) return;

  catchCurrent(compass);
}

export function catchCurrent(compass: Compass): void {
  const t = compass.state().target;
  if (!t) return;
  flashScreen();
  vibrateCatch();
  playSound('catch');
  showBanner(`Caught ${t.name}!`, 2000);
  compass.markFound(t.id);
  resetCurrentModel();

  if (compass.found.size >= SPAWNS.length) {
    playSound('complete');
    showCompletion(compass);
    return;
  }

  const next = compass.state().target;
  if (next) {
    const d = compass.state().distance;
    const dStr = d === undefined ? '?' : `${Math.round(d)}m`;
    setTimeout(() => showBanner(`Next: ${next.name} — ${dStr} away`, 2200), 2100);
  }
}

function showCompletion(compass: Compass): void {
  const total = Math.round(compass.elapsed() / 1000);
  $('completion-time').textContent = `Time: ${Math.floor(total / 60)}m ${total % 60}s`;
  $('completion').classList.add('overlay-visible');
}

export function hideCompletion(): void {
  $('completion').classList.remove('overlay-visible');
}
