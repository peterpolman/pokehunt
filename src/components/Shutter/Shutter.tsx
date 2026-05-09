// Camera shutter button. Bottom-centred, disabled outside catch radius.

import s from "./Shutter.module.scss";

interface Props {
  enabled: boolean;
  onShutter: () => void;
}

export function Shutter({ enabled, onShutter }: Props) {
  return (
    <button
      className={`${s.shutter}${enabled ? "" : " " + s.disabled}`}
      onClick={enabled ? onShutter : undefined}
      aria-label="Foto maken"
      disabled={!enabled}
    >
      <span className={s.inner} />
    </button>
  );
}
