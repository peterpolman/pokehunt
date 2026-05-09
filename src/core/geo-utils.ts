// Pure geographic / angular helpers. No DOM, no globals.

const EARTH_RADIUS_M = 6371000;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance using the haversine formula. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): Meters {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (EARTH_RADIUS_M * c) as Meters;
}

/** Initial bearing point 1 -> point 2, 0..360 with 0=N clockwise. */
export function bearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): Degrees {
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lng2 - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (((toDeg(Math.atan2(y, x)) + 360) % 360)) as Degrees;
}

/** Signed shortest angular delta, range -180..180. Used for compass smoothing. */
export function angleDelta(from: number, to: number): Degrees {
  let d = ((to - from + 540) % 360) - 180;
  if (d <= -180) d += 360;
  return d as Degrees;
}

export function normalizeDeg(deg: number): Degrees {
  return (((deg % 360) + 360) % 360) as Degrees;
}
