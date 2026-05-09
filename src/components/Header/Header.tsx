import { useLongPress } from "../../hooks/useLongPress.ts";
import s from "./Header.module.scss";

type Props =
  | {
      mode?: "hunt";
      foundCount?: number;
      total?: number;
      onLensLongPress?: () => void;
    }
  | {
      mode: "admin";
      placedCount: number;
      total: number;
      onDone: () => void;
    };

export function Header(props: Props) {
  const huntLongPress = useLongPress(
    props.mode === "admin" ? undefined : props.onLensLongPress,
  );

  return (
    <header className={s.header}>
      <div className={s.circle} {...huntLongPress}>
        <span className={s.circleShine} />
      </div>
      <div className={s.dots}>
        <span />
        <span />
        <span />
      </div>
      {props.mode === "admin" ? (
        <>
          <div className={s.counter}>
            ADMIN · {props.placedCount}/{props.total}
          </div>
          <button className={s.action} onClick={props.onDone}>
            KLAAR →
          </button>
        </>
      ) : (
        props.foundCount !== undefined &&
        props.total !== undefined && (
          <div className={s.counter}>
            {props.foundCount} / {props.total}
          </div>
        )
      )}
    </header>
  );
}
