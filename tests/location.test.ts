import { describe, expect, it } from 'vitest';
import {
  STALE_MS, averageMps, distanceOfPath, formatAge, formatSpeed, haversineMeters, initialTracker, isAllowedDuration, isValidCoord, sessionStatus,
  shouldPublish, updateTracker, type GeoSample,
} from '@/shared/locationLogic';

const base = { lat: -6.2, lng: 106.8 };
const S = (o: Partial<GeoSample> = {}): GeoSample => ({ ...base, accuracy: 10, speed: null, timestampMs: 0, ...o });

describe('jarak geodesik', () => {
  it('1 derajat lintang ≈ 111 km dan titik sama = 0', () => {
    expect(Math.abs(haversineMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_195)).toBeLessThan(200);
    expect(haversineMeters(base, base)).toBe(0);
  });
  it('panjang lintasan dan validasi koordinat', () => {
    expect(Math.abs(distanceOfPath([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 }, { lat: 0, lng: 0.002 }]) - 222.4)).toBeLessThan(2);
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(Number.NaN, 0)).toBe(false);
    expect(isValidCoord(-6.2, 106.8)).toBe(true);
  });
});

describe('filter kecepatan', () => {
  it('coords.speed valid: tepercaya hanya bila akurasi baik', () => {
    expect(updateTracker(initialTracker(), S({ speed: 12 })).reading).toEqual({ mps: 12, source: 'gps', trusted: true });
    expect(updateTracker(initialTracker(), S({ speed: 12, accuracy: 80 })).reading).toEqual({ mps: 12, source: 'gps', trusted: false });
  });
  it('akurasi buruk, kecepatan mustahil, negatif, atau NaN tidak diubah menjadi angka', () => {
    const none = { mps: null, source: null, trusted: false };
    expect(updateTracker(initialTracker(), S({ speed: 12, accuracy: 500 })).reading).toEqual(none);
    expect(updateTracker(initialTracker(), S({ speed: 500 })).reading.mps).toBeNull();
    expect(updateTracker(initialTracker(), S({ speed: -1 })).reading.mps).toBeNull();
    expect(updateTracker(initialTracker(), S({ speed: Number.NaN })).reading.mps).toBeNull();
    expect(updateTracker(initialTracker(), S({ accuracy: 500 })).tracker.prev).toBeNull();
  });
  it('estimasi dari koordinat diberi label estimasi dan tidak pernah tepercaya', () => {
    const t = updateTracker(initialTracker(), S({ timestampMs: 0 })).tracker;
    const r = updateTracker(t, S({ lng: base.lng + 0.001, timestampMs: 10_000 })).reading;
    expect(r.source).toBe('estimated');
    expect(r.trusted).toBe(false);
    expect(Math.abs((r.mps ?? 0) - 11.1)).toBeLessThan(0.3);
  });
  it('derau GPS saat diam menjadi 0, bukan kecepatan palsu', () => {
    const t = updateTracker(initialTracker(), S({ accuracy: 20, timestampMs: 0 })).tracker;
    expect(updateTracker(t, S({ accuracy: 20, lat: base.lat + 0.00004, timestampMs: 5000 })).reading.mps).toBe(0);
  });
  it('selang waktu terlalu panjang/pendek dan lompatan GPS ditolak', () => {
    const t = updateTracker(initialTracker(), S({ timestampMs: 0 })).tracker;
    expect(updateTracker(t, S({ lng: 106.81, timestampMs: 120_000 })).reading.mps).toBeNull();
    expect(updateTracker(t, S({ lng: 106.81, timestampMs: 500 })).reading.mps).toBeNull();
    expect(updateTracker(t, S({ lng: 107.8, timestampMs: 2000 })).reading.mps).toBeNull();
  });
  it('maksimum dan rata-rata', () => {
    let t = initialTracker();
    for (const v of [10, 20, 0]) t = updateTracker(t, S({ speed: v })).tracker;
    expect(t.max).toBe(20);
    expect(averageMps(t)).toBe(10);
    expect(averageMps(initialTracker())).toBeNull();
    expect(formatSpeed(10)).toBe('36 km/j');
    expect(formatSpeed(null)).toBe('—');
  });
});

describe('interval pengiriman adaptif', () => {
  const last = { ...base, tsMs: 0 };
  it('mengikuti batas bawah, gerak, perpindahan, dan heartbeat', () => {
    expect(shouldPublish(null, base, 0, 0)).toBe(true);
    expect(shouldPublish(last, base, 20, 4000)).toBe(false);
    expect(shouldPublish(last, base, 0, 20_000)).toBe(false);
    expect(shouldPublish(last, base, 0, 60_000)).toBe(true);
    expect(shouldPublish(last, base, 8, 6000)).toBe(true);
    expect(shouldPublish(last, { lat: base.lat, lng: 106.8003 }, 0, 6000)).toBe(true);
  });
});

describe('status sesi', () => {
  const n = 1_000_000;
  const i = { active: true as boolean | null, expiresAtMs: n + 1000 as number | null, lastTsMs: n - 1000 as number | null, connOnline: true as boolean | null, nowMs: n };
  it('live, waiting, unavailable, stopped, expired', () => {
    expect(sessionStatus(i)).toBe('live');
    expect(sessionStatus({ ...i, lastTsMs: null, connOnline: null })).toBe('waiting');
    expect(sessionStatus({ ...i, lastTsMs: n - STALE_MS - 1 })).toBe('unavailable');
    expect(sessionStatus({ ...i, connOnline: false })).toBe('unavailable');
    expect(sessionStatus({ ...i, active: false })).toBe('stopped');
    expect(sessionStatus({ ...i, expiresAtMs: n })).toBe('expired');
  });
  it('durasi diizinkan dan format umur pembaruan', () => {
    expect(isAllowedDuration(60)).toBe(true);
    expect(isAllowedDuration(1000)).toBe(false);
    expect(formatAge(3000)).toBe('baru saja');
    expect(formatAge(30_000)).toBe('30 dtk lalu');
    expect(formatAge(5 * 60_000)).toBe('5 mnt lalu');
  });
});
