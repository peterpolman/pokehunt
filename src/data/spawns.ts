// Spawn definitions for the scavenger hunt.
//
// Editing for a different park:
//   1. Pick a centre point (right-click in Google Maps -> "What's here?").
//   2. Replace the lat/lng of each entry below. Aim for at least 50m spacing
//      between any pair so the AR view only shows one creature at a time.
//   3. Drop matching .glb + .png files in /public/models/ (filename = key).
//   4. `name` is shown in banners; keep it short.
//
// Defaults fill model + image from the lowercased key. Override per-spawn
// if needed (Mr. Mime's key is "mrmime", so its file is mrmime.glb).

type SpawnSeed = {
  id: number;
  name: string;
  key: string; // filename stem in /public/models/
  lat: number;
  lng: number;
  scale?: number; // default 1.0
  catchRadius?: number; // metres, default 10
};

const SEEDS: SpawnSeed[] = [
  { id: 1, name: "Machoke", key: "machoke", lat: 52.365551, lng: 4.8431344 },
  { id: 2, name: "Gengar", key: "gengar", lat: 52.367472, lng: 4.843385 },
  { id: 3, name: "Hypno", key: "hypno", lat: 52.366933, lng: 4.844268 },
  {
    id: 4,
    name: "Mr. Mime",
    key: "mr-mime",
    lat: 52.366394,
    lng: 4.843385,
    scale: 1.1,
  },
  {
    id: 5,
    name: "Nidoking",
    key: "nidoking",
    lat: 52.366933,
    lng: 4.842502,
    scale: 0.9,
  },
  { id: 6, name: "Onix", key: "onix", lat: 52.367472, lng: 4.844268 },
  {
    id: 7,
    name: "Wigglytuff",
    key: "wigglytuff",
    lat: 52.366394,
    lng: 4.844268,
    scale: 0.8,
  },
  {
    id: 8,
    name: "Manaphy",
    key: "manaphy",
    lat: 52.366394,
    lng: 4.842502,
    scale: 1.2,
  },
  { id: 9, name: "Froakie", key: "froakie", lat: 52.367472, lng: 4.842502 },
  { id: 10, name: "Sylveon", key: "sylveon", lat: 52.368011, lng: 4.843385 },
  { id: 11, name: "Cubone", key: "cubone", lat: 52.366933, lng: 4.84515 },
  { id: 12, name: "Corphish", key: "corphish", lat: 52.365855, lng: 4.843385 },
  { id: 13, name: "Sandshrew", key: "sandshrew", lat: 52.366933, lng: 4.84162 },
  { id: 14, name: "Trapinch", key: "trapinch", lat: 52.368011, lng: 4.844268 },
  { id: 15, name: "Gulpin", key: "gulpin", lat: 52.368011, lng: 4.842502 },
  { id: 16, name: "Treecko", key: "treecko", lat: 52.367472, lng: 4.84515 },
  {
    id: 17,
    name: "Gothitelle",
    key: "gothitelle",
    lat: 52.366394,
    lng: 4.84515,
  },
  {
    id: 18,
    name: "Gothorita",
    key: "gothorita",
    lat: 52.365855,
    lng: 4.844268,
  },
  {
    id: 19,
    name: "Typhlosion",
    key: "typhlosion",
    lat: 52.365855,
    lng: 4.842502,
  },
  { id: 20, name: "Rapidash", key: "rapidash", lat: 52.367472, lng: 4.84162 },
  { id: 21, name: "Wailord", key: "wailord", lat: 52.366394, lng: 4.84162 },
  {
    id: 22,
    name: "Charizard",
    key: "charizard",
    lat: 52.01347841182597,
    lng: 5.743685151685765,
  },
];

export const SPAWNS: Spawn[] = SEEDS.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lng: s.lng,
  altitude: 0 as Meters,
  model: `/models/${s.key}.glb`,
  image: `/models/${s.key}.png`,
  scale: s.scale ?? 1.0,
  catchRadius: (s.catchRadius ?? 10) as Meters,
}));
