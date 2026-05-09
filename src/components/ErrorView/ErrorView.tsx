import s from './ErrorView.module.scss';

interface Props {
  message: string;
}

export function ErrorView({ message }: Props) {
  return (
    <div className={s.screen}>
      <h1>Can't continue</h1>
      <p>{message}</p>
      <button className={s.button} onClick={() => location.reload()}>
        Reload
      </button>
    </div>
  );
}
