import type { User } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { doc, runTransaction, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import type { UserProfile } from '@/types/user';
import { validateUsername } from './username';

export class UsernameTakenError extends Error {
  constructor() {
    super('Username sudah dipakai.');
    this.name = 'UsernameTakenError';
  }
}

export function parseProfile(data: DocumentData): UserProfile | null {
  if (typeof data.username !== 'string' || typeof data.uid !== 'string') return null;
  return {
    uid: data.uid,
    username: data.username,
    displayName: typeof data.displayName === 'string' ? data.displayName : data.username,
    photoURL: typeof data.photoURL === 'string' ? data.photoURL : null,
    bio: typeof data.bio === 'string' ? data.bio : '',
  };
}

/**
 * Klaim username secara atomik: usernames/{name} dan users/{uid} dibuat dalam satu transaksi.
 * Security Rules memeriksa keduanya lewat getAfter(), sehingga klien tidak bisa melewatinya.
 */
export async function claimUsername(user: User, raw: string): Promise<string> {
  const check = validateUsername(raw);
  if (!check.ok) throw new Error(check.error);
  const name = check.value;
  const { db } = getFirebase();
  const nameRef = doc(db, 'usernames', name);
  const userRef = doc(db, 'users', user.uid);

  await runTransaction(db, async (tx) => {
    const [nameSnap, userSnap] = await Promise.all([tx.get(nameRef), tx.get(userRef)]);
    if (nameSnap.exists()) throw new UsernameTakenError();
    if (userSnap.exists()) throw new Error('Akun ini sudah memiliki username.');
    tx.set(nameRef, { uid: user.uid, createdAt: serverTimestamp() });
    tx.set(userRef, {
      uid: user.uid,
      username: name,
      displayName: (user.displayName ?? name).slice(0, 50) || name,
      photoURL: user.photoURL,
      bio: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return name;
}

export async function updateProfileText(uid: string, displayName: string, bio: string): Promise<void> {
  const name = displayName.trim();
  if (name.length < 1 || name.length > 50) throw new Error('Nama tampilan harus 1–50 karakter.');
  if (bio.length > 160) throw new Error('Bio maksimal 160 karakter.');
  const { db } = getFirebase();
  await updateDoc(doc(db, 'users', uid), { displayName: name, bio, updatedAt: serverTimestamp() });
}

export function describeProfileError(e: unknown): string {
  if (e instanceof UsernameTakenError) return 'Username sudah dipakai. Coba yang lain.';
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return 'Ditolak oleh aturan keamanan. Periksa input atau coba lagi.';
    if (e.code === 'unavailable') return 'Tidak ada koneksi. Coba lagi saat online.';
  }
  return e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.';
}
