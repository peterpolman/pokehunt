#!/usr/bin/env node
// Convert FBX rips in models-downloads/*.zip into public/models/<name>.glb,
// where <name> is the pokeapi `name` (lowercase, hyphenated).
//
// Picks the "base form" FBX in each zip (excludes Mega/Primal/Alola/Galar/
// Hisui/Paldea/Gmax variants), shortest filename wins.
//
// Usage:
//   pnpm convert-models           # convert every zip with a known dex
//   pnpm convert-models 6 25 150  # convert only these dex ids
//   pnpm convert-models --force   # rebuild even if .glb already exists

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const ZIP_DIR = path.join(ROOT, "models-downloads");
const DST = path.join(ROOT, "public/models");
const POKEMON_JSON = path.join(ROOT, "src/data/pokemon.json");
const FBX2GLTF = path.join(
  ROOT,
  "node_modules/@robertlong/fbx2gltf/bin/Darwin/FBX2glTF",
);
const BLENDER = "/Applications/Blender.app/Contents/MacOS/Blender";
const BLENDER_PY = path.join(ROOT, "scripts/blender-convert.py");

const VARIANT_RE = /mega|primal|alola|galar|hisui|paldea|gmax/i;
const SUPPORTED_EXT = /\.(fbx|obj|dae)$/i;

const PY_UNZIP = `
import zipfile, os, sys
z = zipfile.ZipFile(sys.argv[1])
out = sys.argv[2]
for info in z.infolist():
    name = info.filename
    try:
        name = name.encode('cp437').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    target = os.path.join(out, name.replace('/', os.sep))
    if info.is_dir():
        os.makedirs(target, exist_ok=True)
    else:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(info) as s, open(target, 'wb') as d:
            d.write(s.read())
`;

function loadDexNameMap() {
  if (!fs.existsSync(POKEMON_JSON)) {
    throw new Error(
      `${POKEMON_JSON} not found — run \`pnpm fetch-pokemon\` first`,
    );
  }
  const data = JSON.parse(fs.readFileSync(POKEMON_JSON, "utf8"));
  return new Map(data.map((p) => [p.id, p.name]));
}

function indexDiffuseTextures(assetDir) {
  const all = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(png|jpe?g)$/i.test(e.name)) all.push(p);
    }
  })(assetDir);
  // Filter out auxiliary maps so we never assign a normal/id map as diffuse.
  const AUX = /(Id|Nor|Mask|Alpha|Env|Spc|Spec|_id|_nor|_mask)\.(png|jpe?g)$/i;
  return all.filter((p) => !AUX.test(path.basename(p)));
}

