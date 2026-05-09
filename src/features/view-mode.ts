// View-mode toggle: distance < 20m = AR, otherwise = map.
// Camera (XR8) keeps running underneath; flipping does not re-prompt for permissions.

export const AR_DISTANCE_M = 20;

let mode: 'ar' | 'map' | null = null;

export function applyViewMode(
  distance: Meters | undefined,
  mapHandle: { show: () => void; hide: () => void },
): void {
  const wantMap = distance === undefined || distance >= AR_DISTANCE_M;
  const next = wantMap ? 'map' : 'ar';
  if (next === mode) return;
  mode = next;
  document.body.classList.toggle('view-map', wantMap);
  document.body.classList.toggle('view-ar', !wantMap);
  if (wantMap) mapHandle.show();
  else mapHandle.hide();
}
