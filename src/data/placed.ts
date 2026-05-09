// Admin-placed spawn coordinates. Persisted in localStorage so the hunt
// runs against the curated subset chosen via /admin.

import { loadJSON, removeKey, saveJSON } from "../core/storage.ts";

export interface Placed {
  id: number;
  lat: number;
  lng: number;
}

const KEY = "pokemon-hunt:placed";

export function loadPlaced(): Placed[] {
  return loadJSON<Placed[]>(KEY, []);
}

export function savePlaced(placed: Placed[]): void {
  saveJSON(KEY, placed);
}

export function clearPlaced(): void {
  removeKey(KEY);
}
