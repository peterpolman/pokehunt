// Two-finger pinch overlay for the AR view: uniformly scales the active
// model in place. Model's local origin sits at its base (y=0 on ground),
// so a uniform scale grows it upward — bottom stays planted.
// Mounted only when the user is inside the spawn's catch radius.

import { useEffect, useRef } from 'react';
import { arState } from '../../features/ar/state.ts';
import s from './PinchZoom.module.scss';

interface Props {
  /** Scale bounds relative to the model's original (spawn-defined) scale. */
  minFactor?: number;
  maxFactor?: number;
}

interface PointerSample {
  x: number;
  y: number;
}

export function PinchZoom({ minFactor = 0.2, maxFactor = 3 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pointers = useRef<Map<number, PointerSample>>(new Map());
  const baseline = useRef<{ span: number; scale: number } | null>(null);

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

    // Original scale captured the first time we touch the model. Used as
    // the reference for min/max bounds so successive gestures don't
    // compound past those bounds.
    const originalScale = (): number | null => {
      const model = arState.currentModel;
      if (!model) return null;
      if (model.userData.pinchBaseScale === undefined) {
        model.userData.pinchBaseScale = model.scale.x;
      }
      return model.userData.pinchBaseScale as number;
    };

    const beginIfReady = () => {
      if (pointers.current.size !== 2) return;
      const model = arState.currentModel;
      if (!model) return;
      originalScale();
      baseline.current = { span: span(), scale: model.scale.x };
    };

    const apply = () => {
      const base = baseline.current;
      if (!base || pointers.current.size !== 2) return;
      const model = arState.currentModel;
      if (!model) return;
      const orig = originalScale();
      if (orig === null) return;
      const cur = span();
      if (cur < 1 || base.span < 1) return;
      const target = base.scale * (cur / base.span);
      const next = Math.min(
        Math.max(target, orig * minFactor),
        orig * maxFactor,
      );
      model.scale.set(next, next, next);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.current.size === 2) {
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
        beginIfReady();
      } else {
        baseline.current = null;
      }
    };

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
  }, [minFactor, maxFactor]);

  return <div ref={ref} className={s.surface} aria-hidden />;
}
