import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { getRtdb } from '@/lib/firebase/rtdb';
import type { LiveConn, LiveMeta, LivePos } from '@/types/location';
import { parseConn, parseMeta, parsePos } from './mappers';

interface LiveState {
  meta: LiveMeta | null;
  pos: LivePos | null;
  conn: LiveConn | null;
  /** true bila RTDB menolak membaca posisi (sesi berakhir/berhenti atau tidak berhak). */
  denied: boolean;
  loaded: boolean;
}

const EMPTY: LiveState = { meta: null, pos: null, conn: null, denied: false, loaded: false };

/** Langganan realtime ke meta/pos/conn sebuah sesi. Aturan RTDB yang memutuskan siapa boleh membaca. */
export function useSessionLive(sid: string | null): LiveState & { available: boolean } {
  const [s, setS] = useState<LiveState>(EMPTY);
  const available = getRtdb() !== null;

  useEffect(() => {
    const rt = getRtdb();
    setS(EMPTY);
    if (!sid || !rt) return;
    const unsubs = [
      onValue(ref(rt, `locations/${sid}/meta`), (snap) => setS((p) => ({ ...p, meta: parseMeta(snap.val()), loaded: true })), () => setS((p) => ({ ...p, denied: true, loaded: true }))),
      onValue(ref(rt, `locations/${sid}/pos`), (snap) => setS((p) => ({ ...p, pos: parsePos(snap.val()), denied: false })), () => setS((p) => ({ ...p, pos: null, denied: true }))),
      onValue(ref(rt, `locations/${sid}/conn`), (snap) => setS((p) => ({ ...p, conn: parseConn(snap.val()) })), () => setS((p) => ({ ...p, conn: null }))),
    ];
    return () => unsubs.forEach((u) => u());
  }, [sid]);

  return { ...s, available };
}
