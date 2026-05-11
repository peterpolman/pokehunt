// Roster + active spawns. ROSTER is built from pokemon.json (PokeAPI
// metadata, written by scripts/fetch-pokemon.mjs). Every entry's model URL
// is derived from `name` — pokemon.json and public/models/*.glb stay 1:1
// because both are built from the same models-downloads/ zip set.

import RAW from "./pokemon.json";
import { loadPlaced } from "./placed.ts";

interface PokeEntry {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  sprites: {
    front_default: string | null;
    showdown: string | null;
    official_artwork: string | null;
    home: string | null;
  };
}

const ENTRIES = RAW as unknown as PokeEntry[];

function thumbnail(e: PokeEntry): string {
  return (
    e.sprites.showdown ??
    e.sprites.official_artwork ??
    e.sprites.home ??
    e.sprites.front_default ??
    ""
  );
}

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

export interface RosterEntry {
  /** Same as PokéAPI id (national dex). Kept as `id` for placed/found APIs. */
  id: number;
  name: string;
  dex: number;
  model: string;
  image: string;
  scale: number;
  catchRadius: Meters;
}

export const ROSTER: RosterEntry[] = ENTRIES.map((e) => ({
  id: e.id,
  name: titleCase(e.name),
  dex: e.id,
  model: `/models/${e.name}.glb`,
  image: thumbnail(e),
  scale: 1.0,
  catchRadius: 10 as Meters,
}));

const ROSTER_BY_ID = new Map(ROSTER.map((r) => [r.id, r]));

export const SPAWNS: Spawn[] = loadPlaced()
  .map((p): Spawn | null => {
    const r = ROSTER_BY_ID.get(p.id);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      dex: r.dex,
      lat: p.lat,
      lng: p.lng,
      altitude: 0 as Meters,
      model: r.model,
      image: r.image,
      scale: r.scale,
      catchRadius: r.catchRadius,
    };
  })
  .filter((s): s is Spawn => s !== null);
