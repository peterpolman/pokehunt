// AR-only overlays inside the content area: compass arrow + warning banners.
// Counter / target name / distance live in the Header + Footer.

import { VARIANCE_THRESHOLD_HIGH, VARIANCE_THRESHOLD_LOW } from '../../adapters/compass.ts';
import s from './Hud.module.scss';

interface Props {
  state: CompassState;
  /** Visible only when AR (camera) view is active. */
  visible: boolean;
}

export function Hud({ state: cs, visible }: Props) {
  if (!visible) return null;

  const d = cs.distance;
  const insideCatch = cs.target !== undefined && d !== undefined && d <= cs.target.catchRadius;
  const arrowVisible = !insideCatch && !cs.headingStuck && cs.arrowAngle !== undefined;

  const compassClasses = [s.compass];
  if (d !== undefined && cs.target) {
    if (d <= cs.target.catchRadius) compassClasses.push(s.pulseStrong, s.inRadius);
    else if (d <= 20) compassClasses.push(s.pulseSoft);
  }

  // Calibration banner uses hysteresis (visible above HIGH, hidden below LOW).
  const showCal =
    cs.headingAccuracy !== undefined && cs.headingAccuracy > VARIANCE_THRESHOLD_HIGH;
  const hideCal =
    cs.headingAccuracy !== undefined && cs.headingAccuracy < VARIANCE_THRESHOLD_LOW;
  const calibrationVisible = showCal && !hideCal;

  const banner = (extra: string, on: boolean) =>
    [s.banner, extra, on ? s.visible : ''].filter(Boolean).join(' ');

  return (
    <div className={s.overlay}>
      <div className={s.banners}>
        <div className={banner('', calibrationVisible)}>
          Compass needs calibration — wave your phone in a figure 8.
        </div>
        <div className={banner(s.warn, cs.weakGps)}>
          Weak GPS signal — move to open sky.
        </div>
        <div className={banner(s.warn, cs.headingStuck)}>
          Compass unavailable — using map only.
        </div>
      </div>

      <div className={compassClasses.join(' ')}>
        <div
          className={`${s.arrow}${arrowVisible ? '' : ' ' + s.hidden}`}
          style={
            arrowVisible && cs.arrowAngle !== undefined
              ? { transform: `rotate(${cs.arrowAngle}deg)` }
              : undefined
          }
        />
      </div>
    </div>
  );
}
