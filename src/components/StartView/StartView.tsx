import s from "./StartView.module.scss";

interface Props {
  onStart: () => void;
}

export function StartView({ onStart }: Props) {
  return (
    <div className={s.screen}>
      <h1>Poké Safari</h1>
      <p>
        Loop rond om pokémon in je buurt te vinden. Ga met ze op de foto om ze
        te vangen.
      </p>
      <button className={s.button} onClick={onStart}>
        Begin met zoeken!
      </button>
      <p className={s.hint}>
        Werkt het beste buiten met een heldere lucht. Geef toestemming voor
        locatie, beweging en camera.
      </p>
    </div>
  );
}
