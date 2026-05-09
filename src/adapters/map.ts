// Full-screen Leaflet map: user dot with heading arrow + sprite markers.
// Driven by app.ts — opens automatically when distance to nearest creature
// >= AR_DISTANCE_M, closes when below. Built once after compass.start.

import L, { type Map as LMap, type Marker, type Circle } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Compass } from './compass.ts';
import { SPAWNS } from '../data/spawns.ts';

export interface MapHandle {
  show: () => void;
  hide: () => void;
  refresh: () => void;
}

export function attachMap(compass: Compass): MapHandle {
  const overlay = document.getElementById('map-overlay');
  if (!overlay) return { show: () => {}, hide: () => {}, refresh: () => {} };

  let map: LMap | null = null;
  let userMarker: Marker | null = null;
  let userAccuracyCircle: Circle | null = null;
  const spawnMarkers = new Map<number, Marker>();
  const distanceEl = document.getElementById('map-distance');
  let built = false;

  const build = (): void => {
    if (built) return;
    const center: [number, number] = compass.position
      ? [compass.position.lat, compass.position.lng]
      : [SPAWNS[0].lat, SPAWNS[0].lng];

    map = L.map('map', { zoomControl: true }).setView(center, 18);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    for (const s of SPAWNS) {
      const html = `<img class="spawn-sprite" src="${s.image}" alt="${s.name}" />`;
      const icon = L.divIcon({
        className: 'spawn-icon',
        html,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
      const marker = L.marker([s.lat, s.lng], { icon, interactive: false }).addTo(map);
      L.circle([s.lat, s.lng], {
        radius: s.catchRadius,
        color: '#3b82f6',
        weight: 1,
        opacity: 0.5,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map);
      spawnMarkers.set(s.id, marker);
    }
    built = true;
  };

  /** Custom DivIcon with a rotated arrow showing compass heading. */
  const upsertUserMarker = (latlng: [number, number], headingDeg: number | undefined, accuracyM: number): void => {
    if (!map) return;
    const rot = typeof headingDeg === 'number' ? headingDeg : 0;
    const html = `
      <div class="user-dot">
        <div class="user-arrow" style="transform: rotate(${rot}deg)"></div>
      </div>`;
    const icon = L.divIcon({
      className: 'user-icon',
      html,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
    if (!userMarker) {
      userMarker = L.marker(latlng, { icon, interactive: false }).addTo(map);
      userAccuracyCircle = L.circle(latlng, {
        radius: accuracyM,
        color: '#3b82f6',
        weight: 1,
        opacity: 0.4,
        fillOpacity: 0.08,
      }).addTo(map);
    } else {
      userMarker.setLatLng(latlng);
      userMarker.setIcon(icon);
      userAccuracyCircle?.setLatLng(latlng);
      userAccuracyCircle?.setRadius(accuracyM);
    }
  };

  const refresh = (): void => {
    if (!map) return;
    const state = compass.state();
    const pos = state.position;

    if (distanceEl) {
      if (state.target && state.distance !== undefined) {
        distanceEl.textContent = `${state.target.name} — ${Math.round(state.distance)} m`;
      } else if (state.foundCount === state.total) {
        distanceEl.textContent = 'All caught!';
      } else {
        distanceEl.textContent = '— m';
      }
    }
    if (pos) upsertUserMarker([pos.lat, pos.lng], state.heading, pos.accuracy);

    for (const s of SPAWNS) {
      const m = spawnMarkers.get(s.id);
      if (!m) continue;
      const el = m.getElement();
      if (el) el.style.opacity = compass.found.has(s.id) ? '0.35' : '1';
    }
  };

  return {
    show: () => {
      if (overlay.classList.contains('map-open')) return;
      build();
      overlay.classList.add('map-open');
      // Leaflet needs a size recalc after the container becomes visible.
      setTimeout(() => map && map.invalidateSize(), 50);
      refresh();
      if (map && compass.position) {
        map.setView([compass.position.lat, compass.position.lng], map.getZoom());
      }
    },
    hide: () => overlay.classList.remove('map-open'),
    refresh,
  };
}
