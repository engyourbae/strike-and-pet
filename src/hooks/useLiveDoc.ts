import { useEffect, useRef, useState } from 'react';
import { onSnapshot, type DocumentData, type DocumentReference } from 'firebase/firestore';

interface LiveDoc<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** Langganan realtime ke satu dokumen. data null = dokumen belum ada atau tidak valid. */
export function useLiveDoc<T>(
  key: string | null,
  build: () => DocumentReference<DocumentData>,
  map: (data: DocumentData) => T | null,
): LiveDoc<T> {
  const buildRef = useRef(build);
  const mapRef = useRef(map);
  buildRef.current = build;
  mapRef.current = map;
  const [state, setState] = useState<LiveDoc<T>>({ data: null, loading: key !== null, error: null });

  useEffect(() => {
    if (key === null) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    return onSnapshot(
      buildRef.current(),
      (snap) => setState({ data: snap.exists() ? mapRef.current(snap.data()) : null, loading: false, error: null }),
      (err) => setState({ data: null, loading: false, error: err.message }),
    );
  }, [key]);

  return state;
}
