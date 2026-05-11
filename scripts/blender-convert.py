"""Headless Blender import + glTF export. Used as fallback when a zip has
no FBX (older Pokedex 3D Pro rips ship OBJ+MTL+textures, some only ship DAE).

Usage:
    blender --background --python scripts/blender-convert.py -- <input> <output.glb>

Supports .obj, .fbx, .dae.
"""

import bpy
import sys
import os

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) != 2:
    print("usage: blender ... -- <input> <output>", flush=True)
    raise SystemExit(2)

input_path, output_path = argv
ext = os.path.splitext(input_path)[1].lower()

bpy.ops.wm.read_factory_settings(use_empty=True)

try:
    if ext == ".fbx":
        if hasattr(bpy.ops.import_scene, "fbx"):
            bpy.ops.import_scene.fbx(filepath=input_path)
        else:
            bpy.ops.wm.fbx_import(filepath=input_path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=input_path)
    elif ext == ".dae":
        bpy.ops.wm.collada_import(filepath=input_path)
    else:
        print(f"ERROR: unsupported extension {ext}", flush=True)
        raise SystemExit(3)
except Exception as e:
    print(f"ERROR: import failed: {e}", flush=True)
    raise SystemExit(4)

try:
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,
        use_selection=False,
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_image_format="AUTO",
    )
except Exception as e:
    print(f"ERROR: export failed: {e}", flush=True)
    raise SystemExit(5)

print(f"OK: wrote {output_path}", flush=True)
