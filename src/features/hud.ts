// AR-mode HUD: counter, target name, distance, compass arrow, calibration banners.

import { $ } from '../adapters/dom.ts';
import { VARIANCE_THRESHOLD_HIGH, VARIANCE_THRESHOLD_LOW } from '../adapters/compass.ts';

export function updateHud(s: CompassState): void {
  const arrow = $('arrow');
  const distEl = $('distance');
  const targetName = $('target-name');
  const counter = $('counter');
  const compassEl = $('compass');

  counter.textContent = `${s.foundCount} / ${s.total}`;

  if (!s.target) {
    targetName.textContent = '';
    distEl.textContent = '';
    return;
  }
  targetName.textContent = `Find ${s.target.name}`;

  const d = s.distance;
  distEl.textContent = d === undefined ? '— m' : `${Math.round(d)} m`;

  // Distance tier drives styling + compass pulse.
  distEl.classList.remove('dist-mid', 'dist-near', 'dist-catch');
  compassEl.classList.remove('pulse-soft', 'pulse-strong', 'in-radius');
  if (d !== undefined) {
    if (d <= s.target.catchRadius) {
      distEl.classList.add('dist-catch');
      compassEl.classList.add('pulse-strong', 'in-radius');
    } else if (d <= 20) {
      distEl.classList.add('dist-near');
      compassEl.classList.add('pulse-soft');
    } else if (d <= 50) {
      distEl.classList.add('dist-mid');
    }
  }

  const insideCatch = d !== undefined && d <= s.target.catchRadius;
  if (insideCatch || s.headingStuck) {
    arrow.classList.add('arrow-hidden');
    if (insideCatch) arrow.style.transform = '';
  } else if (s.arrowAngle !== undefined) {
    arrow.classList.remove('arrow-hidden');
    arrow.style.transform = `rotate(${s.arrowAngle}deg)`;
  }

  // Calibration banner uses hysteresis (high threshold to show, low to hide).
  const cal = $('calibration');
  if (s.headingAccuracy !== undefined) {
    if (s.headingAccuracy > VARIANCE_THRESHOLD_HIGH) cal.classList.add('hud-banner-visible');
    else if (s.headingAccuracy < VARIANCE_THRESHOLD_LOW) cal.classList.remove('hud-banner-visible');
  }
  $('weak-gps').classList.toggle('hud-banner-visible', s.weakGps);
  $('compass-error').classList.toggle('hud-banner-visible', s.headingStuck);
}
