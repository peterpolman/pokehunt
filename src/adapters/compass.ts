// Compass: GPS + device orientation. Picks the nearest unfound spawn and
// emits smoothed heading + arrow angle to the UI at ~15Hz.
//
// Heading sources, preferred order:
//   1. iOS  -> event.webkitCompassHeading (true north, clockwise)
//   2. Android -> deviceorientationabsolute with event.absolute === true
//   3. Fallback -> deviceorientation (RELATIVE; warn the user)
//
// We attach BOTH `deviceorientationabsolute` and `deviceorientation`.
// Absolute is preferred whenever it fires; relative is used only after
// the first 3s if no absolute has arrived.

import {
  distanceMeters,
  bearingDegrees,
  angleDelta,
  normalizeDeg,
} from "../core/geo-utils.ts";
import { SPAWNS } from "../data/spawns.ts";
import { clearFound, loadFound, saveFound } from "../data/found.ts";

const SMOOTHING = 0.15;
const VARIANCE_WINDOW_MS = 1500;
const VARIANCE_HIGH_DEG = 25;
const VARIANCE_LOW_DEG = 10;
const HEADING_STUCK_MS = 2000;
const ABSOLUTE_WAIT_MS = 3000;
const WEAK_GPS_M = 20;
const UPDATE_HZ = 15;

export class Compass {
  found: Set<number> = new Set(loadFound());

  onUpdate: ((s: CompassState) => void) | null = null;
  onEnterRadius: ((s: Spawn, d: Meters) => void) | null = null;
  onLeaveRadius: ((s: Spawn) => void) | null = null;
  onError: ((message: string) => void) | null = null;

  position: UserPosition | null = null;

  smoothedHeading: Degrees | null = null;
  rawHeading: Degrees | null = null;
  headingSource: HeadingSource = "none";
  absoluteSeen = false;
  headingHistory: Array<{ t: number; h: Degrees }> = [];
  lastHeadingChangeAt = 0;
  lastHeadingValue: Degrees = -1 as Degrees;

  target: Spawn | null = null;
  insideRadius = new Set<number>();

  watchId: number | null = null;
  tickId: number | null = null;
  lastUpdateEmit = 0;
  startedAt = 0;

  private _onAbsolute = (e: DeviceOrientationEvent) =>
    this._handleOrientation(e, true);
  private _onOrientation = (e: DeviceOrientationEvent) =>
    this._handleOrientation(e, false);
  private _onVisibility = () => this._reprimePosition();

