import {
  Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, updateDoc, where, writeBatch, serverTimestamp,
  type DocumentData, type Query,
} from 'firebase/firestore';
import { ref as rtRef, remove } from 'firebase/database';
import { deleteAuthUser, reauthenticate } from '@/features/auth/auth.service';
import { deleteAllOwnSessions } from '@/features/location/location.service';
import { getFirebase } from '@/lib/firebase/client';
import { getRtdb } from '@/lib/firebase/rtdb';

// Tanpa Cloud Functions (paket Spark): ekspor dan hapus akun dijalankan dari perangkat dengan izin pemilik.

const BATCH = 15; // tiap operasi yang diperiksa Rules lintas dokumen memicu pembacaan; tetap di bawah batas 20

function requireUid(): string {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error('Login diperlukan.');
  return uid;
}
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
function plain(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (Array.isArray(v)) return v.map(plain);
  if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, plain(x)]));
  return v;
}

/** Ekspor data pribadi (portabilitas). Tidak mencakup isi chat orang lain atau koordinat pihak lain. */
export async function exportMyData(): Promise<{ exportedAt: string; data: unknown }> {
  const uid = requireUid();
  const { db } = getFirebase();
  const one = async (path: string, id: string) => {
    const s = await getDoc(doc(db, path, id)).catch(() => null);
    return s?.exists() ? plain(s.data()) : null;
  };
  const list = async (q: Query<DocumentData>) => (await getDocs(q).catch(() => null))?.docs.map((d) => ({ id: d.id, ...(plain(d.data()) as Record<string, unknown>) })) ?? [];
  const col = (name: string) => collection(db, name);

  const sessions = await list(query(col('locationSessions'), where('ownerUid', '==', uid)));
  const locationHistory: unknown[] = [];
  for (const s of sessions) {
    if ((s as { historyEnabled?: boolean }).historyEnabled === true) locationHistory.push({ sessionId: s.id, points: await list(query(collection(db, 'locationSessions', s.id, 'points'))) });
  }
  const friendships = await list(query(col('friendships'), where('members', 'array-contains', uid)));
  const groups = await list(query(col('groups'), where('memberUids', 'array-contains', uid)));
  const chatStates = await getDocs(collection(db, 'users', uid, 'chatState')).catch(() => null);
  const cids = new Set<string>([
    ...groups.map((g) => g.id),
    ...friendships.map((f) => f.id), // id pertemanan = id percakapan pribadi
    ...(chatStates?.docs.map((d) => d.id) ?? []),
  ]);
  const messages: unknown[] = [];
  for (const cid of cids) {
    const m = await list(query(collection(db, 'conversations', cid, 'messages'), where('senderUid', '==', uid)));
    messages.push(...m.map((x) => ({ conversationId: cid, ...x })));
  }
  return {
    exportedAt: new Date().toISOString(),
    data: {
      profile: await one('users', uid),
      settings: await one('userSettings', uid),
      pet: await one('petProfiles', uid),
      streak: await one('streaks', uid),
      achievements: await one('achievements', uid),
      friendships,
      friendRequestsSent: await list(query(col('friendRequests'), where('fromUid', '==', uid))),
      friendRequestsReceived: await list(query(col('friendRequests'), where('toUid', '==', uid))),
      blocks: await list(query(col('blocks'), where('blockerUid', '==', uid))),
      groups,
      invitations: await list(query(col('invitations'), where('toUid', '==', uid))),
      media: await list(query(col('mediaMetadata'), where('ownerUid', '==', uid))),
      locationSessions: sessions,
      locationHistory,
      messages,
    },
  };
}

