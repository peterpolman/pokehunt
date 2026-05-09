// Ambient declarations for 8th Wall globals, non-standard browser APIs,
// branded unit types, and shared shapes used across modules.
//
// 8th Wall ships no official TypeScript types for the open-source engine.
// `any` keeps this file small and avoids bitrot when their pipeline API shifts.

declare const XR8: any;
declare const XRExtras: any;

// CSS / SCSS modules — Vite runtime maps imports to a class-name object.
declare module '*.module.scss' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// Augment lib.dom.d.ts to expose iOS-only fields on DeviceOrientationEvent.
// Top-level `interface` declarations merge with the existing global one.
interface DeviceOrientationEvent {
  /** iOS-only: heading in degrees, true north, clockwise. */
  readonly webkitCompassHeading?: number;
  /** iOS-only: estimated heading accuracy in degrees. */
  readonly webkitCompassAccuracy?: number;
}

// The DeviceOrientationEvent constructor is declared as `var` in lib.dom
// and can't be redeclared. Its iOS 13+ `requestPermission()` static method
// is reached via this helper type at the call site.
type MotionPermissionCtor = {
  requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
};

// Branded unit types — prevent silent unit confusion at module boundaries.
// At runtime these are plain numbers; the brand exists only at type level.
type Meters = number & { readonly __brand: 'Meters' };
type Degrees = number & { readonly __brand: 'Degrees' };
type Radians = number & { readonly __brand: 'Radians' };

interface UserPosition {
  lat: number;
  lng: number;
  accuracy: Meters;
}

interface Spawn {
  id: number;
  name: string;
  /** National Pokédex number. */
  dex: number;
  lat: number;
  lng: number;
  altitude: Meters;
  model: string;
  /** Sprite image used by the map marker. */
  image?: string;
  scale: number;
  catchRadius: Meters;
}

type HeadingSource = 'ios' | 'absolute' | 'relative' | 'none';

interface CompassState {
  ready: boolean;
  target?: Spawn;
  distance?: Meters;
  /** Bearing relative to the user's current heading, 0=ahead, clockwise. */
  arrowAngle?: Degrees;
  /** Estimated heading jitter over the recent variance window. */
  headingAccuracy?: Degrees;
  foundCount: number;
  total: number;
  source: HeadingSource;
  position?: UserPosition;
  /** Smoothed heading 0..360. */
  heading?: Degrees;
  /** Raw last heading sample 0..360 (unsmoothed). */
  rawHeading?: Degrees;
  /** True when heading appears stuck or uninitialised. */
  headingStuck: boolean;
  /** True when GPS accuracy is worse than 20m. */
  weakGps: boolean;
}
