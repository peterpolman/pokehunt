import s from './CompletionView.module.scss';

interface Props {
  elapsedMs: number;
  onReplay: () => void;
}

export function CompletionView({ elapsedMs, onReplay }: Props) {
  const total = Math.round(elapsedMs / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return (
    <div className={s.screen}>
      <h1>Alle pokémon gevonden!</h1>
      <p>{`Tijd: ${m}m ${sec}s`}</p>
      <button className={s.button} onClick={onReplay}>
        Opnieuw spelen
      </button>
    </div>
  );
}
