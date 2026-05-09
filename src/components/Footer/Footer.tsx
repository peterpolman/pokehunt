import { useEffect, useState } from "react";
import s from "./Footer.module.scss";

interface Props {
  state: CompassState;
  /** Latest banner / notification text. Empty string = nothing pinned. */
  notification?: string;
}

export function Footer({ state, notification }: Props) {
  const [pinned, setPinned] = useState("");

  // Pin the latest notification for ~3s so it stays readable.
  useEffect(() => {
    if (!notification) return;
    setPinned(notification);
    const t = window.setTimeout(() => setPinned(""), 3000);
    return () => window.clearTimeout(t);
  }, [notification]);

  const targetLabel = state.target ? state.target.name.toUpperCase() : "— —";
  const distLabel =
    state.distance === undefined ? "— m" : `${Math.round(state.distance)} m`;

  return (
    <footer className={s.footer}>
      <div className={s.screen}>
        <div className={s.row}>
          <span className={s.label}>POKEMON:</span>
          <span className={s.value}>{targetLabel}</span>
        </div>
        <div className={`${s.row} ${s.distance}`}>
          <span className={s.label}>AFSTAND:</span>
          <span className={s.value}>{distLabel}</span>
        </div>
        <div className={s.ticker}>
          {pinned}
          <span className={s.blink}>_</span>
        </div>
      </div>
    </footer>
  );
}
