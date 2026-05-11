// Two-finger pinch overlay for the AR view: shifts the active model's
// world anchor along the current camera->anchor XZ line. Camera stays put;
// perspective alone scales the apparent size. Mounted only when the user
// is inside the spawn's catch radius (gating handled by the parent).

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { arState } from '../../features/ar/state.ts';
import s from './PinchZoom.module.scss';

interface Props {
  /** Hard floor for the pinch-driven distance. Below this the model clips
   *  into the camera near plane / feels uncomfortable for a selfie. */
  minDistance?: number;
  /** Hard ceiling. Caller passes the spawn's catchRadius so all zoom states
   *  remain catchable. */
  maxDistance: number;
}

interface PointerSample {
  x: number;
  y: number;
}

export function PinchZoom({ minDistance = 1.5, maxDistance }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Live pointer set + gesture baseline. Plain refs (not state) so pointer
  // moves don't trigger React re-renders at gesture rate.
  const pointers = useRef<Map<number, PointerSample>>(new Map());
  const baseline = useRef<{ span: number; distance: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const span = (): number => {
      const it = pointers.current.values();
      const a = it.next().value as PointerSample | undefined;
      const b = it.next().value as PointerSample | undefined;
      if (!a || !b) return 0;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const cameraToAnchorXZ = (): { dist: number; nx: number; nz: number; cam: THREE.Vector3 } | null => {
      const cam = arState.camera;
      const anchor = arState.anchoredWorldPos;
      if (!cam || !anchor) return null;
      const cp = new THREE.Vector3();
      cam.getWorldPosition(cp);
      const dx = anchor.x - cp.x;
      const dz = anchor.z - cp.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.001) return null;
      return { dist: len, nx: dx / len, nz: dz / len, cam: cp };
    };

    const beginIfReady = () => {
      if (pointers.current.size !== 2) return;
      const cur = cameraToAnchorXZ();
      if (!cur) return;
      baseline.current = { span: span(), distance: cur.dist };
    };

    const apply = () => {
      const base = baseline.current;
      if (!base || pointers.current.size !== 2) return;
      const cur = cameraToAnchorXZ();
      if (!cur) return;
      const s = span();
      if (s < 1 || base.span < 1) return;
      // Standard pinch ratio: spreading fingers (s > base.span) shrinks the
      // distance, pulling the model in.
      const target = base.distance * (base.span / s);
      const newDist = Math.min(Math.max(target, minDistance), maxDistance);

      const nx = cur.cam.x + cur.nx * newDist;
      const nz = cur.cam.z + cur.nz * newDist;

      const model = arState.currentModel;
      if (model) {
        model.position.set(nx, 0, nz);
        if (!model.userData.placeholder) {
          model.lookAt(cur.cam.x, 0, cur.cam.z);
        }
      }
      // Mutate in place so anchor.ts's per-frame distance override picks up
      // the new position without any extra plumbing.
      if (arState.anchoredWorldPos) {
        arState.anchoredWorldPos.set(nx, 0, nz);
      }
    };

    const onDown = (e: PointerEvent) => {
      // Only react to touch contacts. Mouse / pen are unlikely on the
      // intended phone target and would confuse the two-finger heuristic.
      if (e.pointerType !== 'touch') return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        // Prevent the second finger from being interpreted as a tap on
        // anything underneath while the gesture is live.
        e.preventDefault();
        beginIfReady();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
        e.preventDefault();
        apply();
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 2) {
        // Three+ fingers reduced back to two: re-baseline so the surviving
        // pair starts a fresh gesture instead of continuing with stale span.
        beginIfReady();
      } else {
        baseline.current = null;
      }
    };

    // Non-passive so preventDefault works on iOS Safari.
    const opts: AddEventListenerOptions = { passive: false };
    el.addEventListener('pointerdown', onDown, opts);
    el.addEventListener('pointermove', onMove, opts);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('pointerleave', onUp);
      pointers.current.clear();
      baseline.current = null;
    };
  }, [minDistance, maxDistance]);

  return <div ref={ref} className={s.surface} aria-hidden />;
}
