// Anchors the current target model in world space.
//
// Strategy:
//   - On target change: load model, place once at GPS distance.
//   - As user walks: SLAM tracks the camera; the model stays anchored.
//   - Re-anchor only when GPS-walked > REANCHOR_GPS_M to correct drift.
//   - Below SLAM_LOCK_M to the target, suspend GPS-based re-anchor (GPS
//     jitter near the catch radius causes visible teleports).

import * as THREE from 'three';
import { distanceMeters } from '../../core/geo-utils.ts';
import { arState, clock, resetCurrentModel } from './state.ts';
import { loadModel } from './model.ts';
import type { Compass } from '../../adapters/compass.ts';

const RENDER_DISTANCE = 25;
const REANCHOR_GPS_M = 10;
const SLAM_LOCK_M = 20;

/** Camera-local position from compass arrowAngle + GPS distance. -Z is forward. */
function localPos(arrowAngle: Degrees, distance: Meters): THREE.Vector3 {
  const r = (arrowAngle * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(r) * distance, 0, -Math.cos(r) * distance);
}

export async function syncCurrentModel(compass: Compass): Promise<void> {
  const s = arState;
  if (!s.scene || !s.camera) return;
  const cs = compass.state();
  const tgt = cs.target;

  // Use raw GPS distance for engine-side decisions (anchor/render) so the
  // SLAM-derived display override never feeds back into anchoring.
  const gpsDist =
    cs.position && tgt
      ? (distanceMeters(cs.position.lat, cs.position.lng, tgt.lat, tgt.lng) as Meters)
      : undefined;

  if (
    !tgt ||
    gpsDist === undefined ||
    gpsDist > RENDER_DISTANCE ||
    cs.arrowAngle === undefined
  ) {
    if (s.currentModel) resetCurrentModel();
    compass.setDistanceOverride(null, null);
    return;
  }

  // Target changed -> swap models. Claim id BEFORE await to prevent the
  // next frame's syncCurrentModel from starting a duplicate load.
  if (s.currentModelSpawnId !== tgt.id) {
    if (s.currentModel) s.scene.remove(s.currentModel);
    s.currentModel = null;
    s.mixer = null;
    s.anchoredForId = null;
    s.anchoredAtGps = null;
    const claimed = tgt.id;
    s.currentModelSpawnId = claimed;
    try {
      const m = await loadModel(claimed);
      // Bail on stale claim or concurrent fill.
      if (s.currentModelSpawnId !== claimed || s.currentModel) return;
      if (compass.state().target?.id !== claimed) return;
      s.scene.add(m);
      s.currentModel = m;
      s.mixer = (m.userData.mixer as THREE.AnimationMixer | undefined) ?? null;
    } catch (e) {
      console.warn('[hunt] model load failed', e);
      if (s.currentModelSpawnId === claimed) s.currentModelSpawnId = null;
      return;
    }
  }

  if (!s.currentModel) return;

  let needsAnchor = s.anchoredForId !== tgt.id;
  const slamLocked = gpsDist < SLAM_LOCK_M;
  if (!needsAnchor && !slamLocked && cs.position && s.anchoredAtGps) {
    const moved = distanceMeters(
      cs.position.lat, cs.position.lng,
      s.anchoredAtGps.lat, s.anchoredAtGps.lng,
    );
    if (moved > REANCHOR_GPS_M) needsAnchor = true;
  }

  if (needsAnchor) {
    const world = localPos(cs.arrowAngle, gpsDist);
    s.camera.localToWorld(world);
    // Snap to ground. SLAM world ground sits at y=0 because we seeded the
    // camera at (0, 1.6, 0) in xr.ts onStart. Without this the model floats
    // at the camera's y (eye height).
    world.y = 0;
    s.currentModel.position.copy(world);
    // Face the user once at anchor time so they see the model's front when
    // they arrive. Y-locked so it stands upright. After this we never
    // rotate again — user walks around a fixed model.
    if (!s.currentModel.userData.placeholder) {
      const cp = new THREE.Vector3();
      s.camera.getWorldPosition(cp);
      s.currentModel.lookAt(cp.x, world.y, cp.z);
    }
    s.anchoredForId = tgt.id;
    s.anchoredAtGps = cs.position ? { lat: cs.position.lat, lng: cs.position.lng } : null;
    s.anchoredWorldPos = world.clone();
    s.anchorCount++;
  }

  // Live SLAM-derived distance: camera world pos -> anchored model (XZ).
  // Walking toward the anchor shrinks this even when GPS is jittery.
  if (s.anchoredForId === tgt.id && s.anchoredWorldPos) {
    const cp = new THREE.Vector3();
    s.camera.getWorldPosition(cp);
    const dx = cp.x - s.anchoredWorldPos.x;
    const dz = cp.z - s.anchoredWorldPos.z;
    compass.setDistanceOverride(tgt.id, Math.hypot(dx, dz) as Meters);
  } else {
    compass.setDistanceOverride(null, null);
  }
}

/** Per-frame tick: animation mixer + placeholder spin. */
export function tickAr(): void {
  const s = arState;
  const dt = clock.getDelta();
  if (s.mixer) s.mixer.update(dt);
  if (s.currentModel?.userData.placeholder) {
    for (const ch of s.currentModel.children) {
      if (ch.userData.spin) ch.rotation.y += dt * 1.2;
    }
  }
}
