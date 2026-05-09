// Subscribes a React component to compass.onUpdate. Returns latest state.

import { useEffect, useState } from 'react';
import type { Compass } from '../adapters/compass.ts';

export function useCompassState(compass: Compass): CompassState {
  const [s, setS] = useState<CompassState>(() => compass.state());
  useEffect(() => {
    compass.onUpdate = setS;
    return () => {
      if (compass.onUpdate === setS) compass.onUpdate = null;
    };
  }, [compass]);
  return s;
}
