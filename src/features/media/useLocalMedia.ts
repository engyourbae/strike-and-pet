import { useEffect, useState } from 'react';
import type { LocalMedia } from '@/lib/local/db';
import { watchLocalList, watchLocalMedia, type LocalFilter } from './mediaStore';

/** undefined = memuat, null = tidak ada salinan lokal. */
export function useLocalMedia(accountUid: string, id: string | null): LocalMedia | null | undefined {
  const [rec, setRec] = useState<LocalMedia | null | undefined>(undefined);
  useEffect(() => {
    if (!id) { setRec(null); return; }
    setRec(undefined);
    return watchLocalMedia(accountUid, id, setRec);
  }, [accountUid, id]);
  return rec;
}

export function useLocalList(accountUid: string, filter: LocalFilter): LocalMedia[] | undefined {
  const [list, setList] = useState<LocalMedia[] | undefined>(undefined);
  useEffect(() => watchLocalList(accountUid, filter, setList), [accountUid, filter]);
  return list;
}

export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
