// GLB loader + colored-cube placeholder fallback.
// De-dupes concurrent loads (onUpdate runs every frame, so without
// in-flight de-dup you'd get duplicate Groups added to the scene).

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { SPAWNS } from '../../data/spawns.ts';

const PALETTE = [
  0xef4444, 0xf97316, 0xf59e0b, 0x84cc16, 0x10b981,
  0x06b6d4, 0x3b82f6, 0x8b5cf6, 0xec4899, 0xffffff,
];
// Cube + ring sized so the cube sits centred inside a 50%-wider ring.
const CUBE = 0.8;
const RING_OUT = (CUBE * 1.5) / 2;
const RING_IN = RING_OUT - 0.05;

const cache = new Map<number, THREE.Group>();
const inFlight = new Map<number, Promise<THREE.Group>>();
const loader = new GLTFLoader();

function buildPlaceholder(spawn: Spawn): THREE.Group {
  const g = new THREE.Group();
  const c = PALETTE[(spawn.id - 1) % PALETTE.length];

  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(CUBE, CUBE, CUBE),
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.1 }),
  );
  cube.position.y = CUBE / 2;

  // Spin pivot keeps the throw ring still while the cube rotates.
  const pivot = new THREE.Group();
  pivot.userData.spin = true;
  pivot.add(cube);
  g.add(pivot);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(RING_IN, RING_OUT, 48),
    new THREE.MeshBasicMaterial({
      color: c, side: THREE.DoubleSide,
      transparent: true, opacity: 0.85, depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  g.add(ring);

  g.scale.setScalar(spawn.scale);
  g.userData.placeholder = true;
  return g;
}

export function loadModel(id: number): Promise<THREE.Group> {
  const cached = cache.get(id);
  if (cached) return Promise.resolve(cached);
  const flight = inFlight.get(id);
  if (flight) return flight;

  const spawn = SPAWNS.find((s) => s.id === id);
  if (!spawn) return Promise.reject(new Error(`unknown spawn ${id}`));

  const p = new Promise<THREE.Group>((resolve) => {
    loader.load(
      spawn.model,
      (gltf: GLTF) => {
        const inner = gltf.scene;
        // FBX-converted GLBs often arrive Z-up; flip when Z extent dominates.
        const size = new THREE.Vector3();
        new THREE.Box3().setFromObject(inner).getSize(size);
        if (size.z > size.y * 1.5) inner.rotation.x = -Math.PI / 2;

        // Wrap so per-frame Y-locked lookAt on outer doesn't overwrite
        // the inner axis-correction rotation.
        const root = new THREE.Group();
        root.add(inner);
        root.scale.setScalar(spawn.scale);
        if (gltf.animations?.length) {
          const m = new THREE.AnimationMixer(inner);
          m.clipAction(gltf.animations[0]).play();
          root.userData.mixer = m;
        }
        cache.set(id, root);
        resolve(root);
      },
      undefined,
      () => {
        console.info(`[hunt] no .glb for #${id} (${spawn.name}), placeholder`);
        const ph = buildPlaceholder(spawn);
        cache.set(id, ph);
        resolve(ph);
      },
    );
  }).finally(() => inFlight.delete(id));
  inFlight.set(id, p);
  return p;
}
