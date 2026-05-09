// Rendered on /pokedex when no spawns are placed yet. Sends the user
// to /admin to set up the hunt.

import { Link } from "react-router-dom";
import s from "./EmptyHunt.module.scss";

export function EmptyHunt() {
  return (
    <div className={s.screen}>
      <h1>No hunt configured</h1>
      <p>An admin should place pokémon on the map before starting the hunt.</p>
    </div>
  );
}
