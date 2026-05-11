// Animated floor ring placed beside the anchored pokemon — a "stand here"
// beacon. Lives as a scene-level sibling of currentModel so the pokemon's
// scale never affects it. Fades out as the user steps onto it (illusion of
// occlusion, since the AR camera feed has no real depth).

import * as THREE from 'three';
import { arState, clock } from './state.ts';

const RING_IN = 0.45;
const RING_OUT = 0.5;
const OFFSET = 0.5;
const PULSE_PERIOD = 1.5;
const PULSE_AMP = 0.075;
const ALPHA_BASE = 0.7;
const ALPHA_AMP = 0.2;
const FADE_NEAR = 0.15;
const FADE_FAR = 0.4;

/** Left direction (world) for an object that lookAt'd from `from`. */
function leftDirXZ(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3 {
  const fx = to.x - from.x;
  const fz = to.z - from.z;
  const len = Math.hypot(fx, fz) || 1;
  const nx = fx / len;
  const nz = fz / len;
  // 90° CCW around +Y: (x,z) -> (-z, x). That points to the pokemon's left
  // (its own left, screen-right when facing the camera). User asked for the
  // user's left of the camera-facing pokemon → screen-left → rotate 90° CW.
  // (x,z) -> (z, -x).
  return new THREE.Vector3(nz, 0, -nx);
}

export function createStandSpot(
  pokemonPos: THREE.Vector3,
  cameraPos: THREE.Vector3,
): THREE.Mesh {
  const geo = new THREE.RingGeometry(RING_IN, RING_OUT, 64);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: ALPHA_BASE,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;

  const left = leftDirXZ(cameraPos, pokemonPos);
  mesh.position.set(
    pokemonPos.x + left.x * OFFSET,
    0.005,
    pokemonPos.z + left.z * OFFSET,
  );
  return mesh;
}

export function disposeStandSpot(): void {
  const s = arState;
  if (!s.currentStandSpot) return;
  if (s.scene) s.scene.remove(s.currentStandSpot);
  s.currentStandSpot.geometry.dispose();
  (s.currentStandSpot.material as THREE.Material).dispose();
  s.currentStandSpot = null;
}

export function tickStandSpot(camera: THREE.PerspectiveCamera): void {
  const ring = arState.currentStandSpot;
  if (!ring) return;
  const t = clock.elapsedTime;
  const phase = (t * 2 * Math.PI) / PULSE_PERIOD;
  const s = 1 + PULSE_AMP * Math.sin(phase);
  ring.scale.set(s, s, 1);

  const baseAlpha = ALPHA_BASE + ALPHA_AMP * Math.sin(phase);

  const cp = new THREE.Vector3();
  camera.getWorldPosition(cp);
  const d = Math.hypot(cp.x - ring.position.x, cp.z - ring.position.z);
  const k = Math.min(1, Math.max(0, (d - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));

  (ring.material as THREE.MeshBasicMaterial).opacity = baseAlpha * k;
  ring.visible = k > 0;
}
