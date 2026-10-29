import { useEffect, useRef, useState } from 'react';
import { onSnapshot, type DocumentData, type Query } from 'firebase/firestore';

interface LiveResult<T> {
  data: T[];
  loading: boolean;
  error: string | null;
}

/** Langganan realtime ke query Firestore. `key` null = nonaktif; ganti key untuk berlangganan ulang. */
export function useLiveQuery<T>(
  key: string | null,
  build: () => Query<DocumentData>,
  map: (id: string, data: DocumentData) => T | null,
): LiveResult<T> {
  const buildRef = useRef(build);
  const mapRef = useRef(map);
  buildRef.current = build;
  mapRef.current = map;
  const [state, setState] = useState<LiveResult<T>>({ data: [], loading: key !== null, error: null });

  useEffect(() => {
    if (key === null) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      buildRef.current(),
      (snap) => {
        const data: T[] = [];
        snap.forEach((d) => {
          const item = mapRef.current(d.id, d.data());
          if (item) data.push(item);
        });
        setState({ data, loading: false, error: null });
      },
      (err) => setState({ data: [], loading: false, error: err.message }),
    );
  }, [key]);

  return state;
}
