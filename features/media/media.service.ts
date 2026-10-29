import { FirebaseError } from 'firebase/app';
import {
  Bytes, Timestamp, arrayUnion, collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction,
  serverTimestamp, setDoc, startAfter, updateDoc, where, writeBatch, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import type { LocalMedia } from '@/lib/local/db';
import { MEDIA_CHUNK_BYTES, MEDIA_LIMITS, chunkCountFor } from '@/shared/mediaLogic';
import type { MediaStatus } from '@/types/media';

// Tanpa Cloud Storage/Functions (paket Spark): isi berkas dititipkan sementara sebagai potongan di Firestore
// (mediaBlobs/{id}/parts/{n}); validasi tahap akhir dilakukan Firestore Rules dan perangkat penerima.

const UPLOAD_PARALLEL = 3;
const DELETE_BATCH = 15; // tiap hapus potongan memicu 1 pembacaan Rules; tetap di bawah batas 20 per batch
const READ_PAGE = 6;
const STALLED_MS = 2 * 3_600_000;

export async function getMetadataState(id: string): Promise<{ status: MediaStatus; reason: string | null } | null> {
  const snap = await getDoc(doc(getFirebase().db, 'mediaMetadata', id));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { status: d.status as MediaStatus, reason: typeof d.reason === 'string' ? d.reason : null };
}

/** Membuat metadata "uploading" lengkap dengan penerima yang dipilih pengirim (divalidasi Rules). */
export async function createMetadata(local: LocalMedia, recipients: string[]): Promise<void> {
  await setDoc(doc(getFirebase().db, 'mediaMetadata', local.id), {
    ownerUid: local.ownerUid,
    context: local.context,
    conversationId: local.context === 'chat' ? local.cid : null,
    kind: local.kind,
    mime: local.mime,
    size: local.size,
    chunks: chunkCountFor(local.size),
    width: Math.round(local.width),
    height: Math.round(local.height),
    durationSec: local.durationSec,
    caption: local.caption,
    recipients,
    receivedBy: [],
    status: 'uploading',
    createdAt: serverTimestamp(),
  });
}

/** Penerima chat/story. Pengirim yang diblokir pengguna lain tetap ditolak oleh Rules saat unduhan. */
export async function resolveRecipients(me: string, context: 'chat' | 'story', cid: string | null): Promise<string[]> {
  const { db } = getFirebase();
  let uids: string[] = [];
  if (context === 'story') {
    const fs = await getDocs(query(collection(db, 'friendships'), where('members', 'array-contains', me)));
    uids = fs.docs.flatMap((f) => (Array.isArray(f.data().members) ? (f.data().members as unknown[]) : [])).filter((x): x is string => typeof x === 'string');
  } else if (cid && /^[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(cid)) {
    uids = cid.split('_');
  } else if (cid) {
    const g = await getDoc(doc(db, 'groups', cid));
    const members = g.data()?.memberUids;
    uids = Array.isArray(members) ? members.filter((x): x is string => typeof x === 'string') : [];
  }
  const blocked = await getDocs(query(collection(db, 'blocks'), where('blockerUid', '==', me)));
  const blockedUids = new Set(blocked.docs.map((b) => String(b.data().blockedUid)));
  return [...new Set(uids)].filter((u) => u !== me && !blockedUids.has(u));
}

async function mapPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Mengunggah potongan lalu menandai media "available" (story: tampil di feed teman selama 24 jam). */
export async function uploadMedia(id: string, blob: Blob, context: 'chat' | 'story', onProgress: (fraction: number) => void): Promise<void> {
  const { db } = getFirebase();
  const total = chunkCountFor(blob.size);
  const ttlMs = context === 'story' ? MEDIA_LIMITS.storyTtlHours * 3_600_000 : MEDIA_LIMITS.chatTtlDays * 86_400_000;
  const expireAt = Timestamp.fromMillis(Date.now() + ttlMs);
  let done = 0;
  await mapPool(Array.from({ length: total }, (_, n) => n), UPLOAD_PARALLEL, async (n) => {
    const bytes = new Uint8Array(await blob.slice(n * MEDIA_CHUNK_BYTES, (n + 1) * MEDIA_CHUNK_BYTES).arrayBuffer());
    await setDoc(doc(db, 'mediaBlobs', id, 'parts', String(n)), { n, data: Bytes.fromUint8Array(bytes), expireAt });
    done += 1;
    onProgress(done / total);
  });
  await updateDoc(doc(db, 'mediaMetadata', id), {
    status: 'available',
    expiresAt: Timestamp.fromMillis(Date.now() + ttlMs),
    storyExpiresAt: context === 'story' ? Timestamp.fromMillis(Date.now() + ttlMs) : null,
  });
}

/** Menghapus potongan (tidak perlu membaca dulu; menghapus dokumen yang tidak ada tidak apa-apa). */
async function deleteChunks(id: string, chunks: number): Promise<void> {
  const { db } = getFirebase();
  for (let i = 0; i < chunks; i += DELETE_BATCH) {
    const batch = writeBatch(db);
    for (let n = i; n < Math.min(chunks, i + DELETE_BATCH); n += 1) batch.delete(doc(db, 'mediaBlobs', id, 'parts', String(n)));
    await batch.commit();
  }
}

type RetireReason = 'owner' | 'expired' | 'upload_stalled' | 'delivered';

/** Menandai media selesai di server (hanya bila masih aktif) lalu menghapus potongannya. Status + alasan = jejak audit. */
async function retireMedia(id: string, chunks: number, status: 'deleted' | 'expired', reason: RetireReason): Promise<void> {
  const ref = doc(getFirebase().db, 'mediaMetadata', id);
  await updateDoc(ref, { status, reason, deletedAt: serverTimestamp() });
  await deleteChunks(id, chunks);
}

function chunksOf(d: Record<string, unknown>): number {
  return typeof d.chunks === 'number' ? d.chunks : typeof d.size === 'number' ? chunkCountFor(d.size) : 1;
}

/**
 * Penerima menyatakan media sudah tersimpan di perangkatnya. Idempoten.
 * Potongan di server dihapus hanya setelah SEMUA penerima yang berhak mengonfirmasi.
 */
export async function acknowledgeMedia(mediaId: string): Promise<{ status: string }> {
  const { db, auth } = getFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Login diperlukan.');
  const ref = doc(db, 'mediaMetadata', mediaId);
  const out = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Media tidak ditemukan.');
    const d = snap.data();
    const recipients: string[] = Array.isArray(d.recipients) ? d.recipients : [];
    const received: string[] = Array.isArray(d.receivedBy) ? d.receivedBy : [];
    if (!recipients.includes(uid)) throw new Error('Kamu bukan penerima media ini.');
    if (d.status === 'deleted' || d.status === 'expired') return { status: String(d.status), allAcked: false, chunks: 0 };
    if (d.status !== 'available') throw new Error('Media belum siap.');
    if (!received.includes(uid)) tx.update(ref, { receivedBy: arrayUnion(uid) });
    const all = new Set([...received, uid]);
    return { status: 'available', allAcked: recipients.every((r) => all.has(r)), chunks: chunksOf(d) };
  });
  if (out.allAcked) {
    try {
      await retireMedia(mediaId, out.chunks, 'deleted', 'delivered');
      return { status: 'deleted' };
    } catch {
      /* penerima lain sudah melakukannya, atau dicoba lagi saat dibuka berikutnya */
    }
  }
  return { status: out.status };
}

