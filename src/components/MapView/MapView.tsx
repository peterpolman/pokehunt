// Leaflet map. Built once on first show, then updates user marker + caught
// states as compass state changes. Initialising Leaflet on every state
// update would be insanely expensive — that's why this is imperative inside
// useEffect, not declarative JSX.

import { useEffect, useRef } from 'react';
import L, { type Map as LMap, type Marker, type Circle } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SPAWNS } from '../../data/spawns.ts';
import s from './MapView.module.scss';

interface Props {
  state: CompassState;
  found: Set<number>;
  visible: boolean;
}

export function MapView({ state, found, visible }: Props) {
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const accuracyCircleRef = useRef<Circle | null>(null);
  const spawnMarkersRef = useRef<Map<number, Marker>>(new Map());

  // Build map once.
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const center: [number, number] = state.position
      ? [state.position.lat, state.position.lng]
      : [SPAWNS[0].lat, SPAWNS[0].lng];

    const map = L.map(mapEl.current, { zoomControl: true }).setView(center, 18);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    for (const spawn of SPAWNS) {
      const html = `<img class="${s.spawnSprite}" src="${spawn.image}" alt="${spawn.name}" />`;
      const icon = L.divIcon({
        className: s.spawnIcon,
        html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([spawn.lat, spawn.lng], { icon, interactive: false }).addTo(map);
      L.circle([spawn.lat, spawn.lng], {
        radius: spawn.catchRadius,
        color: '#3b82f6',
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
      spawnMarkersRef.current.set(spawn.id, marker);
    }
    mapRef.current = map;
  }, []);

  // Recompute size when the overlay flips visible — Leaflet caches the
  // container size on init and shows tiles wrong after a display: none.
  useEffect(() => {
    if (visible && mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
      if (state.position) {
        mapRef.current.setView([state.position.lat, state.position.lng], mapRef.current.getZoom());
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
      const rot = typeof state.heading === 'number' ? state.heading : 0;
      const html = `
        <div class="${s.userDot}">
          <div class="${s.userArrow}" style="transform: rotate(${rot}deg)"></div>
        </div>`;
      const icon = L.divIcon({
        className: s.userIcon,
        html,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(latlng, { icon, interactive: false }).addTo(map);
        accuracyCircleRef.current = L.circle(latlng, {
          radius: pos.accuracy,
          color: '#3b82f6',
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

    for (const spawn of SPAWNS) {
      const m = spawnMarkersRef.current.get(spawn.id);
      if (!m) continue;
      const el = m.getElement();
      if (el) el.style.opacity = found.has(spawn.id) ? '0.35' : '1';
    }
  }, [state, found]);

  return (
    <div className={`${s.overlay}${visible ? ' ' + s.open : ''}`}>
      <div ref={mapEl} className={s.map} />
    </div>
  );
}
