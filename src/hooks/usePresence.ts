import { useEffect, useState } from 'react';
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';

export interface Presence {
  online: boolean;
  lastChanged: number;
}

/** Memublikasikan status online HANYA bila pengguna mengaktifkannya; bila dimatikan, data dihapus. */
export function usePresencePublisher(enabled: boolean, uid: string) {
  useEffect(() => {
    const rtdb = getRtdb();
    if (!rtdb) return;
    const me = ref(rtdb, `presence/${uid}`);
    if (!enabled) {
      void remove(me).catch(() => undefined);
      return;
    }
    const unsub = onValue(ref(rtdb, '.info/connected'), (snap) => {
      if (snap.val() !== true) return;
      void onDisconnect(me).set({ online: false, lastChanged: serverTimestamp() }).then(() => set(me, { online: true, lastChanged: serverTimestamp() })).catch(() => undefined);
    });
    return () => unsub();
  }, [enabled, uid]);
}

export function usePresence(uid: string | null): Presence | null {
  const [p, setP] = useState<Presence | null>(null);
  useEffect(() => {
    const rtdb = getRtdb();
    if (!rtdb || !uid) {
      setP(null);
      return;
    }
    return onValue(ref(rtdb, `presence/${uid}`), (snap) => {
      const v: unknown = snap.val();
      if (typeof v === 'object' && v !== null) {
        const r = v as Record<string, unknown>;
        setP(typeof r.online === 'boolean' && typeof r.lastChanged === 'number' ? { online: r.online, lastChanged: r.lastChanged } : null);
      } else setP(null);
    });
  }, [uid]);
  return p;
}
