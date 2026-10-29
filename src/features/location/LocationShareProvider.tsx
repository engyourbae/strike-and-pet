import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onDisconnect, onValue, ref, serverTimestamp as rtServerTimestamp, set } from 'firebase/database';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { getRtdb } from '@/lib/firebase/rtdb';
import {
  HISTORY_INTERVAL_MS, averageMps, initialTracker, shouldPublish, updateTracker, type GeoPoint, type GeoSample, type SpeedReading, type SpeedTracker,
} from '@/shared/locationLogic';
import type { LocationSession } from '@/types/location';
import { describeLocationError, startLocationSession, stopLocationSession, type StartOptions } from './location.service';

export interface ShareInfo {
  sessionId: string;
  groupName: string;
  expiresAtMs: number;
  historyEnabled: boolean;
}

export interface ShareState {
  phase: 'idle' | 'starting' | 'sharing';
  info: ShareInfo | null;
  error: string | null;
  warning: string | null;
  connected: boolean;
  lastFixMs: number | null;
  lastPublishMs: number | null;
  accuracy: number | null;
  reading: SpeedReading | null;
  maxMps: number | null;
  avgMps: number | null;
}

const IDLE: ShareState = {
  phase: 'idle', info: null, error: null, warning: null, connected: true, lastFixMs: null, lastPublishMs: null, accuracy: null, reading: null, maxMps: null, avgMps: null,
};

interface Ctx {
  state: ShareState;
  supported: boolean;
  start: (opts: StartOptions & { groupName: string }) => Promise<boolean>;
  stop: (notice?: string) => Promise<void>;
  /** Melanjutkan sesi aktif milik sendiri setelah aplikasi dibuka ulang (selalu atas tindakan pengguna). */
  resume: (s: LocationSession) => boolean;
}

const LocationContext = createContext<Ctx>({ state: IDLE, supported: false, start: async () => false, stop: async () => {}, resume: () => false });

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const r1 = (n: number) => Math.round(n * 10) / 10;

function geoMessage(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return 'Izin lokasi ditolak atau dicabut. Aktifkan lagi di pengaturan browser untuk berbagi lokasi.';
  if (e.code === e.POSITION_UNAVAILABLE) return 'Lokasi tidak tersedia. Pastikan GPS aktif dan coba di area terbuka.';
  return 'Pencarian lokasi terlalu lama. Coba lagi.';
}

/**
 * Mengelola satu sesi berbagi lokasi di sisi pengirim. TIDAK pernah aktif otomatis: hanya setelah
 * pengguna menekan Mulai (atau Lanjutkan). Berhenti saat dihentikan, durasi habis, izin dicabut, atau komponen dilepas.
 */
