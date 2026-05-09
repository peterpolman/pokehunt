# Models

Drop ten `.glb` files in this directory:

```
creature1.glb
creature2.glb
...
creature10.glb
```

The filenames are referenced from `spawns.js` as `models/creatureN.glb`. If you
rename a file here, update the matching `model` field in `spawns.js`.

## Where to get models

- **Quaternius** (https://quaternius.com) — CC0 stylised creatures, animation-ready.
- **Sketchfab** (https://sketchfab.com) — filter by *Downloadable* + *CC0* / *CC-BY*.
- **Mixamo** (https://www.mixamo.com) — Adobe-hosted, free skeletal animations
  if your model is a humanoid. Export as GLB.

## Format requirements

- `.glb` (binary glTF), embedded textures.
- Y-up, scaled so the creature is roughly 1 metre tall — the per-spawn `scale`
  field in `spawns.js` is a fine multiplier but extreme values look bad.
- One animation clip is enough; the loader plays the first clip on loop. If
  your file has multiple clips, the first one wins.

## IP and licensing

Do **not** use real Pokémon assets, names, or sprites. The Pokémon Company is
aggressive about IP enforcement; even fan projects get DMCA'd. The names in
`spawns.js` are made-up and the model filenames are generic.

If you publish this app, keep an eye on the licence of every GLB you ship —
CC-BY models still require attribution somewhere visible.

## Animations

The app plays the first `AnimationClip` embedded in each spawn's `.glb`
automatically (see the `gltf.animations` branch in `app.js loadModel`). To
ship an animated creature, retarget your animation source (Mixamo,
hand-keyed, etc.) onto the model in Blender and export a single GLB with
the clip baked in.

That's all the runtime needs — drop the new `creature1.glb` over the old
one, reload, and it animates.
