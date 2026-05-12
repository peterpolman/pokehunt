// Leaflet map. Built once on first show, then updates user marker + caught
// states as compass state changes. Initialising Leaflet on every state
// update would be insanely expensive — that's why this is imperative inside
// useEffect, not declarative JSX.

import { useEffect, useRef } from "react";
import L, { type Map as LMap, type Marker, type Circle } from "leaflet";
import "leaflet/dist/leaflet.css";
import s from "./MapView.module.scss";

interface Props {
  state: CompassState;
  spawns: Spawn[];
  found: Set<number>;
  visible: boolean;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  /** When set with `markerActionLabel`, marker click opens a Leaflet popup
   *  whose button invokes this with the spawn id. */
  onMarkerAction?: (spawnId: number) => void;
  markerActionLabel?: string;
  markersInteractive?: boolean;
  /** When true, uncaught spawns render as black silhouettes until caught. */
  silhouetteUncaught?: boolean;
}

const FALLBACK_CENTER: [number, number] = [52.367, 4.844];

export function MapView({
  state,
  spawns,
  found,
  visible,
  onMapClick,
  onMarkerAction,
  markerActionLabel,
  markersInteractive,
  silhouetteUncaught,
}: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const accuracyCircleRef = useRef<Circle | null>(null);
  const spawnMarkersRef = useRef<
    Map<number, { marker: Marker; circle: Circle }>
  >(new Map());
  const onMapClickRef = useRef(onMapClick);
  const onMarkerActionRef = useRef(onMarkerAction);
  onMapClickRef.current = onMapClick;
  onMarkerActionRef.current = onMarkerAction;

  // Build map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const center: [number, number] = state.position
      ? [state.position.lat, state.position.lng]
      : spawns.length > 0
        ? [spawns[0].lat, spawns[0].lng]
        : FALLBACK_CENTER;

    const map = L.map(mapEl.current, { zoomControl: true }).setView(center, 18);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    const applyZoomClasses = () => {
      const z = map.getZoom();
      const el = map.getContainer();
      el.classList.toggle(s.circlesHidden, z < 14);
    };
    applyZoomClasses();
    map.on("zoomend", applyZoomClasses);

    mapRef.current = map;
  }, []);

  // Sync spawn markers with the spawns prop. Cheap to rebuild — at most 22.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const next = new Set(spawns.map((sp) => sp.id));
    for (const [id, { marker, circle }] of spawnMarkersRef.current) {
      if (!next.has(id)) {
        map.removeLayer(marker);
        map.removeLayer(circle);
        spawnMarkersRef.current.delete(id);
      }
    }

    for (const spawn of spawns) {
      const existing = spawnMarkersRef.current.get(spawn.id);
      if (existing) {
        existing.marker.setLatLng([spawn.lat, spawn.lng]);
        existing.circle.setLatLng([spawn.lat, spawn.lng]);
        continue;
      }
      const silhouette = silhouetteUncaught && !found.has(spawn.id);
      const cls = silhouette ? `${s.spawnSprite} ${s.silhouette}` : s.spawnSprite;
      const html = `<img class="${cls}" src="${spawn.image}" alt="${spawn.name}" />`;
      const icon = L.divIcon({
        className: s.spawnIcon,
        html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([spawn.lat, spawn.lng], {
        icon,
        interactive: !!markersInteractive,
      }).addTo(map);
      if (markersInteractive && markerActionLabel) {
        const btn = document.createElement("button");
        btn.textContent = markerActionLabel;
        btn.className = s.popupAction;
        btn.addEventListener("click", () => {
          marker.closePopup();
          onMarkerActionRef.current?.(spawn.id);
        });
        marker.bindPopup(btn, { closeButton: false, offset: [0, -16] });
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
        });
      }
      const circle = L.circle([spawn.lat, spawn.lng], {
        radius: spawn.catchRadius,
        color: "#3b82f6",
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.08,
        interactive: false,
        className: s.spawnCircle,
      }).addTo(map);
      spawnMarkersRef.current.set(spawn.id, { marker, circle });
    }
  }, [spawns, markersInteractive, markerActionLabel]);

  // Recompute size when the overlay flips visible — Leaflet caches the
  // container size on init and shows tiles wrong after a display: none.
  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
      if (state.position) {
        mapRef.current.setView(
          [state.position.lat, state.position.lng],
          mapRef.current.getZoom(),
        );
      }
    }
  }, [visible]);

  // User marker + caught-state opacity. Driven by props; runs every render.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pos = state.position;
    if (pos) {
      const latlng: [number, number] = [pos.lat, pos.lng];
      const rot = typeof state.heading === "number" ? state.heading : 0;
      const html = `
        <div class="${s.userRotator}" style="transform: rotate(${rot}deg)">
          <div class="${s.userDot}">
            <div class="${s.userArrow}">
              <div class="${s.userBall}"></div>
            </div>
          </div>
        </div>`;
      const icon = L.divIcon({
        className: s.userIcon,
        html,
        iconSize: [52, 50],
        iconAnchor: [26, 20],
      });
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(latlng, {
          icon,
          interactive: false,
        }).addTo(map);
        accuracyCircleRef.current = L.circle(latlng, {
          radius: pos.accuracy,
          color: "#3b82f6",
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.08,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(latlng);
        userMarkerRef.current.setIcon(icon);
        accuracyCircleRef.current?.setLatLng(latlng);
        accuracyCircleRef.current?.setRadius(pos.accuracy);
      }
    }

    for (const [id, { marker }] of spawnMarkersRef.current) {
      const img = marker.getElement()?.querySelector("img");
      if (img) img.classList.toggle(s.silhouette, !!silhouetteUncaught && !found.has(id));
    }
  }, [state, found, silhouetteUncaught]);

  return (
    <div className={`${s.overlay}${visible ? " " + s.open : ""}`}>
      <div ref={mapEl} className={s.map} />
    </div>
  );
}
