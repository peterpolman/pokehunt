// Shared mutable AR state. Mutated by adapters/xr (onStart),
// features/ar/anchor (sync), and features/catch (on catch).

import * as THREE from 'three';

export interface ArState {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  renderer: THREE.WebGLRenderer | null;
  currentModel: THREE.Group | null;
  currentModelSpawnId: number | null;
  mixer: THREE.AnimationMixer | null;
  anchoredForId: number | null;
  anchoredAtGps: { lat: number; lng: number } | null;
  anchoredWorldPos: THREE.Vector3 | null;
  anchorCount: number;
  currentStandSpot: THREE.Mesh | null;
}

export const arState: ArState = {
  scene: null,
  camera: null,
  renderer: null,
  currentModel: null,
  currentModelSpawnId: null,
  mixer: null,
  anchoredForId: null,
  anchoredAtGps: null,
  anchoredWorldPos: null,
  anchorCount: 0,
  currentStandSpot: null,
};

export const clock = new THREE.Clock();
export const raycaster = new THREE.Raycaster();

/** Drop the current model and clear all per-target state. */
export function resetCurrentModel(): void {
  const s = arState;
  if (s.currentModel && s.scene) s.scene.remove(s.currentModel);
  s.currentModel = null;
  s.currentModelSpawnId = null;
  s.mixer = null;
  s.anchoredForId = null;
  s.anchoredAtGps = null;
  if (s.currentStandSpot) {
    if (s.scene) s.scene.remove(s.currentStandSpot);
    s.currentStandSpot.geometry.dispose();
    (s.currentStandSpot.material as THREE.Material).dispose();
    s.currentStandSpot = null;
  }
}
