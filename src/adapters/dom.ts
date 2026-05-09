// Tiny DOM helpers shared across UI modules.

/** Strict element lookup; throws when an expected id is missing. */
export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}

export function showFatal(message: string): void {
  const overlay = document.getElementById('error');
  const text = document.getElementById('error-message');
  if (text) text.textContent = message;
  if (overlay) overlay.classList.add('overlay-visible');
}
