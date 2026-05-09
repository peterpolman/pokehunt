import s from './Header.module.scss';

interface Props {
  foundCount?: number;
  total?: number;
}

export function Header({ foundCount, total }: Props) {
  return (
    <header className={s.header}>
      <div className={s.circle}>
        <span className={s.circleShine} />
      </div>
      <div className={s.dots}>
        <span />
        <span />
        <span />
      </div>
      {foundCount !== undefined && total !== undefined && (
        <div className={s.counter}>
          {foundCount} / {total}
        </div>
      )}
    </header>
  );
}
