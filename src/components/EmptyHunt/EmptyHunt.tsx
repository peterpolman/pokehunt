// Rendered on /pokedex when no spawns are placed yet. Sends the user
// to /admin to set up the hunt.

import { Link } from "react-router-dom";
import s from "./EmptyHunt.module.scss";

export function EmptyHunt() {
  return (
    <div className={s.screen}>
      <h1>Geen safari ingesteld</h1>
      <p>Een admin moet pokémon op de kaart plaatsen voordat de safari begint.</p>
    </div>
  );
}
