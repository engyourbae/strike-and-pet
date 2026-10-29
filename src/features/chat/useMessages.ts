import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query, startAfter, type QueryDocumentSnapshot } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import type { Message } from '@/types/chat';
import { PAGE_SIZE } from './logic';
import { toMessage } from './mappers';

/** Jendela realtime untuk pesan terbaru + pagination ke pesan lama (tidak memuat seluruh riwayat). */
export function useMessages(cid: string) {
  const [map, setMap] = useState<Record<string, Message>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const first = useRef(true);

  useEffect(() => {
    setMap({});
    setLoading(true);
    setError(null);
    first.current = true;
    cursor.current = null;
    const q = query(collection(getFirebase().db, 'conversations', cid, 'messages'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        setMap((prev) => {
          const next = { ...prev };
          for (const d of snap.docs) {
            const m = toMessage(d);
            if (m) next[m.id] = m;
          }
          return next;
        });
        if (first.current && !snap.metadata.fromCache) {
          first.current = false;
          cursor.current = snap.docs[snap.docs.length - 1] ?? null;
          setHasMore(snap.docs.length === PAGE_SIZE);
        } else if (first.current && snap.docs.length > 0 && cursor.current === null) {
          cursor.current = snap.docs[snap.docs.length - 1] ?? null;
          setHasMore(snap.docs.length === PAGE_SIZE);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [cid]);

  const loadOlder = useCallback(async () => {
    if (!cursor.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(getFirebase().db, 'conversations', cid, 'messages'),
        orderBy('createdAt', 'desc'),
        startAfter(cursor.current),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      setMap((prev) => {
        const next = { ...prev };
        for (const d of snap.docs) {
          const m = toMessage(d);
          if (m) next[m.id] = m;
        }
        return next;
      });
      cursor.current = snap.docs[snap.docs.length - 1] ?? cursor.current;
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pesan lama.');
    } finally {
      setLoadingMore(false);
    }
  }, [cid, loadingMore]);

  const messages = useMemo(() => Object.values(map).sort((a, b) => a.createdAtMs - b.createdAtMs), [map]);
  return { messages, loading, error, hasMore, loadingMore, loadOlder };
}
