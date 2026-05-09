// Long-press handler for an element. Returns pointer-event handlers to
// spread onto the target. Cancels on pointer leave/up/cancel.

import { useRef, useCallback } from "react";

interface Handlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export function useLongPress(
  handler: (() => void) | undefined,
  ms = 700,
): Handlers {
  const timer = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!handler) return;
    cancel();
    timer.current = window.setTimeout(() => {
      timer.current = null;
      handler();
    }, ms);
  }, [handler, ms, cancel]);

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
