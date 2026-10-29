import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { parseProfile } from '@/features/profile/profile.service';
import type { UserProfile } from '@/types/user';

/** Mengambil profil publik untuk daftar uid. null = tidak ditemukan/gagal dimuat; undefined = belum dimuat. */
export function useProfiles(uids: string[]): Record<string, UserProfile | null | undefined> {
  const [profiles, setProfiles] = useState<Record<string, UserProfile | null>>({});
  const key = [...new Set(uids)].sort().join(',');

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const { db } = getFirebase();
    void Promise.all(
      key.split(',').map(async (uid) => {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          return [uid, snap.exists() ? parseProfile(snap.data()) : null] as const;
        } catch {
          return [uid, null] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setProfiles((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return profiles;
}
