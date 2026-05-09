// Caught spawn IDs. Persisted in localStorage so progress survives reloads.

import { loadJSON, removeKey, saveJSON } from "../core/storage.ts";

const KEY = "pokemon-hunt:found";

export function loadFound(): number[] {
  return loadJSON<number[]>(KEY, []);
}

export function saveFound(ids: number[]): void {
  saveJSON(KEY, ids);
}

export function clearFound(): void {
  removeKey(KEY);
}
