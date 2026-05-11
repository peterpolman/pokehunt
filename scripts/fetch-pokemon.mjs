#!/usr/bin/env node
// Build src/data/pokemon.json from the zips in models-downloads/.
//
// For each zip with a NNNN_ prefix, fetch PokeAPI /pokemon/<dex> and write
// a pruned record. Parallel with a small concurrency cap to stay polite.
//
// Usage:
//   pnpm fetch-pokemon           # fetch every dex found in models-downloads/
//   pnpm fetch-pokemon 6 25 150  # fetch only these dex ids

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const ZIP_DIR = path.join(ROOT, "models-downloads");
const OUT = path.join(ROOT, "src/data/pokemon.json");
const CONCURRENCY = 10;

function dexIdsFromZips() {
  if (!fs.existsSync(ZIP_DIR)) return [];
  const ids = new Set();
  for (const f of fs.readdirSync(ZIP_DIR)) {
    if (!f.endsWith(".zip")) continue;
    const m = f.match(/^(\d{1,4})[_-]/);
    if (m) ids.add(Number(m[1]));
  }
  return [...ids].sort((a, b) => a - b);
}

async function fetchOne(dex) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${dex}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  // Prune sprites to `other` only — `versions` is a giant gen-by-gen history
  // we never use and would bloat the JSON ~10×.
  const other = j.sprites?.other ?? {};
  return {
    id: j.id,
    name: j.name,
    height: j.height,
    weight: j.weight,
    base_experience: j.base_experience,
    types: j.types.map((t) => t.type.name),
    stats: Object.fromEntries(j.stats.map((s) => [s.stat.name, s.base_stat])),
    abilities: j.abilities.map((a) => ({
      name: a.ability.name,
      is_hidden: a.is_hidden,
    })),
    sprites: {
      front_default: j.sprites?.front_default ?? null,
      showdown: other.showdown?.front_default ?? null,
      official_artwork: other["official-artwork"]?.front_default ?? null,
      home: other.home?.front_default ?? null,
    },
  };
}

async function runPool(tasks, limit) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (i < tasks.length) {
      const idx = i++;
      try {
        out[idx] = await tasks[idx]();
      } catch (e) {
        out[idx] = { __error: e.message };
      }
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const args = process.argv
    .slice(2)
    .map((a) => Number(a))
    .filter((n) => Number.isInteger(n) && n > 0);

  const targets = args.length > 0 ? args : dexIdsFromZips();
  if (targets.length === 0) {
    console.error(`No dex ids. Either drop zips in ${ZIP_DIR} or pass ids.`);
    process.exit(1);
  }

  console.log(`Fetching ${targets.length} pokémon (concurrency ${CONCURRENCY})...`);
  const results = await runPool(
    targets.map((dex) => () => fetchOne(dex).then((r) => ({ dex, r }))),
    CONCURRENCY,
  );

  const data = [];
  let failed = 0;
  for (const r of results) {
    if (r?.__error) {
      console.error(`FAIL ${r.__error}`);
      failed++;
      continue;
    }
    data.push(r.r);
  }
  data.sort((a, b) => a.id - b.id);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${data.length} entries → ${path.relative(ROOT, OUT)}  (${failed} failed)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