function fuzzyTextureMatch(matName, candidates) {
  // Extract a body-part token: BodyA, BodyB, ..., Body, Eye, Iris, Mouth, Tongue, Fin, Wing...
  // Then prefer files whose basename matches "<part>1.png" over plain "<part>.png".
  const cleaned = matName.replace(/[^A-Za-z0-9]/g, " ");
  // No trailing \b — material names often glue extra suffixes onto the part
  // token (e.g. BodyABaivanilla_Ice_mat → BodyA).
  const partRe = /\b(Body[A-Z]|Body|Eye[1-9]?|Iris[1-9]?|Mouth|Tongue|Fin|Wing|Claw|Tail|Head|Horn|Hair|Spike|Cloth|Cap)/i;
  const m = cleaned.match(partRe);
  if (!m) return null;
  const part = m[1];
  // Score: starts-with body-part wins, prefer "<part>1" then "<part>".
  const scored = candidates
    .map((p) => {
      const stem = path.basename(p).replace(/\.(png|jpe?g)$/i, "");
      const idx = stem.toLowerCase().indexOf(part.toLowerCase());
      if (idx < 0) return null;
      // Score lower = better. Bonus for being "<prefix><part>1".
      const after = stem.slice(idx + part.length);
      const score =
        (after.startsWith("1") ? 0 : 1) +
        (after === "" ? 0 : 0.5) +
        idx * 0.01;
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score);
  return scored.length > 0 ? scored[0].p : null;
}

function flattenTexturesNextTo(fbxPath, allFiles) {
  const dir = path.dirname(fbxPath);
  for (const f of allFiles) {
    if (!/\.png$/i.test(f) && !/\.jpg$/i.test(f)) continue;
    const name = path.basename(f);
    const target = path.join(dir, name);
    if (target === f) continue;
    if (fs.existsSync(target)) continue;
    try {
      fs.copyFileSync(f, target);
    } catch {}
  }
}

function remapMaterialsToTextures(glbPath, assetDir) {
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8"));
  const binChunkStart = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binChunkStart);
  const binData = buf.subarray(binChunkStart + 8, binChunkStart + 8 + binLen);

  if (!json.materials) return;

  // Parse material names like "assets_textures_pm0594_00_Body1-material-material"
  // and "<name>-material-material" → texture stem.
  const stemRe = /(?:assets_textures_)?([A-Za-z0-9_\-]+?)(?:-material)+/i;
  // Index of every diffuse-looking PNG in the asset dir, by lowercased basename
  // (without extension). Excludes Id / Nor / Mask / Env / Alpha auxiliary maps.
  const assetIndex = indexDiffuseTextures(assetDir);
  const newChunks = [binData];
  let cursor = binLen;
  // texFile basename → image index in json.images
  const imgIndexByName = new Map();
  let changed = false;

  for (const mat of json.materials) {
    let file = null;
    const m = mat.name?.match(stemRe);
    if (m) {
      const stem = m[1];
      for (const c of [`${stem}.png`, `${stem}.jpg`]) {
        file = findFileByName(assetDir, c);
        if (file) break;
      }
    }
    if (!file) file = fuzzyTextureMatch(mat.name ?? "", assetIndex);
    if (!file) continue;
    const base = path.basename(file);

    let imgIdx = imgIndexByName.get(base);
    if (imgIdx === undefined) {
      const data = fs.readFileSync(file);
      const pad = (4 - (cursor % 4)) % 4;
      if (pad > 0) {
        newChunks.push(Buffer.alloc(pad));
        cursor += pad;
      }
      const bvIdx = (json.bufferViews ||= []).length;
      json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: data.length });
      newChunks.push(data);
      cursor += data.length;
      imgIdx = (json.images ||= []).length;
      json.images.push({
        name: base,
        bufferView: bvIdx,
        mimeType: /\.jpe?g$/i.test(base) ? "image/jpeg" : "image/png",
      });
      imgIndexByName.set(base, imgIdx);
      changed = true;
    }

    // Find or create a texture pointing at this image.
    let texIdx = (json.textures || []).findIndex((t) => t.source === imgIdx);
    if (texIdx < 0) {
      texIdx = (json.textures ||= []).length;
      json.textures.push({ source: imgIdx, sampler: 0 });
      if (!json.samplers) json.samplers = [{}];
    }

    const pbr = (mat.pbrMetallicRoughness ||= {});
    if (!pbr.baseColorTexture || pbr.baseColorTexture.index !== texIdx) {
      pbr.baseColorTexture = { index: texIdx, texCoord: 0 };
      changed = true;
    }
  }

  // Drop any unused 1x1 placeholder images to keep file small.
  // (Optional cleanup; safe to skip if it'd shift indices.)

  if (!changed) return;

  json.buffers = json.buffers || [{ byteLength: 0 }];
  json.buffers[0].byteLength = cursor;
  if (json.buffers[0].uri) delete json.buffers[0].uri;

  let newJson = JSON.stringify(json);
  while (newJson.length % 4 !== 0) newJson += " ";
  const newBin = Buffer.concat(newChunks);
  const binPad = (4 - (newBin.length % 4)) % 4;
  const binPadded = binPad === 0 ? newBin : Buffer.concat([newBin, Buffer.alloc(binPad)]);

  const totalLen = 12 + 8 + newJson.length + 8 + binPadded.length;
  const out = Buffer.alloc(totalLen);
  out.writeUInt32LE(0x46546c67, 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(newJson.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  out.write(newJson, 20, "utf8");
  const binHdr = 20 + newJson.length;
  out.writeUInt32LE(binPadded.length, binHdr);
  out.writeUInt32LE(0x004e4942, binHdr + 4);
  binPadded.copy(out, binHdr + 8);
  fs.writeFileSync(glbPath, out);
}

function embedExternalTextures(glbPath, assetDir) {
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const jsonChunkStart = 20;
  const json = JSON.parse(
    buf.subarray(jsonChunkStart, jsonChunkStart + jsonLen).toString("utf8"),
  );
  const binChunkStart = jsonChunkStart + jsonLen;
  const binLen = buf.readUInt32LE(binChunkStart);
  const binData = buf.subarray(binChunkStart + 8, binChunkStart + 8 + binLen);

  if (!json.images || json.images.length === 0) return;
  const newChunks = [binData];
  let cursor = binLen;
  let changed = false;

  for (const img of json.images) {
    if (!img.uri || img.uri.startsWith("data:")) continue;
    const decoded = decodeURIComponent(img.uri);
    // Search assetDir recursively for matching basename.
    const target = findFileByName(assetDir, path.basename(decoded));
    if (!target) continue;
    const data = fs.readFileSync(target);
    // pad to 4 bytes
    const pad = (4 - (cursor % 4)) % 4;
    if (pad > 0) {
      newChunks.push(Buffer.alloc(pad));
      cursor += pad;
    }
    const bvIndex = (json.bufferViews ||= []).length;
    json.bufferViews.push({ buffer: 0, byteOffset: cursor, byteLength: data.length });
    newChunks.push(data);
    cursor += data.length;
    delete img.uri;
    img.bufferView = bvIndex;
    img.mimeType = path.extname(target).toLowerCase() === ".jpg" ? "image/jpeg" : "image/png";
    changed = true;
  }

  if (!changed) return;

  // Rebuild GLB. Update buffer total size.
  json.buffers = json.buffers || [{ byteLength: 0 }];
  json.buffers[0].byteLength = cursor;
  // Drop external uri if any.
  if (json.buffers[0].uri) delete json.buffers[0].uri;

  let newJson = JSON.stringify(json);
  // pad JSON to 4-byte boundary with spaces
  while (newJson.length % 4 !== 0) newJson += " ";
  const newBin = Buffer.concat(newChunks);
  // pad BIN to 4-byte boundary with zeros
  const binPad = (4 - (newBin.length % 4)) % 4;
  const binPadded = binPad === 0 ? newBin : Buffer.concat([newBin, Buffer.alloc(binPad)]);

  const totalLen = 12 + 8 + newJson.length + 8 + binPadded.length;
  const out = Buffer.alloc(totalLen);
  // Header
  out.writeUInt32LE(0x46546c67, 0); // "glTF"
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  // JSON chunk
  out.writeUInt32LE(newJson.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // "JSON"
  out.write(newJson, 20, "utf8");
  // BIN chunk
  const binHdr = 20 + newJson.length;
  out.writeUInt32LE(binPadded.length, binHdr);
  out.writeUInt32LE(0x004e4942, binHdr + 4); // "BIN\0"
  binPadded.copy(out, binHdr + 8);

  fs.writeFileSync(glbPath, out);
}

function findFileByName(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = findFileByName(p, name);
      if (r) return r;
    } else if (e.name === name) {
      return p;
    }
  }
  return null;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

function pickSource(files) {
  // Prefer FBX. Fall back to OBJ, then DAE.
  for (const ext of ["fbx", "obj", "dae"]) {
    const re = new RegExp(`\\.${ext}$`, "i");
    const list = files.filter((p) => re.test(p));
    if (list.length === 0) continue;
    const base = list.filter(
      (p) => !VARIANT_RE.test(path.basename(p, path.extname(p))),
    );
    const pool = base.length > 0 ? base : list;
    pool.sort((a, b) => path.basename(a).length - path.basename(b).length);
    return { ext, inner: pool[0] };
  }
  return null;
}

function convertOne({ dex, name, zip, force }) {
  const out = path.join(DST, `${name}.glb`);
  if (fs.existsSync(out) && !force) {
    return { dex, name, status: "skip-exists" };
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `pkm-${dex}-`));
  try {
    // Python zipfile beats macOS `unzip` here: re-encodes legacy CP437
    // filenames (e.g. Flabébé) to UTF-8 so APFS accepts them.
    execFileSync("python3", ["-c", PY_UNZIP, zip, tmp], { stdio: "ignore" });
    const files = walk(tmp);
    const src = pickSource(files);
    if (!src) return { dex, name, status: "no-source" };

    const srcPath = src.inner;
    if (!fs.existsSync(srcPath)) return { dex, name, status: "unzip-miss" };

    if (src.ext === "fbx") {
      // Flatten every PNG next to the .fbx so FBX2glTF's basename lookup
      // finds them even when the FBX embeds Windows absolute paths.
      flattenTexturesNextTo(srcPath, files);
      const base = out.replace(/\.glb$/, "");
      execFileSync(FBX2GLTF, ["--binary", "--input", srcPath, "--output", base], {
        stdio: "ignore",
      });
      // FBX2glTF dedupes textures when it can't resolve paths — re-link
      // materials to the right images by parsing material names.
      remapMaterialsToTextures(out, path.dirname(srcPath));
    } else if (src.ext === "obj") {
      execFileSync(
        BLENDER,
        ["--background", "--python", BLENDER_PY, "--", srcPath, out],
        { stdio: "ignore" },
      );
    } else if (src.ext === "dae") {
      // Blender 5.x dropped Collada support; assimp is the simplest fallback.
      execFileSync("assimp", ["export", srcPath, out, "-f", "glb2"], {
        stdio: "ignore",
      });
      // assimp leaves textures as external URIs; embed them so the .glb is
      // self-contained at runtime.
      embedExternalTextures(out, path.dirname(srcPath));
    }
    if (!fs.existsSync(out)) return { dex, name, status: "convert-fail" };
    const size = fs.statSync(out).size;
    return { dex, name, status: "ok", size, via: src.ext };
  } catch (e) {
    return { dex, name, status: "error", error: e.message };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  if (!fs.existsSync(FBX2GLTF)) {
    console.error(`FBX2glTF not found at ${FBX2GLTF}. Run: pnpm install`);
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dexArgs = args
    .filter((a) => a !== "--force")
    .map((a) => Number(a))
    .filter((n) => Number.isInteger(n) && n > 0);

  fs.mkdirSync(DST, { recursive: true });
  const dexToName = loadDexNameMap();

  const zips = fs
    .readdirSync(ZIP_DIR)
    .filter((f) => f.endsWith(".zip"))
    .map((f) => {
      const m = f.match(/^(\d{1,4})[_-]/);
      return m ? { dex: Number(m[1]), zip: path.join(ZIP_DIR, f) } : null;
    })
    .filter(Boolean);

  const targets = (dexArgs.length > 0
    ? zips.filter((z) => dexArgs.includes(z.dex))
    : zips
  )
    .map((z) => ({ ...z, name: dexToName.get(z.dex) }))
    .filter((z) => {
      if (!z.name) console.warn(`[#${z.dex}] no entry in pokemon.json — skip`);
      return !!z.name;
    });

  if (targets.length === 0) {
    console.error("Nothing to convert.");
    process.exit(1);
  }

  console.log(`Converting ${targets.length} zip(s)...`);
  const counts = {};
  for (const t of targets) {
    const r = convertOne({ ...t, force });
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    const tag =
      r.status === "ok"
        ? `via ${r.via} · ${(r.size / 1024).toFixed(0)} KB`
        : (r.error ?? "");
    console.log(`[#${String(t.dex).padStart(4, "0")} ${t.name}] ${r.status} ${tag}`);
  }
  console.log("Summary:", counts);
}

main();
