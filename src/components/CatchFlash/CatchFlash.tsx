import s from './CatchFlash.module.scss';

interface Props {
  active: boolean;
}

/** White-to-transparent overlay flash on catch. The active prop pulses
 *  the CSS animation. Parent flips it on then back off after 200 ms. */
export function CatchFlash({ active }: Props) {
  return <div className={`${s.flash}${active ? ' ' + s.flashActive : ''}`} />;
}
