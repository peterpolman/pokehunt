// Catch flow — pure logic. UI side effects (banner, completion) are
// signalled via callbacks so the React tree owns them.

import * as THREE from "three";
import type { Compass } from "../adapters/compass.ts";
import { arState, raycaster, resetCurrentModel } from "./ar/state.ts";
import { SPAWNS } from "../data/spawns.ts";

interface CatchHandlers {
  onBanner: (text: string, durationMs?: number) => void;
  onComplete: (elapsedMs: number) => void;
  /** Called whenever catchCurrent succeeds — host can vibrate, play sound, etc. */
  onCaught: (spawnId: number) => void;
}

export function attachCanvasTap(
  canvas: HTMLCanvasElement,
  compass: Compass,
  handlers: CatchHandlers,
): () => void {
  const onTap = (e: PointerEvent) => {
    const s = arState;
    if (!s.camera || !s.currentModel) return;
    const cs = compass.state();
    if (
      !cs.target ||
      cs.distance === undefined ||
      cs.distance > cs.target.catchRadius
    )
      return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, s.camera);
    if (raycaster.intersectObject(s.currentModel, true).length === 0) return;

    catchCurrent(compass, handlers);
  };
  canvas.addEventListener("pointerdown", onTap);
  return () => canvas.removeEventListener("pointerdown", onTap);
}

export function catchCurrent(compass: Compass, h: CatchHandlers): void {
  const t = compass.state().target;
  if (!t) return;
  h.onBanner(`Caught ${t.name}!`, 2000);
  compass.markFound(t.id);
  resetCurrentModel();
  h.onCaught(t.id);

  if (compass.found.size >= SPAWNS.length) {
    h.onComplete(compass.elapsed());
    return;
  }

  const next = compass.state().target;
  if (next) {
    const d = compass.state().distance;
    const dStr = d === undefined ? "?" : `${Math.round(d)}m`;
    setTimeout(
      () => h.onBanner(`Next: ${next.name} — ${dStr} away`, 2200),
      2100,
    );
  }
}
