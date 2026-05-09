// Admin page. Click map → pick pokemon from roster → place at clicked
// coordinate. Click placed marker → popup with Remove. Reset wipes all.
// Persists to localStorage; /pokedex consumes it on next load.

import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { Content } from "../components/Content";
import { MapView } from "../components/MapView";
import { PokemonDialog } from "../components/PokemonDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ROSTER } from "../data/spawns.ts";
import {
  clearPlaced,
  loadPlaced,
  savePlaced,
  type Placed,
} from "../data/placed.ts";
import s from "../app.module.scss";

const ROSTER_BY_ID = new Map(ROSTER.map((r) => [r.id, r]));

function buildSpawns(placed: Placed[]): Spawn[] {
  return placed.flatMap((p): Spawn[] => {
    const r = ROSTER_BY_ID.get(p.id);
    if (!r) return [];
    return [
      {
        id: r.id,
        name: r.name,
        lat: p.lat,
        lng: p.lng,
        altitude: 0 as Meters,
        model: r.model,
        image: r.image,
        scale: r.scale,
        catchRadius: r.catchRadius,
      },
    ];
  });
}

export function Admin() {
  const [placed, setPlaced] = useState<Placed[]>(() => loadPlaced());
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [pendingLatLng, setPendingLatLng] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [notification, setNotification] = useState("");
  const watchId = useRef<number | null>(null);

  const placedIds = useMemo(() => new Set(placed.map((p) => p.id)), [placed]);
  const spawns = useMemo(() => buildSpawns(placed), [placed]);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy as Meters,
        }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    watchId.current = navigator.geolocation.watchPosition(
      (pos) =>
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy as Meters,
        }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 },
    );
    return () => {
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const persist = (next: Placed[]) => {
    setPlaced(next);
    savePlaced(next);
  };

  const onMapClick = (latlng: { lat: number; lng: number }) => {
    setPendingLatLng(latlng);
  };

  const onPick = (id: number) => {
    if (!pendingLatLng) return;
    const entry = ROSTER_BY_ID.get(id);
    persist([...placed, { id, ...pendingLatLng }]);
    setPendingLatLng(null);
    if (entry) setNotification(`Placed ${entry.name.toUpperCase()}`);
  };

  const onMarkerAction = (id: number) => {
    const entry = ROSTER_BY_ID.get(id);
    persist(placed.filter((p) => p.id !== id));
    if (entry) setNotification(`Removed ${entry.name.toUpperCase()}`);
  };

  const onResetConfirm = () => {
    clearPlaced();
    setPlaced([]);
    setResetOpen(false);
    setNotification("Cleared all");
  };

  const onDone = () => {
    window.location.assign("/pokedex");
  };

  const stubState: CompassState = {
    ready: position !== null,
    foundCount: 0,
    total: spawns.length,
    source: "none",
    position: position ?? undefined,
    headingStuck: false,
    weakGps: position ? position.accuracy > 20 : false,
  };

  return (
    <div className={s.app}>
      <Header
        mode="admin"
        placedCount={placed.length}
        total={ROSTER.length}
        onDone={onDone}
      />
      <Content>
        <MapView
          state={stubState}
          spawns={spawns}
          found={new Set()}
          visible
          onMapClick={onMapClick}
          markersInteractive
          markerActionLabel="Remove"
          onMarkerAction={onMarkerAction}
        />
      </Content>
      <Footer
        mode="admin"
        placedCount={placed.length}
        total={ROSTER.length}
        onReset={() => setResetOpen(true)}
        notification={notification}
      />

      <PokemonDialog
        open={pendingLatLng !== null}
        placedIds={placedIds}
        onPick={onPick}
        onClose={() => setPendingLatLng(null)}
      />
      <ConfirmDialog
        open={resetOpen}
        title="Reset all"
        message="Remove every placed pokémon and clear the hunt setup?"
        confirmLabel="Reset"
        cancelLabel="Cancel"
        onConfirm={onResetConfirm}
        onCancel={() => setResetOpen(false)}
      />
    </div>
  );
}
