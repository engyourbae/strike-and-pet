import { useCallback, useEffect, useRef, useState } from 'react';
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';

const FRESH_MS = 8000;

/** Indikator mengetik sementara (Realtime Database, dihapus otomatis saat putus). Nonaktif bila RTDB belum dikonfigurasi. */
export function useTyping(cid: string, myUid: string) {
  const [raw, setRaw] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const offset = useRef(0);
  const lastSent = useRef(0);
  const stopTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const rtdb = getRtdb();
    if (!rtdb) return;
    const unsubOffset = onValue(ref(rtdb, '.info/serverTimeOffset'), (s) => { offset.current = typeof s.val() === 'number' ? (s.val() as number) : 0; });
    const unsub = onValue(ref(rtdb, `typing/${cid}`), (snap) => {
      const v: unknown = snap.val();
      const next: Record<string, number> = {};
      if (typeof v === 'object' && v !== null) for (const [u, t] of Object.entries(v)) if (typeof t === 'number') next[u] = t;
      setRaw(next);
    });
    const tick = window.setInterval(() => setNow(Date.now()), 2000);
    return () => {
      unsub();
      unsubOffset();
      window.clearInterval(tick);
      window.clearTimeout(stopTimer.current);
      void remove(ref(rtdb, `typing/${cid}/${myUid}`)).catch(() => undefined);
    };
  }, [cid, myUid]);

  const stop = useCallback(() => {
    const rtdb = getRtdb();
    window.clearTimeout(stopTimer.current);
    lastSent.current = 0;
    if (rtdb) void remove(ref(rtdb, `typing/${cid}/${myUid}`)).catch(() => undefined);
  }, [cid, myUid]);

  const notify = useCallback(() => {
    const rtdb = getRtdb();
    if (!rtdb) return;
    window.clearTimeout(stopTimer.current);
    stopTimer.current = window.setTimeout(stop, 4000);
    const t = Date.now();
    if (t - lastSent.current < 2500) return;
    lastSent.current = t;
    const r = ref(rtdb, `typing/${cid}/${myUid}`);
    void set(r, serverTimestamp()).catch(() => undefined);
    void onDisconnect(r).remove().catch(() => undefined);
  }, [cid, myUid, stop]);

  const typers = Object.entries(raw).filter(([u, t]) => u !== myUid && now + offset.current - t < FRESH_MS).map(([u]) => u);
  return { typers, notify, stop };
}
