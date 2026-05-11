// Roster picker. Native <dialog> with focus trap + Esc handling.
// Already-placed entries are dimmed and disabled — admin removes via
// the marker popup on the map, then re-picks here.

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [query, setQuery] = useState("");

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
    if (open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SORTED;
    const asNum = Number(q);
    return SORTED.filter((e) => {
      if (Number.isInteger(asNum) && asNum > 0) {
        if (String(e.dex).padStart(3, "0").includes(q) || String(e.dex) === q)
          return true;
      }
      return e.name.toLowerCase().includes(q);
    });
  }, [query]);

  return (
    <dialog ref={ref} className={s.dialog} onClose={onClose}>
      <header className={s.header}>
        <h2 className={s.title}>Kies Pokémon</h2>
        <button className={s.close} onClick={onClose} aria-label="Sluiten">
          ×
        </button>
      </header>
      <div className={s.searchWrap}>
        <input
          className={s.search}
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Zoek op naam of #dex"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <ul className={s.list}>
        {filtered.length === 0 && (
          <li className={s.empty}>Niets gevonden</li>
        )}
        {filtered.map((entry) => (
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