  /**
   * Begin watching position + orientation. Must be called from a user gesture
   * on iOS so DeviceOrientationEvent.requestPermission can prompt.
   */
  async start(): Promise<void> {
    this.startedAt = performance.now();

    // iOS motion permission. Must be in a user-gesture call stack. The
    // lib.dom DeviceOrientationEvent constructor is `var` so we can't
    // redeclare; reach the static method via MotionPermissionCtor.
    const reqPerm = (DeviceOrientationEvent as unknown as MotionPermissionCtor)
      .requestPermission;
    if (typeof reqPerm === "function") {
      try {
        const r = await reqPerm.call(DeviceOrientationEvent);
        if (r !== "granted") throw new Error("motion-denied");
      } catch (e) {
        if (this.onError) this.onError("motion-denied");
        throw e;
      }
    }

    if (!("geolocation" in navigator)) {
      if (this.onError) this.onError("geolocation-missing");
      throw new Error("geolocation-missing");
    }

    // Surface the geolocation prompt with getCurrentPosition (watchPosition
    // alone often delays the prompt until the first sample).
    await new Promise<void>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this._setPosition(pos);
          resolve();
        },
        (err) => {
          if (this.onError) this.onError("geolocation-denied");
          reject(err);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
      );
    });

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this._setPosition(pos),
      () => {
        // A single error sample is recoverable; UI shows weak-GPS banner if
        // accuracy stays bad.
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );

    window.addEventListener(
      "deviceorientationabsolute" as keyof WindowEventMap,
      this._onAbsolute as EventListener,
      true,
    );
    window.addEventListener("deviceorientation", this._onOrientation, true);
    document.addEventListener("visibilitychange", this._onVisibility);

    // Smooth at 60Hz; emit callbacks throttled to UPDATE_HZ inside _tick.
    const tick = () => {
      this._tick();
      this.tickId = requestAnimationFrame(tick);
    };
    this.tickId = requestAnimationFrame(tick);
  }

  /** Idempotent teardown. */
  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    if (this.tickId !== null) {
      cancelAnimationFrame(this.tickId);
      this.tickId = null;
    }
    window.removeEventListener(
      "deviceorientationabsolute" as keyof WindowEventMap,
      this._onAbsolute as EventListener,
      true,
    );
    window.removeEventListener("deviceorientation", this._onOrientation, true);
    document.removeEventListener("visibilitychange", this._onVisibility);
  }

  markFound(id: number): void {
    this.found.add(id);
    this.insideRadius.delete(id);
    this.target = this._pickTarget();
    saveFound([...this.found]);
    // Force an immediate emit so UI updates without waiting for the next tick.
    this.lastUpdateEmit = 0;
  }

  state(): CompassState {
    return {
      ready: this.position !== null && this.smoothedHeading !== null,
      target: this.target ?? undefined,
      distance: this._distanceToTarget(),
      arrowAngle: this._arrowAngle(),
      headingAccuracy: this._headingVariance(),
      foundCount: this.found.size,
      total: SPAWNS.length,
      source: this.headingSource,
      position: this.position ?? undefined,
      heading: this.smoothedHeading ?? undefined,
      rawHeading: this.rawHeading ?? undefined,
      headingStuck: this._headingStuck(),
      weakGps: this.position ? this.position.accuracy > WEAK_GPS_M : false,
    };
  }

  reset(): void {
    this.found.clear();
    this.insideRadius.clear();
    clearFound();
    this.target = this._pickTarget();
    this.startedAt = performance.now();
    this.lastUpdateEmit = 0;
  }

  /** Elapsed ms since `start()`. */
  elapsed(): number {
    return performance.now() - this.startedAt;
  }

  // -------- internals --------

  private _setPosition(pos: GeolocationPosition): void {
    this.position = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy as Meters,
    };
    if (!this.target) this.target = this._pickTarget();
  }

  private _reprimePosition(): void {
    // iOS may pause watchPosition while the screen is locked. A single
    // getCurrentPosition re-primes without disturbing the existing watch.
    if (document.visibilityState !== "visible") return;
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => this._setPosition(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }

  private _handleOrientation(
    e: DeviceOrientationEvent,
    isAbsoluteEvent: boolean,
  ): void {
    let h: number | null = null;
    let src = this.headingSource;

    if (typeof e.webkitCompassHeading === "number") {
      h = e.webkitCompassHeading;
      src = "ios";
      this.absoluteSeen = true;
    } else if (
      isAbsoluteEvent &&
      e.absolute === true &&
      typeof e.alpha === "number"
    ) {
      // Android absolute: alpha is counter-clockwise from north.
      h = (360 - e.alpha) % 360;
      src = "absolute";
      this.absoluteSeen = true;
    } else if (!this.absoluteSeen && typeof e.alpha === "number") {
      // Relative fallback only after waiting for absolute.
      if (performance.now() - this.startedAt < ABSOLUTE_WAIT_MS) return;
      h = (360 - e.alpha) % 360;
      src = "relative";
    } else {
      return;
    }

    if (h === null || Number.isNaN(h)) return;
    const heading = normalizeDeg(h);
    this.rawHeading = heading;
    this.headingSource = src;

    // Stuck-sensor detection (heading not changing at all).
    if (
      this.lastHeadingValue === -1 ||
      Math.abs(heading - this.lastHeadingValue) > 0.1
    ) {
      this.lastHeadingChangeAt = performance.now();
      this.lastHeadingValue = heading;
    }

    // Smooth across 0/360 wrap via signed delta.
    if (this.smoothedHeading === null) {
      this.smoothedHeading = heading;
    } else {
      const delta = angleDelta(this.smoothedHeading, heading);
      this.smoothedHeading = normalizeDeg(
        this.smoothedHeading + delta * SMOOTHING,
      );
    }

    // Variance window for calibration banner + accuracy estimate.
    const now = performance.now();
    this.headingHistory.push({ t: now, h: heading });
    while (
      this.headingHistory.length &&
      now - this.headingHistory[0].t > VARIANCE_WINDOW_MS
    ) {
      this.headingHistory.shift();
    }
  }

  private _tick(): void {
    const now = performance.now();
    if (now - this.lastUpdateEmit < 1000 / UPDATE_HZ) return;
    this.lastUpdateEmit = now;

    // Always re-pick so the nearest unfound spawn updates as the user
    // walks. _pickTarget is O(spawns), trivial at 22.
    this.target = this._pickTarget();

    const tgt = this.target;
    if (tgt && this.position) {
      const d = distanceMeters(
        this.position.lat,
        this.position.lng,
        tgt.lat,
        tgt.lng,
      );
      const inside = d <= tgt.catchRadius;
      const wasInside = this.insideRadius.has(tgt.id);
      if (inside && !wasInside) {
        this.insideRadius.add(tgt.id);
        if (this.onEnterRadius) this.onEnterRadius(tgt, d);
      } else if (!inside && wasInside) {
        this.insideRadius.delete(tgt.id);
        if (this.onLeaveRadius) this.onLeaveRadius(tgt);
      }
    }

    if (this.onUpdate) this.onUpdate(this.state());
  }

  private _pickTarget(): Spawn | null {
    if (!this.position) {
      return SPAWNS.find((s) => !this.found.has(s.id)) ?? null;
    }
    let best: Spawn | null = null;
    let bestD = Infinity;
    for (const s of SPAWNS) {
      if (this.found.has(s.id)) continue;
      const d = distanceMeters(
        this.position.lat,
        this.position.lng,
        s.lat,
        s.lng,
      );
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  private _distanceToTarget(): Meters | undefined {
    if (!this.position || !this.target) return undefined;
    return distanceMeters(
      this.position.lat,
      this.position.lng,
      this.target.lat,
      this.target.lng,
    );
  }

  private _arrowAngle(): Degrees | undefined {
    if (!this.position || !this.target || this.smoothedHeading === null)
      return undefined;
    const bearing = bearingDegrees(
      this.position.lat,
      this.position.lng,
      this.target.lat,
      this.target.lng,
    );
    return normalizeDeg(bearing - this.smoothedHeading);
  }

  /** Circular stddev (Mardia 1972): sqrt(-2 ln R) where R = mean unit vector. */
  private _headingVariance(): Degrees {
    const n = this.headingHistory.length;
    if (n < 2) return 0 as Degrees;
    let sx = 0;
    let sy = 0;
    for (const { h } of this.headingHistory) {
      const r = (h * Math.PI) / 180;
      sx += Math.cos(r);
      sy += Math.sin(r);
    }
    const r = Math.sqrt((sx / n) ** 2 + (sy / n) ** 2);
    if (r >= 1) return 0 as Degrees;
    return ((Math.sqrt(-2 * Math.log(r)) * 180) / Math.PI) as Degrees;
  }

  private _headingStuck(): boolean {
    if (this.smoothedHeading === null) return false;
    return performance.now() - this.lastHeadingChangeAt > HEADING_STUCK_MS;
  }
}

export const VARIANCE_THRESHOLD_HIGH = VARIANCE_HIGH_DEG;
export const VARIANCE_THRESHOLD_LOW = VARIANCE_LOW_DEG;
export const WEAK_GPS_THRESHOLD = WEAK_GPS_M;