export function LocationShareProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShareState>(IDLE);
  const watchId = useRef<number | null>(null);
  const expiryTimer = useRef<number | undefined>(undefined);
  const cleanups = useRef<(() => void)[]>([]);
  const wake = useRef<WakeLockSentinel | null>(null);
  const tracker = useRef<SpeedTracker>(initialTracker());
  const lastPub = useRef<(GeoPoint & { tsMs: number }) | null>(null);
  const lastHist = useRef(0);
  const current = useRef<ShareInfo | null>(null);
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator && getRtdb() !== null;

  const teardown = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    window.clearTimeout(expiryTimer.current);
    cleanups.current.forEach((fn) => fn());
    cleanups.current = [];
    current.current = null;
  }, []);

  const stop = useCallback(async (notice?: string) => {
    const info = current.current;
    teardown();
    setState({ ...IDLE, error: notice ?? null });
    if (info) {
      try {
        await stopLocationSession(info.sessionId);
      } catch {
        /* sesi tetap berakhir otomatis pada waktu kedaluwarsa */
      }
    }
  }, [teardown]);

  const begin = useCallback((info: ShareInfo): boolean => {
    const rt = getRtdb();
    if (!rt || !('geolocation' in navigator)) {
      setState({ ...IDLE, error: 'Berbagi lokasi membutuhkan Realtime Database dan GPS browser.' });
      return false;
    }
    teardown();
    current.current = info;
    tracker.current = initialTracker();
    lastPub.current = null;
    lastHist.current = 0;
    const sid = info.sessionId;

    // Status koneksi pengirim: "offline" otomatis terlihat penerima bila tab ditutup/koneksi putus.
    const connRef = ref(rt, `locations/${sid}/conn`);
    const unsubConn = onValue(ref(rt, '.info/connected'), (snap) => {
      const c = snap.val() === true;
      setState((p) => ({ ...p, connected: c }));
      if (c) void onDisconnect(connRef).set({ online: false, ts: rtServerTimestamp() }).then(() => set(connRef, { online: true, ts: rtServerTimestamp() })).catch(() => undefined);
    });
    cleanups.current.push(() => {
      unsubConn();
      void set(connRef, { online: false, ts: rtServerTimestamp() }).catch(() => undefined);
    });

    const onFix = (pos: GeolocationPosition) => {
      const now = Date.now();
      if (now >= info.expiresAtMs) {
        void stop('Sesi berakhir karena durasi habis.');
        return;
      }
      const c = pos.coords;
      const sample: GeoSample = { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy, speed: c.speed, timestampMs: pos.timestamp };
      const res = updateTracker(tracker.current, sample);
      tracker.current = res.tracker;
      setState((p) => ({ ...p, warning: null, lastFixMs: now, accuracy: c.accuracy, reading: res.reading, maxMps: res.tracker.max, avgMps: averageMps(res.tracker) }));

      if (!shouldPublish(lastPub.current, sample, res.reading.mps, now)) return;
      lastPub.current = { lat: sample.lat, lng: sample.lng, tsMs: now };
      const avg = averageMps(res.tracker);
      const payload: Record<string, unknown> = { lat: r6(sample.lat), lng: r6(sample.lng), acc: Math.round(c.accuracy), trust: res.reading.trusted, ts: rtServerTimestamp() };
      if (res.reading.mps !== null) { payload.speed = r1(res.reading.mps); payload.src = res.reading.source; }
      if (res.tracker.max !== null) payload.max = r1(res.tracker.max);
      if (avg !== null) payload.avg = r1(avg);
      set(ref(rt, `locations/${sid}/pos`), payload)
        .then(() => setState((p) => ({ ...p, lastPublishMs: now })))
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('PERMISSION_DENIED')) void stop('Sesi sudah berakhir di server.');
          else setState((p) => ({ ...p, warning: 'Gagal mengirim lokasi. Memeriksa koneksi…' }));
        });

      // Riwayat rute hanya bila diaktifkan eksplisit untuk sesi ini, dengan frekuensi rendah.
      if (info.historyEnabled && now - lastHist.current >= HISTORY_INTERVAL_MS) {
        lastHist.current = now;
        void addDoc(collection(getFirebase().db, 'locationSessions', sid, 'points'), {
          lat: r6(sample.lat), lng: r6(sample.lng), acc: Math.round(c.accuracy), speed: res.reading.mps === null ? null : r1(res.reading.mps), ts: serverTimestamp(),
        }).catch(() => undefined);
      }
    };

    const onGeoError = (e: GeolocationPositionError) => {
      if (e.code === e.PERMISSION_DENIED) void stop(geoMessage(e));
      else setState((p) => ({ ...p, warning: geoMessage(e) }));
    };

    watchId.current = navigator.geolocation.watchPosition(onFix, onGeoError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30_000 });
    expiryTimer.current = window.setTimeout(() => void stop('Sesi berakhir karena durasi habis.'), Math.max(0, info.expiresAtMs - Date.now()));

    // Izin dicabut saat sesi berjalan.
    void navigator.permissions?.query({ name: 'geolocation' }).then((st) => {
      const onChange = () => { if (st.state === 'denied') void stop('Izin lokasi dicabut. Berbagi lokasi dihentikan.'); };
      st.addEventListener('change', onChange);
      cleanups.current.push(() => st.removeEventListener('change', onChange));
    }).catch(() => undefined);

    // Cegah layar mati (membantu pengiriman tetap berjalan) dan beri tahu bila aplikasi di latar belakang.
    const requestWake = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') wake.current = await navigator.wakeLock.request('screen');
      } catch { /* tidak didukung/ditolak */ }
    };
    void requestWake();
    const onVis = () => {
      if (document.visibilityState === 'visible') { void requestWake(); setState((p) => ({ ...p, warning: null })); }
      else setState((p) => ({ ...p, warning: 'Aplikasi di latar belakang: browser dapat menghentikan pengiriman lokasi.' }));
    };
    document.addEventListener('visibilitychange', onVis);
    cleanups.current.push(() => { document.removeEventListener('visibilitychange', onVis); void wake.current?.release().catch(() => undefined); wake.current = null; });

    setState({ ...IDLE, phase: 'sharing', info });
    return true;
  }, [teardown, stop]);

  const start = useCallback(async (opts: StartOptions & { groupName: string }): Promise<boolean> => {
    setState({ ...IDLE, phase: 'starting' });
    if (!supported) {
      setState({ ...IDLE, error: 'Fitur ini membutuhkan GPS browser dan Realtime Database (VITE_FIREBASE_DATABASE_URL).' });
      return false;
    }
    // Minta izin dulu agar penolakan tidak meninggalkan sesi yang sudah dibuat.
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 20_000, maximumAge: 10_000 }));
    } catch (e) {
      setState({ ...IDLE, error: geoMessage(e as GeolocationPositionError) });
      return false;
    }
    try {
      const r = await startLocationSession({ groupId: opts.groupId, viewerUids: opts.viewerUids, durationMin: opts.durationMin, historyEnabled: opts.historyEnabled });
      return begin({ sessionId: r.sessionId, groupName: opts.groupName, expiresAtMs: r.expiresAtMs, historyEnabled: opts.historyEnabled });
    } catch (e) {
      setState({ ...IDLE, error: describeLocationError(e) });
      return false;
    }
  }, [supported, begin]);

  const resume = useCallback((s: LocationSession): boolean => {
    if (s.status !== 'active' || s.expiresAtMs <= Date.now()) return false;
    return begin({ sessionId: s.id, groupName: s.groupName, expiresAtMs: s.expiresAtMs, historyEnabled: s.historyEnabled });
  }, [begin]);

  useEffect(() => () => teardown(), [teardown]);

  const value = useMemo(() => ({ state, supported, start, stop, resume }), [state, supported, start, stop, resume]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationShare(): Ctx {
  return useContext(LocationContext);
}
