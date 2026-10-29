// Logika murni lokasi & kecepatan, dipakai klien.

export const DURATION_OPTIONS: readonly { min: number; label: string }[] = [
  { min: 15, label: '15 menit' },
  { min: 60, label: '1 jam' },
  { min: 240, label: '4 jam' },
  { min: 480, label: '8 jam' },
];
export const MAX_VIEWERS = 7;
export const STALE_MS = 120_000; // tanpa pembaruan selama ini = "tidak tersedia"
export const HEARTBEAT_MS = 60_000; // diam di tempat: kirim penanda hidup tiap menit
export const MIN_PUBLISH_MS = 5_000; // batas bawah klien (server menolak < 2 dtk)
export const MOVE_PUBLISH_M = 25;
export const HISTORY_INTERVAL_MS = 60_000;
export const HISTORY_RETENTION_DAYS = 7; // riwayat yang diaktifkan pengguna
export const SESSION_RETENTION_HOURS = 24; // metadata sesi tanpa riwayat

export function isAllowedDuration(min: number): boolean {
  return DURATION_OPTIONS.some((d) => d.min === min);
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceOfPath(points: GeoPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) total += haversineMeters(a, b);
  }
  return total;
}

export function isValidCoord(lat: unknown, lng: unknown): boolean {
  return typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// ---------- Kecepatan ----------

export const SPEED = { maxPlausibleMps: 100, goodAccuracyM: 50, maxAccuracyM: 100, minDtS: 1, maxDtS: 60 } as const;

export interface GeoSample extends GeoPoint {
  accuracy: number;
  speed: number | null; // coords.speed (m/s) bila tersedia
  timestampMs: number;
}
export type SpeedSource = 'gps' | 'estimated';
export interface SpeedReading {
  mps: number | null;
  source: SpeedSource | null;
  /** true hanya untuk nilai coords.speed dengan akurasi baik. Estimasi dari koordinat tidak pernah "trusted". */
  trusted: boolean;
}
export interface SpeedTracker {
  prev: GeoSample | null;
  max: number | null;
  sum: number;
  n: number;
}

export function initialTracker(): SpeedTracker {
  return { prev: null, max: null, sum: 0, n: 0 };
}

/**
 * Menghitung kecepatan dari satu sampel GPS.
 * - Pakai coords.speed bila ada dan masuk akal; tandai tepercaya hanya bila akurasi baik.
 * - Bila tidak ada: estimasi dari jarak geodesik / selang waktu, dengan filter derau GPS
 *   (gerak lebih kecil dari separuh rata-rata akurasi dianggap diam) dan batas kewajaran.
 * - Data tidak valid TIDAK diubah menjadi angka: hasilnya null.
 */
export function updateTracker(t: SpeedTracker, s: GeoSample): { tracker: SpeedTracker; reading: SpeedReading } {
  const none: SpeedReading = { mps: null, source: null, trusted: false };
  if (!isValidCoord(s.lat, s.lng) || !Number.isFinite(s.accuracy) || s.accuracy < 0 || s.accuracy > SPEED.maxAccuracyM) {
    return { tracker: t, reading: none }; // sampel akurasi buruk tidak dipakai sama sekali
  }
  let reading: SpeedReading = none;
  if (s.speed !== null && Number.isFinite(s.speed) && s.speed >= 0 && s.speed <= SPEED.maxPlausibleMps) {
    reading = { mps: s.speed, source: 'gps', trusted: s.accuracy <= SPEED.goodAccuracyM };
  } else if (t.prev) {
    const dt = (s.timestampMs - t.prev.timestampMs) / 1000;
    if (dt >= SPEED.minDtS && dt <= SPEED.maxDtS) {
      const d = haversineMeters(t.prev, s);
      const noise = (t.prev.accuracy + s.accuracy) / 2;
      const mps = d <= noise * 0.5 ? 0 : d / dt;
      if (mps <= SPEED.maxPlausibleMps) reading = { mps, source: 'estimated', trusted: false };
    }
  }
  const tracker: SpeedTracker = { prev: s, max: t.max, sum: t.sum, n: t.n };
  if (reading.mps !== null) {
    tracker.max = Math.max(t.max ?? 0, reading.mps);
    tracker.sum = t.sum + reading.mps;
    tracker.n = t.n + 1;
  }
  return { tracker, reading };
}

/** Rata-rata dari bacaan valid selama sesi (bukan rata-rata berbobot waktu). */
export function averageMps(t: SpeedTracker): number | null {
  return t.n > 0 ? t.sum / t.n : null;
}

export const mpsToKmh = (mps: number): number => mps * 3.6;
export function formatSpeed(mps: number | null | undefined): string {
  return typeof mps === 'number' && Number.isFinite(mps) ? `${Math.round(mpsToKmh(mps))} km/j` : '—';
}

/** Interval adaptif: hemat baterai dan biaya, tetap responsif saat bergerak. */
export function shouldPublish(last: (GeoPoint & { tsMs: number }) | null, cur: GeoPoint, mps: number | null, nowMs: number): boolean {
  if (!last) return true;
  const dt = nowMs - last.tsMs;
  if (dt < MIN_PUBLISH_MS) return false;
  if (haversineMeters(last, cur) >= MOVE_PUBLISH_M) return true;
  if ((mps ?? 0) > 1.5) return true;
  return dt >= HEARTBEAT_MS;
}

// ---------- Status sesi ----------

export type SessionStatus = 'live' | 'waiting' | 'unavailable' | 'stopped' | 'expired';

export function sessionStatus(i: { active: boolean | null; expiresAtMs: number | null; lastTsMs: number | null; connOnline: boolean | null; nowMs: number }): SessionStatus {
  if (i.expiresAtMs !== null && i.nowMs >= i.expiresAtMs) return 'expired';
  if (i.active === false) return 'stopped';
  if (i.lastTsMs === null) return i.connOnline === false ? 'unavailable' : 'waiting';
  if (i.connOnline === false || i.nowMs - i.lastTsMs > STALE_MS) return 'unavailable';
  return 'live';
}

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return 'baru saja';
  if (s < 60) return `${s} dtk lalu`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} mnt lalu` : `${Math.round(m / 60)} jam lalu`;
}