/** Pengirim menghapus media dari server (salinan lokal penerima tidak terpengaruh). Idempoten. */
export async function deleteRemoteMedia(mediaId: string): Promise<{ ok: true }> {
  const ref = doc(getFirebase().db, 'mediaMetadata', mediaId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Media tidak ditemukan.');
  const d = snap.data();
  const chunks = chunksOf(d);
  if (d.status === 'available' || d.status === 'uploading') await retireMedia(mediaId, chunks, 'deleted', 'owner');
  else await deleteChunks(mediaId, chunks); // sisa potongan dari percobaan sebelumnya
  return { ok: true };
}

/**
 * Pembersihan oleh pengirim saat aplikasi dibuka (pengganti pembersihan terjadwal): media yang kedaluwarsa
 * dan unggahan yang macet. Aman dijalankan berulang.
 */
export async function sweepOwnMedia(uid: string): Promise<void> {
  const { db } = getFirebase();
  const col = collection(db, 'mediaMetadata');
  const expired = await getDocs(query(col, where('ownerUid', '==', uid), where('status', '==', 'available'), where('expiresAt', '<=', Timestamp.now()), limit(50)));
  for (const d of expired.docs) await retireMedia(d.id, chunksOf(d.data()), 'expired', 'expired').catch(() => undefined);
  const uploading = await getDocs(query(col, where('ownerUid', '==', uid), where('status', '==', 'uploading'), limit(50)));
  for (const d of uploading.docs) {
    const created = d.data().createdAt;
    if (created instanceof Timestamp && Date.now() - created.toMillis() > STALLED_MS) {
      await retireMedia(d.id, chunksOf(d.data()), 'expired', 'upload_stalled').catch(() => undefined);
    }
  }
}

/** Unduh potongan lewat akses terautentikasi (dicek Firestore Rules); tidak ada URL publik/berbagi. */
export async function downloadMediaBlob(id: string, maxBytes: number): Promise<Blob> {
  const { db } = getFirebase();
  const parts: Uint8Array[] = [];
  let total = 0;
  let last: QueryDocumentSnapshot | null = null;
  const col = collection(db, 'mediaBlobs', id, 'parts');
  for (;;) {
    const q = last ? query(col, orderBy('n'), startAfter(last), limit(READ_PAGE)) : query(col, orderBy('n'), limit(READ_PAGE));
    const page = await getDocs(q);
    for (const d of page.docs) {
      const bytes = (d.data().data as Bytes).toUint8Array();
      total += bytes.length;
      if (total > maxBytes) throw new Error('Ukuran unduhan melebihi batas.');
      parts.push(bytes);
    }
    if (page.docs.length < READ_PAGE) break;
    last = page.docs[page.docs.length - 1] ?? null;
  }
  if (parts.length === 0) throw new FirebaseError('not-found', 'Potongan media tidak ditemukan.');
  return new Blob(parts as BlobPart[]);
}

export function describeMediaError(e: unknown): { message: string; gone: boolean } {
  if (e instanceof FirebaseError) {
    if (e.code === 'not-found') return { message: 'Media sudah dihapus dari server.', gone: true };
    if (e.code === 'permission-denied') return { message: 'Kamu tidak berhak mengunduh media ini, atau media sudah dihapus dari server.', gone: true };
    if (e.code === 'unavailable' || e.code === 'deadline-exceeded') return { message: 'Koneksi terputus. Coba lagi.', gone: false };
    if (e.code === 'resource-exhausted') return { message: 'Kuota harian Firestore proyek habis. Coba lagi besok.', gone: false };
  }
  return { message: e instanceof Error ? e.message : 'Terjadi kesalahan.', gone: false };
}
