import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  label: string;
  photoURL: string | null;
  /** true = bukan lokasi real-time (pengirim offline/berhenti memperbarui). */
  stale: boolean;
}

function avatarEl(m: MapMarker): HTMLElement {
  const el = document.createElement('div');
  el.className = `map-avatar${m.stale ? ' map-avatar--stale' : ''}`;
  if (m.photoURL) {
    const img = document.createElement('img');
    img.src = m.photoURL;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    el.appendChild(img);
  } else {
    el.textContent = m.label.trim().charAt(0).toUpperCase() || '?'; // textContent: aman dari XSS
  }
  return el;
}

/**
 * Peta OpenStreetMap (Leaflet). Hanya ubin peta yang diminta dari tile.openstreetmap.org (area yang dilihat);
 * koordinat anggota tidak dikirim ke layanan peta. Atribusi OSM wajib ditampilkan.
 */
export function LiveMap({ markers, track, height = 340 }: { markers: MapMarker[]; track?: [number, number][]; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const [tileFailed, setTileFailed] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, { zoomControl: true }).setView([-2.5, 118], 4);
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });
    tiles.on('tileerror', () => setTileFailed(true));
    tiles.on('tileload', () => setTileFailed(false));
    tiles.addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      layer.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    if (track && track.length > 1) {
      L.polyline(track, { color: '#5b3df5', weight: 4, opacity: 0.8 }).addTo(g);
      pts.push(...track);
    }
    for (const mk of markers) {
      const ll: L.LatLngExpression = [mk.lat, mk.lng];
      if (mk.accuracy !== null && mk.accuracy > 0) L.circle(ll, { radius: mk.accuracy, color: mk.stale ? '#8a8fa8' : '#5b3df5', weight: 1, fillOpacity: 0.1 }).addTo(g);
      L.marker(ll, { icon: L.divIcon({ html: avatarEl(mk), className: 'map-icon', iconSize: [40, 40], iconAnchor: [20, 20] }), title: mk.label, keyboard: false }).addTo(g);
      pts.push(ll);
    }
    if (!fitted.current && pts.length > 0) {
      fitted.current = true;
      if (pts.length === 1) m.setView(pts[0] as L.LatLngExpression, 16);
      else m.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 17 });
    }
  }, [markers, track]);

  return (
    <div>
      <div ref={host} className="live-map" style={{ height }} role="region" aria-label="Peta lokasi" />
      {tileFailed && <p className="field-hint" role="status">Peta gagal dimuat (periksa koneksi). Koordinat dan status tetap ditampilkan di bawah.</p>}
    </div>
  );
}
