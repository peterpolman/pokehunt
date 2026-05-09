// 8th Wall pipeline module + XR8 boot.
//
// Wires our scene/lights/anchor logic into the engine binary's pipeline.
// Camera permission is requested by XR8.run() once at boot; toggling
// between map and AR views does not re-prompt.

import * as THREE from "three";
import { arState } from "../features/ar/state.ts";
import { tickAr, syncCurrentModel } from "../features/ar/anchor.ts";
import type { Compass } from "./compass.ts";

export type FatalHandler = (message: string) => void;

export function huntPipelineModule(compass: Compass, onFatal: FatalHandler) {
  return {
    name: "hunt",
    onStart: () => {
      const xr = (XR8 as any).Threejs.xrScene();
      const scene = xr.scene as THREE.Scene;
      const camera = xr.camera as THREE.PerspectiveCamera;
      arState.scene = scene;
      arState.camera = camera;
      arState.renderer = xr.renderer as THREE.WebGLRenderer;

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 0.6);
      dir.position.set(2, 5, 2);
      scene.add(dir);

      // SLAM positional tracking is more stable from a believable starting
      // pose (eye height) than pinned at world origin.
      camera.position.set(0, 1.6, 0);
      (XR8 as any).XrController.updateCameraProjectionMatrix({
        origin: camera.position,
        facing: camera.quaternion,
      });
    },
    onUpdate: () => {
      tickAr();
      void syncCurrentModel(compass);
      // XR8.Threejs renders for us — don't double-render.
    },
    onException: (args: unknown) => {
      console.warn("[8thwall]", args);
      onFatal("AR couldn't start on this device. Try Chrome or Safari.");
    },
  };
}

export function bootXR(
  compass: Compass,
  canvas: HTMLCanvasElement,
  onFatal: FatalHandler,
): void {
  if (typeof XR8 === "undefined") {
    onFatal("AR runtime didn't load. Check your network and reload.");
    return;
  }
  const xr = XR8 as any;
  // Pre-acquire a WebGL context with preserveDrawingBuffer so we can read
  // pixels off the canvas after each frame (camera-button photo capture).
  // Subsequent getContext() calls return this same context regardless of
  // the attributes the engine passes in.
  canvas.getContext("webgl2", { preserveDrawingBuffer: true }) ??
    canvas.getContext("webgl", { preserveDrawingBuffer: true });
  // FullWindowCanvas is what binds the engine session to the canvas;
  // without it XR8.run fails with "No valid session manager".
  xr.addCameraPipelineModules([
    xr.GlTextureRenderer.pipelineModule(),
    xr.Threejs.pipelineModule(),
    xr.XrController.pipelineModule(),
    XRExtras.FullWindowCanvas.pipelineModule(),
    huntPipelineModule(compass, onFatal),
  ]);
  xr.run({ canvas });
}
