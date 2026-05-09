// Catch flow — pure logic. UI side effects (banner, completion) are
// signalled via callbacks so the React tree owns them.

import type { Compass } from "../adapters/compass.ts";
import { resetCurrentModel } from "./ar/state.ts";
import { SPAWNS } from "../data/spawns.ts";

export interface CatchHandlers {
  onBanner: (text: string, durationMs?: number) => void;
  onComplete: (elapsedMs: number) => void;
  /** Called whenever catchCurrent succeeds — host can vibrate, play sound, etc. */
  onCaught: (spawnId: number) => void;
}

export function catchCurrent(compass: Compass, h: CatchHandlers): void {
  const t = compass.state().target;
  if (!t) return;
  h.onBanner(`Gevangen ${t.name}!`, 2000);
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
      () => h.onBanner(`Volgende: ${next.name} — ${dStr} verderop`, 2200),
      2100,
    );
  }
}
