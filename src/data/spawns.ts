// Spawn definitions. ROSTER is the full pool of catchable creatures
// (metadata only). SPAWNS is the active hunt — derived at module load
// from the admin-placed coordinates in localStorage. Empty SPAWNS means
// no hunt is configured yet.

import { loadPlaced } from "./placed.ts";

type SpawnSeed = {
  id: number;
  name: string;
  /** Filename stem in /public/models/. */
  key: string;
  /** National Pokédex number. */
  dex: number;
  scale?: number;
  catchRadius?: number;
};

const SEEDS: SpawnSeed[] = [
  { id: 1, name: "Machoke", key: "machoke", dex: 67 },
  { id: 2, name: "Gengar", key: "gengar", dex: 94 },
  { id: 3, name: "Hypno", key: "hypno", dex: 97 },
  { id: 4, name: "Mr. Mime", key: "mr-mime", dex: 122, scale: 1.1 },
  { id: 5, name: "Nidoking", key: "nidoking", dex: 34, scale: 0.9 },
  { id: 6, name: "Onix", key: "onix", dex: 95 },
  { id: 7, name: "Wigglytuff", key: "wigglytuff", dex: 40, scale: 0.8 },
  { id: 8, name: "Manaphy", key: "manaphy", dex: 490, scale: 1.2 },
  { id: 9, name: "Froakie", key: "froakie", dex: 656 },
  { id: 10, name: "Sylveon", key: "sylveon", dex: 700 },
  { id: 11, name: "Cubone", key: "cubone", dex: 104 },
  { id: 12, name: "Corphish", key: "corphish", dex: 341 },
  { id: 13, name: "Sandshrew", key: "sandshrew", dex: 27 },
  { id: 14, name: "Trapinch", key: "trapinch", dex: 328 },
  { id: 15, name: "Gulpin", key: "gulpin", dex: 316 },
  { id: 16, name: "Treecko", key: "treecko", dex: 252 },
  { id: 17, name: "Gothitelle", key: "gothitelle", dex: 576 },
  { id: 18, name: "Gothorita", key: "gothorita", dex: 575 },
  { id: 19, name: "Typhlosion", key: "typhlosion", dex: 157 },
  { id: 20, name: "Rapidash", key: "rapidash", dex: 78 },
  { id: 21, name: "Wailord", key: "wailord", dex: 321 },
  { id: 22, name: "Charizard", key: "charizard", dex: 6 },
];

export interface RosterEntry {
  id: number;
  name: string;
  dex: number;
  model: string;
  image: string;
  scale: number;
  catchRadius: Meters;
}

export const ROSTER: RosterEntry[] = SEEDS.map((s) => ({
  id: s.id,
  name: s.name,
  dex: s.dex,
  model: `/models/${s.key}.glb`,
  image: `/models/${s.key}.png`,
  scale: s.scale ?? 1.0,
  catchRadius: (s.catchRadius ?? 10) as Meters,
}));

const ROSTER_BY_ID = new Map(ROSTER.map((r) => [r.id, r]));

export const SPAWNS: Spawn[] = loadPlaced()
  .map((p): Spawn | null => {
    const r = ROSTER_BY_ID.get(p.id);
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
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
