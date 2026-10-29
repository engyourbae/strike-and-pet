import { Timestamp, collection, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import type { MediaMeta } from '@/types/media';
import { parseMediaMeta } from './mappers';

const byTime = (a: MediaMeta, b: MediaMeta) => a.createdAtMs - b.createdAtMs;
// Story yang dihapus pemiliknya disembunyikan; story lain tetap terlihat sampai 24 jam berlalu.
const visible = (m: MediaMeta) => m.context === 'story' && !(m.status === 'deleted' && m.reason === 'owner');

export function useStories(uid: string) {
  const bucket = Math.floor(useNow(60_000) / 60_000);
  const others = useLiveQuery(
    `st-o:${uid}:${bucket}`,
    () => query(collection(getFirebase().db, 'mediaMetadata'), where('recipients', 'array-contains', uid), where('storyExpiresAt', '>', Timestamp.now())),
    parseMediaMeta,
  );
  const mine = useLiveQuery(
    `st-m:${uid}:${bucket}`,
    () => query(collection(getFirebase().db, 'mediaMetadata'), where('ownerUid', '==', uid), where('storyExpiresAt', '>', Timestamp.now())),
    parseMediaMeta,
  );
  return {
    others: others.data.filter(visible).sort(byTime),
    mine: mine.data.filter(visible).sort(byTime),
    loading: others.loading || mine.loading,
    error: others.error ?? mine.error,
  };
}
