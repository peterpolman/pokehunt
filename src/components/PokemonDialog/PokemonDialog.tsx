// Roster picker. Native <dialog> with focus trap + Esc handling.
// Already-placed entries are dimmed and disabled — admin removes via
// the marker popup on the map, then re-picks here.

import { useEffect, useRef } from "react";
import { ROSTER, type RosterEntry } from "../../data/spawns.ts";
import s from "./PokemonDialog.module.scss";

interface Props {
  open: boolean;
  placedIds: Set<number>;
  onPick: (id: number) => void;
  onClose: () => void;
}

const SORTED = [...ROSTER].sort((a, b) => a.dex - b.dex);

export function PokemonDialog({ open, placedIds, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className={s.dialog} onClose={onClose}>
      <header className={s.header}>
        <h2 className={s.title}>Kies Pokémon</h2>
        <button className={s.close} onClick={onClose} aria-label="Sluiten">
          ×
        </button>
      </header>
      <ul className={s.list}>
        {SORTED.map((entry) => (
          <RosterItem
            key={entry.id}
            entry={entry}
            placed={placedIds.has(entry.id)}
            onPick={onPick}
          />
        ))}
      </ul>
    </dialog>
  );
}

function RosterItem({
  entry,
  placed,
  onPick,
}: {
  entry: RosterEntry;
  placed: boolean;
  onPick: (id: number) => void;
}) {
  return (
    <li>
      <button
        className={`${s.item}${placed ? " " + s.placed : ""}`}
        disabled={placed}
        onClick={() => onPick(entry.id)}
      >
        <img
          className={s.thumb}
          src={entry.image}
          alt={entry.name}
          loading="lazy"
        />
        <span className={s.name}>{entry.name}</span>
        <span className={s.dex}>#{String(entry.dex).padStart(3, "0")}</span>
      </button>
    </li>
  );
}
