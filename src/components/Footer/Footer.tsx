import { useEffect, useState } from "react";
import s from "./Footer.module.scss";

type Props =
  | {
      mode?: "hunt";
      state: CompassState;
      notification?: string;
    }
  | {
      mode: "admin";
      placedCount: number;
      total: number;
      onReset: () => void;
      notification?: string;
    };

export function Footer(props: Props) {
  const [pinned, setPinned] = useState("");

  // Pin the latest notification for ~3s so it stays readable.
  useEffect(() => {
    if (!props.notification) return;
    setPinned(props.notification);
    const t = window.setTimeout(() => setPinned(""), 3000);
    return () => window.clearTimeout(t);
  }, [props.notification]);

  return (
    <footer className={s.footer}>
      <div className={s.screen}>
        {props.mode === "admin" ? (
          <>
            <div className={s.row}>
              <span className={s.label}>GEPLAATST:</span>
              <span className={s.value}>
                {props.placedCount} / {props.total}
              </span>
            </div>
            <div className={`${s.row} ${s.distance}`}>
              <button className={s.resetButton} onClick={props.onReset}>
                RESET ALLES
              </button>
            </div>
          </>
        ) : (
          <HuntRows state={props.state} />
        )}
        {pinned && <div className={s.ticker}>{pinned}</div>}
      </div>
    </footer>
  );
}

function HuntRows({ state }: { state: CompassState }) {
  const targetLabel = state.target ? state.target.name.toUpperCase() : "— —";
  const distLabel =
    state.distance === undefined ? "— m" : `${Math.round(state.distance)} m`;
  return (
    <>
      <div className={s.row}>
        <span className={s.label}>POKÉ:</span>
        <span className={s.value}>{targetLabel}</span>
      </div>
      <div className={`${s.row} ${s.distance}`}>
        <span className={s.label}>AFST:</span>
        <span className={s.value}>{distLabel}</span>
      </div>
    </>
  );
}
