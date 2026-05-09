// Centralised UX side effects: sound (stub), haptics, banner, full-screen flash.
// Single place to swap in real audio/animations later.

/** Play a named sound. No-op stub. Call sites: 'approach', 'catch', 'complete', 'enterRadius'. */
export function playSound(name: string): void {
  void name;
}

/** White-to-transparent overlay flash. Used on catch. */
export function flashScreen(): void {
  const el = document.getElementById('flash');
  if (!el) return;
  el.classList.remove('flash-active');
  // Force reflow so the animation restarts when called in quick succession.
  void el.offsetWidth;
  el.classList.add('flash-active');
}

let bannerTimer: number | null = null;

/** Slide-down banner at the top of the screen. */
export function showBanner(text: string, duration = 2000): void {
  const el = document.getElementById('banner');
  if (!el) return;
  el.textContent = text;
  el.classList.add('banner-visible');
  if (bannerTimer !== null) window.clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => {
    el.classList.remove('banner-visible');
    bannerTimer = null;
  }, duration);
}

export function vibrateCatch(): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate([40, 60, 40, 60, 40]);
}

export function vibrateProximity(): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(50);
}
