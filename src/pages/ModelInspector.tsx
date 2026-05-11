// Dev-only QA page: paginates ROSTER into 5×5 grids so we can spot
// wrong-axis / on-its-side .glb's at a glance. Reachable via /admin/models.
//
// Reuses no part of features/ar/model.ts on purpose: the AR loader has
// fallbacks (placeholder cube on failure, animation mixer) tuned for
// gameplay. Inspector wants the opposite — fail loud, no animation noise.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ROSTER, type RosterEntry } from "../data/spawns.ts";
import s from "./ModelInspector.module.scss";

const COLS = 5;
const ROWS = 5;
const PER_PAGE = COLS * ROWS;
const SPACING = 2.2;
const DISC_RADIUS = 0.6;
const TARGET_SIZE = 1.0; // models normalized so longest axis = 1m

type Fit = { scale: number; offset: THREE.Vector3 };
type Tile = {
  entry: RosterEntry;
  group: THREE.Group;
};

function fitFor(rotator: THREE.Group): Fit {
  const box = new THREE.Box3().setFromObject(rotator);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = TARGET_SIZE / maxDim;
  return {
    scale,
    offset: new THREE.Vector3(
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    ),
  };
}

function applyFit(normalizer: THREE.Group, fit: Fit) {
  normalizer.scale.setScalar(fit.scale);
  normalizer.position.copy(fit.offset);
}

function gridPosition(col: number, row: number): THREE.Vector3 {
  const x = (col - (COLS - 1) / 2) * SPACING;
  const z = (row - (ROWS - 1) / 2) * SPACING;
  return new THREE.Vector3(x, 0, z);
}

function buildDisc(): THREE.Mesh {
  const geom = new THREE.CircleGeometry(DISC_RADIUS, 48);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x222a38,
    roughness: 0.9,
    metalness: 0.0,
  });
  const m = new THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.001;
  return m;
}

function buildErrorMarker(): THREE.Mesh {
  const geom = new THREE.CircleGeometry(DISC_RADIUS * 0.85, 48);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geom, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.002;
  return m;
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
}

export function ModelInspector() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(0);
  const [tileStatus, setTileStatus] = useState<
    Record<number, "loading" | "ok" | "error">
  >({});

  const totalPages = Math.max(1, Math.ceil(ROSTER.length / PER_PAGE));
  const pageEntries = useMemo(
    () => ROSTER.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE),
    [page],
  );

  // Three.js stable refs (created once, reused across page changes).
  const sceneRef = useRef<THREE.Scene | null>(null);
  const tilesRef = useRef<Tile[]>([]);

  // One-time renderer/scene/camera setup.
  useEffect(() => {
    const container = containerRef.current!;
    const canvas = canvasRef.current!;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight, false);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f17);
    sceneRef.current = scene;

    // Match AR lighting (xr.ts:25-26).
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(2, 5, 3);
    scene.add(dir);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    camera.position.set(0, 9, 12);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.update();

    let raf = 0;
    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      updateLabelPositions(camera, renderer, tilesRef.current, labelsRef.current);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      for (const tile of tilesRef.current) {
        scene.remove(tile.group);
        disposeGroup(tile.group);
      }
      tilesRef.current = [];
      sceneRef.current = null;
    };
  }, []);

  // Per-page: tear down previous tiles, build new tiles, kick loads.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove + dispose prior tiles.
    for (const tile of tilesRef.current) {
      scene.remove(tile.group);
      disposeGroup(tile.group);
    }
    tilesRef.current = [];

    const tiles: Tile[] = pageEntries.map((entry, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const g = new THREE.Group();
      g.position.copy(gridPosition(col, row));
      g.add(buildDisc());
      scene.add(g);
      return { entry, group: g };
    });
    tilesRef.current = tiles;

    setTileStatus(
      Object.fromEntries(pageEntries.map((e) => [e.id, "loading"])),
    );

    // Track cancellation so loads finishing after a page switch don't
    // mutate the wrong scene.
    let cancelled = false;
    const loader = new GLTFLoader();

    for (const tile of tiles) {
      loader.load(
        tile.entry.model,
        (gltf: GLTF) => {
          if (cancelled) return;
          const normalizer = new THREE.Group();
          normalizer.add(gltf.scene);
          applyFit(normalizer, fitFor(normalizer));
          tile.group.add(normalizer);
          setTileStatus((prev) => ({ ...prev, [tile.entry.id]: "ok" }));
        },
        undefined,
        () => {
          if (cancelled) return;
          tile.group.add(buildErrorMarker());
          setTileStatus((prev) => ({ ...prev, [tile.entry.id]: "error" }));
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [pageEntries]);

  const canPrev = page > 0;
  const canNext = page < totalPages - 1;

  return (
    <div className={s.root} ref={containerRef}>
      <div className={s.bar}>
        <Link to="/admin">← Admin</Link>
        <button
          disabled={!canPrev}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          ← Prev
        </button>
        <span>
          Page {page + 1} / {totalPages} · {ROSTER.length} models
        </span>
        <button
          disabled={!canNext}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        >
          Next →
        </button>
      </div>
      <canvas className={s.canvas} ref={canvasRef} />
      <div className={s.labels} ref={labelsRef}>
        {pageEntries.map((entry) => {
          const status = tileStatus[entry.id] ?? "loading";
          return (
            <div
              key={entry.id}
              data-tile-id={entry.id}
              className={`${s.label}${status === "error" ? " " + s.error : ""}`}
            >
              <div>{entry.name}</div>
              <div className={s.dex}>#{entry.dex}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function updateLabelPositions(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  tiles: Tile[],
  host: HTMLDivElement | null,
) {
  if (!host) return;
  const size = renderer.getSize(new THREE.Vector2());
  const w = size.x;
  const h = size.y;
  const ndc = new THREE.Vector3();
  const labelOffset = new THREE.Vector3(0, -0.1, 0);

  for (const tile of tiles) {
    const el = host.querySelector<HTMLDivElement>(
      `[data-tile-id="${tile.entry.id}"]`,
    );
    if (!el) continue;
    ndc.copy(tile.group.position).add(labelOffset).project(camera);
    const x = (ndc.x * 0.5 + 0.5) * w;
    const y = (1 - (ndc.y * 0.5 + 0.5)) * h;
    el.style.left = `${x}px`;
    el.style.top = `${y + 6}px`;
    el.style.display = ndc.z > 1 ? "none" : "";
  }
}
