import { useEffect, useMemo } from 'react';
import { collection, limit, orderBy, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { sweepOwnSessions } from './location.service';
import { parseSession } from './mappers';

const swept = new Set<string>();

export function useLocationSessions(uid: string) {
  const now = useNow(15_000);
  // Pengganti pembersihan terjadwal server: sekali per pengguna per pemuatan aplikasi.
  useEffect(() => {
    if (swept.has(uid)) return;
    swept.add(uid);
    void sweepOwnSessions(uid).catch(() => undefined);
  }, [uid]);
  const others = useLiveQuery(
    `ls-o:${uid}`,
    () => query(collection(getFirebase().db, 'locationSessions'), where('viewerUids', 'array-contains', uid), where('status', '==', 'active')),
    parseSession,
  );
  const mine = useLiveQuery(
    `ls-m:${uid}`,
    () => query(collection(getFirebase().db, 'locationSessions'), where('ownerUid', '==', uid), orderBy('startedAt', 'desc'), limit(30)),
    parseSession,
  );
  // Sesi yang sudah lewat waktu tetapi belum dibersihkan dianggap berakhir.
  const lists = useMemo(() => {
    const live = (s: { status: string; expiresAtMs: number }) => s.status === 'active' && s.expiresAtMs > now;
    return {
      othersActive: others.data.filter(live),
      mineActive: mine.data.filter(live),
      mineEnded: mine.data.filter((s) => !live(s)),
    };
  }, [others.data, mine.data, now]);
  return { ...lists, loading: others.loading || mine.loading, error: others.error ?? mine.error };
}
