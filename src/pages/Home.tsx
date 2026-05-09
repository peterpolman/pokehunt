// Landing page. CTA routes to /admin (place a safari); when a safari is
// already placed, a secondary link routes to /pokedex.

import { Link } from "react-router-dom";
import { ROSTER, SPAWNS } from "../data/spawns.ts";
import s from "./Home.module.scss";

const FEATURES = [
  "Plaats je eigen safari op de kaart",
  "Volg het kompas naar de dichtstbijzijnde pokémon",
  "Vang ze in AR met de camera",
  "Maak een foto als bewijs",
  "Voortgang wordt automatisch bewaard",
];

export function Home() {
  const hasSafari = SPAWNS.length > 0;
  const sorted = [...ROSTER].sort((a, b) => a.dex - b.dex);

  return (
    <div className={s.page}>
      <header className={s.hero}>
        <h1 className={s.title}>POKÉ SAFARI</h1>
        <p className={s.tagline}>Loop. Vind. Flits!</p>
      </header>

      <section className={s.body}>
        <ul className={s.features}>
          {FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>

        <div className={s.cta}>
          <Link to="/admin" className={s.ctaButton}>
            Plaats safari
          </Link>
          {hasSafari && (
            <Link to="/pokedex" className={s.ctaLink}>
              Verder met safari
            </Link>
          )}
        </div>

        <h2 className={s.gridHeading}>Beschikbare pokémon</h2>
        <ul className={s.grid}>
          {sorted.map((r) => (
            <li key={r.id} className={s.cell}>
              <img className={s.cellImg} src={r.image} alt={r.name} />
              <span className={s.cellDex}>
                #{String(r.dex).padStart(3, "0")}
              </span>
              <span className={s.cellName}>{r.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
