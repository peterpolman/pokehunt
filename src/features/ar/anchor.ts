// Anchors the current target model in world space.
//
// Strategy:
//   - On target change: load model, place once at GPS distance.
//   - As user walks: SLAM tracks the camera; the model stays anchored.
//   - Re-anchor only when GPS-walked > REANCHOR_GPS_M to correct drift.
//   - Below SLAM_LOCK_M to the target, suspend GPS-based re-anchor (GPS
//     jitter near the catch radius causes visible teleports).

import * as THREE from 'three';
import { distanceMeters, normalizeDeg } from '../../core/geo-utils.ts';
import { arState, clock, resetCurrentModel } from './state.ts';
import { getCachedModel, loadModel } from './model.ts';
import { createStandSpot, disposeStandSpot, tickStandSpot } from './standspot.ts';
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
    cs.rawArrowAngle === undefined
  ) {
    if (s.currentModel) resetCurrentModel();
    compass.setDistanceOverride(null, null);
    compass.setAngleOverride(null, null);
    return;
  }

  // Target changed -> swap models. Preload at session start primes the
  // cache, so the common path here is a synchronous cache hit (no await,
  // no race window where target ping-pong can strand the swap).
  if (s.currentModelSpawnId !== tgt.id) {
    const claimed = tgt.id;
    const cached = getCachedModel(claimed);
    if (cached) {
      if (s.currentModel) s.scene.remove(s.currentModel);
      disposeStandSpot();
      s.scene.add(cached);
      s.currentModel = cached;
      s.currentModelSpawnId = claimed;
      s.mixer =
        (cached.userData.mixer as THREE.AnimationMixer | undefined) ?? null;
      s.anchoredForId = null;
      s.anchoredAtGps = null;
    } else {
      // Cache miss (preload still in flight). Claim id BEFORE await to
      // prevent the next frame's syncCurrentModel from starting a duplicate
      // load. On stale claim after await we restore null so the next frame
      // re-evaluates against the actual current target.
      if (s.currentModel) s.scene.remove(s.currentModel);
      disposeStandSpot();
      s.currentModel = null;
      s.mixer = null;
      s.anchoredForId = null;
      s.anchoredAtGps = null;
      s.currentModelSpawnId = claimed;
      try {
        const m = await loadModel(claimed);
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
    const world = localPos(cs.rawArrowAngle, gpsDist);
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
      disposeStandSpot();
      const ring = createStandSpot(world, cp);
      s.scene.add(ring);
      s.currentStandSpot = ring;
    }
    s.anchoredForId = tgt.id;
    s.anchoredAtGps = cs.position ? { lat: cs.position.lat, lng: cs.position.lng } : null;
    s.anchoredWorldPos = world.clone();
    s.anchorCount++;
  }

  // Live SLAM-derived distance + angle: camera world pos -> anchored model.
  // Walking toward the anchor shrinks distance; turning rotates angle.
  // Both stay smooth even when GPS bearing wobbles at <5m.
  if (s.anchoredForId === tgt.id && s.anchoredWorldPos) {
    // Distance in world XZ — independent of camera tilt.
    const cp = new THREE.Vector3();
    s.camera.getWorldPosition(cp);
    const dx = cp.x - s.anchoredWorldPos.x;
    const dz = cp.z - s.anchoredWorldPos.z;
    compass.setDistanceOverride(tgt.id, Math.hypot(dx, dz) as Meters);
    // Angle in camera-local frame: matches the `localPos` convention used
    // for anchoring (0=forward, +90=right). atan2(x, -z) keeps tilt-handling
    // implicit because phone tilt rotates around camera-X, leaving local.x
    // unchanged for a target centered horizontally.
    const local = s.anchoredWorldPos.clone();
    s.camera.worldToLocal(local);
    const angle = normalizeDeg((Math.atan2(local.x, -local.z) * 180) / Math.PI);
    compass.setAngleOverride(tgt.id, angle);
  } else {
    compass.setDistanceOverride(null, null);
    compass.setAngleOverride(null, null);
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
  if (s.camera) tickStandSpot(s.camera);
}