async function deleteQuery(q: Query<DocumentData>): Promise<void> {
  const snap = await getDocs(q);
  for (let i = 0; i < snap.docs.length; i += BATCH) {
    const batch = writeBatch(getFirebase().db);
    snap.docs.slice(i, i + BATCH).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** Menolak permintaan/undangan yang masih menunggu agar boleh dihapus penerimanya. */
async function declinePending(q: Query<DocumentData>): Promise<void> {
  const snap = await getDocs(q);
  for (const d of snap.docs) if (d.data().status === 'pending') await updateDoc(d.ref, { status: 'declined', updatedAt: serverTimestamp() });
}

/**
 * Menghapus akun dan data pribadi. Idempoten: bila gagal di tengah jalan, jalankan lagi.
 * Login ulang diminta lebih dulu (syarat Firebase) agar penghapusan akun Auth di akhir tidak gagal setelah data terhapus.
 * Batasan tanpa server: blokir yang dibuat orang lain terhadapmu dan isi `reads` grup yang dihapus tidak ikut terhapus.
 */
export async function deleteMyAccount(confirm: string): Promise<void> {
  if (confirm !== 'HAPUS') throw new Error('Ketik HAPUS untuk mengonfirmasi.');
  const uid = requireUid();
  await reauthenticate();
  const { db } = getFirebase();
  const col = (name: string) => collection(db, name);

  // 1) Sesi lokasi (termasuk riwayat dan data RTDB).
  await deleteAllOwnSessions(uid);

  // 2) Media milik pengguna: potongan di server + metadata.
  const media = await getDocs(query(col('mediaMetadata'), where('ownerUid', '==', uid)));
  for (const m of media.docs) {
    const d = m.data();
    const chunks = typeof d.chunks === 'number' ? d.chunks : 0;
    if (d.status === 'available' || d.status === 'uploading') await updateDoc(m.ref, { status: 'deleted', reason: 'owner', deletedAt: serverTimestamp() }).catch(() => undefined);
    for (let i = 0; i < chunks; i += BATCH) {
      const batch = writeBatch(db);
      for (let n = i; n < Math.min(chunks, i + BATCH); n += 1) batch.delete(doc(db, 'mediaBlobs', m.id, 'parts', String(n)));
      await batch.commit().catch(() => undefined);
    }
    await deleteDoc(m.ref);
  }

  // 3) Pesan yang pernah ditulis: kosongkan isi (sebelum keluar dari grup, karena butuh akses baca percakapan).
  const groups = await getDocs(query(col('groups'), where('memberUids', 'array-contains', uid)));
  const friendships = await getDocs(query(col('friendships'), where('members', 'array-contains', uid)));
  const chatStates = await getDocs(collection(db, 'users', uid, 'chatState'));
  const cids = new Set<string>([...groups.docs.map((g) => g.id), ...friendships.docs.map((f) => f.id), ...chatStates.docs.map((c) => c.id)]);
  for (const cid of cids) {
    const mine = await getDocs(query(collection(db, 'conversations', cid, 'messages'), where('senderUid', '==', uid))).catch(() => null);
    if (!mine) continue;
    for (let i = 0; i < mine.docs.length; i += BATCH) {
      const batch = writeBatch(db);
      mine.docs.slice(i, i + BATCH).forEach((d) => batch.update(d.ref, { deleted: true, text: '' }));
      await batch.commit().catch(() => undefined);
    }
  }

  // 4) Grup: milik sendiri dihapus beserta chat-nya; lainnya keluar.
  for (const g of groups.docs) {
    if (g.data().ownerUid === uid) {
      await deleteQuery(query(col('invitations'), where('fromUid', '==', uid), where('groupId', '==', g.id)));
      const msgs = await getDocs(collection(db, 'conversations', g.id, 'messages')).catch(() => null);
      if (msgs) {
        for (let i = 0; i < msgs.docs.length; i += BATCH) {
          const batch = writeBatch(db);
          msgs.docs.slice(i, i + BATCH).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
      await deleteDoc(doc(db, 'conversations', g.id)).catch(() => undefined);
      await deleteDoc(doc(db, 'groupStreaks', g.id)).catch(() => undefined);
      await deleteDoc(g.ref);
    } else {
      await updateDoc(g.ref, { memberUids: strs(g.data().memberUids).filter((m) => m !== uid), updatedAt: serverTimestamp() });
    }
  }

  // 5) Undangan, pertemanan, permintaan, blokir.
  const toMe = query(col('invitations'), where('toUid', '==', uid));
  await declinePending(toMe);
  await deleteQuery(toMe);
  await deleteQuery(query(col('invitations'), where('fromUid', '==', uid)));
  await deleteQuery(query(col('friendships'), where('members', 'array-contains', uid)));
  await deleteQuery(query(col('friendRequests'), where('fromUid', '==', uid)));
  const reqToMe = query(col('friendRequests'), where('toUid', '==', uid));
  await declinePending(reqToMe);
  await deleteQuery(reqToMe);
  await deleteQuery(query(col('blocks'), where('blockerUid', '==', uid)));

  // 6) Dokumen milik sendiri + username (dibebaskan agar bisa dipakai orang lain).
  const profile = await getDoc(doc(db, 'users', uid));
  const username = profile.data()?.username;
  if (typeof username === 'string') await deleteDoc(doc(db, 'usernames', username)).catch(() => undefined);
  await deleteQuery(collection(db, 'users', uid, 'chatState'));
  for (const c of ['userSettings', 'petProfiles', 'streaks', 'achievements']) await deleteDoc(doc(db, c, uid)).catch(() => undefined);
  await deleteDoc(doc(db, 'users', uid));
  const rt = getRtdb();
  if (rt) await remove(rtRef(rt, `presence/${uid}`)).catch(() => undefined);

  // 7) Terakhir: akun autentikasi.
  await deleteAuthUser();
}
