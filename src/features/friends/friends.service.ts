import { FirebaseError } from 'firebase/app';
import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { parseProfile } from '@/features/profile/profile.service';
import { validateUsername } from '@/features/profile/username';
import { pairId, requestId } from '@/features/social/logic';
import type { FriendRequest, ReportReason } from '@/types/social';
import type { UserProfile } from '@/types/user';

export async function findUserByUsername(raw: string): Promise<UserProfile | null> {
  const check = validateUsername(raw);
  if (!check.ok) throw new Error(check.error);
  const { db } = getFirebase();
  const nameSnap = await getDoc(doc(db, 'usernames', check.value));
  if (!nameSnap.exists()) return null;
  const uid: unknown = nameSnap.data().uid;
  if (typeof uid !== 'string') return null;
  const userSnap = await getDoc(doc(db, 'users', uid));
  return userSnap.exists() ? parseProfile(userSnap.data()) : null;
}

export async function sendFriendRequest(me: UserProfile, target: UserProfile): Promise<void> {
  const { db } = getFirebase();
  const reverse = await getDoc(doc(db, 'friendRequests', requestId(target.uid, me.uid)));
  if (reverse.exists() && reverse.data().status === 'pending') {
    throw new Error('@' + target.username + ' sudah mengirim permintaan ke kamu. Buka Permintaan masuk.');
  }
  const ref = doc(db, 'friendRequests', requestId(me.uid, target.uid));
  const existing = await getDoc(ref);
  if (existing.exists()) {
    if (existing.data().status === 'pending') throw new Error('Permintaan sudah terkirim.');
    await deleteDoc(ref); // permintaan lama (ditolak/diterima) dibersihkan sebelum kirim ulang
  }
  await setDoc(ref, {
    fromUid: me.uid,
    toUid: target.uid,
    fromUsername: me.username,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function cancelRequest(id: string): Promise<void> {
  await deleteDoc(doc(getFirebase().db, 'friendRequests', id));
}

export async function respondToRequest(req: FriendRequest, accept: boolean): Promise<void> {
  const { db } = getFirebase();
  const reqRef = doc(db, 'friendRequests', req.id);
  if (!accept) {
    await updateDoc(reqRef, { status: 'declined', updatedAt: serverTimestamp() });
    return;
  }
  const batch = writeBatch(db);
  batch.update(reqRef, { status: 'accepted', updatedAt: serverTimestamp() });
  batch.set(doc(db, 'friendships', pairId(req.fromUid, req.toUid)), {
    members: [req.fromUid, req.toUid].sort(),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function removeFriend(myUid: string, otherUid: string): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'friendships', pairId(myUid, otherUid)));
  batch.delete(doc(db, 'friendRequests', requestId(myUid, otherUid)));
  batch.delete(doc(db, 'friendRequests', requestId(otherUid, myUid)));
  await batch.commit();
}

export async function blockUser(me: UserProfile, target: { uid: string; username: string }): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(doc(db, 'blocks', `${me.uid}_${target.uid}`), {
    blockerUid: me.uid,
    blockedUid: target.uid,
    blockedUsername: target.username,
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'friendships', pairId(me.uid, target.uid)));
  batch.delete(doc(db, 'friendRequests', requestId(me.uid, target.uid)));
  const incoming = await getDoc(doc(db, 'friendRequests', requestId(target.uid, me.uid)));
  if (incoming.exists()) {
    if (incoming.data().status === 'pending') batch.update(incoming.ref, { status: 'declined', updatedAt: serverTimestamp() });
    else batch.delete(incoming.ref);
  }
  await batch.commit();
}

export async function unblockUser(myUid: string, blockedUid: string): Promise<void> {
  await deleteDoc(doc(getFirebase().db, 'blocks', `${myUid}_${blockedUid}`));
}

export async function reportUser(myUid: string, reportedUid: string, reason: ReportReason): Promise<void> {
  await addDoc(collection(getFirebase().db, 'reports'), {
    reporterUid: myUid,
    reportedUid,
    reason,
    createdAt: serverTimestamp(),
  });
}

export function describeSocialError(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return 'Tindakan ditolak. Data mungkin sudah berubah atau kamu tidak punya izin.';
    if (e.code === 'unavailable') return 'Tidak ada koneksi atau layanan sedang tidak tersedia. Coba lagi.';
    if (e.code === 'resource-exhausted') return 'Kuota harian Firebase (paket gratis/Spark) habis. Coba lagi besok.';
  }
  return e instanceof Error ? e.message : 'Terjadi kesalahan. Coba lagi.';
}
