import { FirebaseError } from 'firebase/app';
import { get, ref as rtRef, remove, set } from 'firebase/database';
import {
  Timestamp, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { getRtdb } from '@/lib/firebase/rtdb';
import { HISTORY_RETENTION_DAYS, MAX_VIEWERS, SESSION_RETENTION_HOURS, isAllowedDuration } from '@/shared/locationLogic';
import { parseSession } from './mappers';

// Tanpa Cloud Functions (paket Spark): pemilik membuat/mengakhiri sesinya sendiri. Firestore Rules memastikan
// pemilik dan penerima adalah anggota grup, durasi diizinkan, dan masa berlaku dibatasi; RTDB Rules membatasi
// pembacaan koordinat ke penerima yang dipilih pemilik. Pembersihan terjadwal diganti `sweepOwnSessions`.

const DELETE_BATCH = 15; // tiap hapus titik riwayat memicu 1 pembacaan Rules; tetap di bawah batas 20 per batch

export interface StartOptions {
  groupId: string;
  viewerUids: string[];
  durationMin: number;
  historyEnabled: boolean;
}

function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function requireUid(): string {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error('Login diperlukan.');
  return uid;
}

/**
 * Mengakhiri sesi secara idempoten: hapus posisi terakhir di RTDB (tidak ada "lokasi terakhir" tersisa),
 * tandai berhenti/kedaluwarsa, dan catat waktu berakhir untuk retensi.
 */
async function finishSession(sid: string, status: 'stopped' | 'expired'): Promise<void> {
  const rt = getRtdb();
  if (rt) {
    try {
      if (status === 'stopped') {
        // Hapus posisi dulu (Rules hanya mengizinkan selama sesi aktif), baru tandai berhenti.
        await Promise.all([remove(rtRef(rt, `locations/${sid}/pos`)), remove(rtRef(rt, `locations/${sid}/conn`))]).catch(() => undefined);
        if ((await get(rtRef(rt, `locations/${sid}/meta/ownerUid`))).exists()) await set(rtRef(rt, `locations/${sid}/meta/active`), false);
      } else {
        await remove(rtRef(rt, `locations/${sid}`));
      }
    } catch {
      /* sesi tetap diakhiri di Firestore; Rules RTDB menutup akses setelah kedaluwarsa */
    }
  }
  const { db } = getFirebase();
  const ref = doc(db, 'locationSessions', sid);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().status === 'active') await updateDoc(ref, { status, endedAt: serverTimestamp() });
}

/** Memulai sesi berbagi lokasi (hanya atas permintaan pemilik). Satu sesi aktif per pengguna. */
export async function startLocationSession(o: StartOptions): Promise<{ sessionId: string; expiresAtMs: number; viewerUids: string[] }> {
  const uid = requireUid();
  const { db } = getFirebase();
  const rt = getRtdb();
  if (!rt) throw new Error('Berbagi lokasi membutuhkan Realtime Database (VITE_FIREBASE_DATABASE_URL).');
  if (!o.groupId) throw new Error('Grup tidak valid.');
  if (!isAllowedDuration(o.durationMin)) throw new Error('Durasi tidak diizinkan.');

  const groupSnap = await getDoc(doc(db, 'groups', o.groupId));
  const members = strs(groupSnap.data()?.memberUids);
  if (!groupSnap.exists() || !members.includes(uid)) throw new Error('Kamu bukan anggota grup ini.');
  const viewers = [...new Set(o.viewerUids)].filter((u) => u !== uid);
  if (viewers.length < 1 || viewers.length > MAX_VIEWERS) throw new Error(`Pilih 1–${MAX_VIEWERS} penerima.`);
  if (!viewers.every((v) => members.includes(v))) throw new Error('Penerima harus anggota grup.');
  const blocked = await getDocs(query(collection(db, 'blocks'), where('blockerUid', '==', uid)));
  const blockedUids = new Set(blocked.docs.map((b) => String(b.data().blockedUid)));
  if (viewers.some((v) => blockedUids.has(v))) throw new Error('Tidak bisa berbagi dengan pengguna yang diblokir.');

  const old = await getDocs(query(collection(db, 'locationSessions'), where('ownerUid', '==', uid), where('status', '==', 'active')));
  for (const s of old.docs) await finishSession(s.id, 'stopped');

  const ref = doc(collection(db, 'locationSessions'));
  const expiresAtMs = Date.now() + o.durationMin * 60_000;
  await setDoc(ref, {
    ownerUid: uid,
    groupId: o.groupId,
    groupName: String(groupSnap.data()?.name ?? ''),
    viewerUids: viewers,
    status: 'active',
    historyEnabled: o.historyEnabled,
    durationMin: o.durationMin,
    startedAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    endedAt: null,
  });
  try {
    await set(rtRef(rt, `locations/${ref.id}/meta`), {
      ownerUid: uid,
      viewers: Object.fromEntries(viewers.map((v) => [v, true])),
      expiresAt: expiresAtMs,
      active: true,
    });
  } catch (e) {
    await updateDoc(ref, { status: 'stopped', endedAt: serverTimestamp() }).catch(() => undefined);
    throw e;
  }
  return { sessionId: ref.id, expiresAtMs, viewerUids: viewers };
}

/** Pemilik menghentikan sesi kapan saja. Idempoten. */
export async function stopLocationSession(sessionId: string): Promise<{ ok: true }> {
  const uid = requireUid();
  const snap = await getDoc(doc(getFirebase().db, 'locationSessions', sessionId));
  if (!snap.exists()) throw new Error('Sesi tidak ditemukan.');
  if (snap.data().ownerUid !== uid) throw new Error('Hanya pemilik sesi yang bisa menghentikan.');
  await finishSession(sessionId, 'stopped');
  return { ok: true };
}

/** Hapus riwayat rute + sesi (hanya sesi yang sudah berakhir; Rules menolak sesi aktif). */
export async function deleteSessionHistory(sessionId: string): Promise<void> {
  const { db } = getFirebase();
  const points = await getDocs(collection(db, 'locationSessions', sessionId, 'points'));
  for (let i = 0; i < points.docs.length; i += DELETE_BATCH) {
    const batch = writeBatch(db);
    points.docs.slice(i, i + DELETE_BATCH).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  const last = writeBatch(db);
  last.delete(doc(db, 'locationSessions', sessionId));
  await last.commit();
  const rt = getRtdb();
  if (rt) await remove(rtRef(rt, `locations/${sessionId}`)).catch(() => undefined);
}

/**
 * Pengganti pembersihan terjadwal: dijalankan pemilik saat aplikasi dibuka. Mengakhiri sesi yang kedaluwarsa,
 * lalu menerapkan retensi (tanpa riwayat 24 jam, dengan riwayat 7 hari setelah berakhir).
 */
export async function sweepOwnSessions(uid: string): Promise<void> {
  const { db } = getFirebase();
  const snap = await getDocs(query(collection(db, 'locationSessions'), where('ownerUid', '==', uid), orderBy('startedAt', 'desc'), limit(30)));
  const now = Date.now();
  for (const d of snap.docs) {
    const s = parseSession(d.id, d.data());
    if (!s) continue;
    if (s.status === 'active') {
      if (s.expiresAtMs <= now) await finishSession(s.id, 'expired').catch(() => undefined);
      continue;
    }
    if (s.endedAtMs === null) continue;
    const keepMs = s.historyEnabled ? HISTORY_RETENTION_DAYS * 86_400_000 : SESSION_RETENTION_HOURS * 3_600_000;
    if (now - s.endedAtMs > keepMs) await deleteSessionHistory(s.id).catch(() => undefined);
  }
}

/** Dipakai hapus akun: akhiri dan hapus semua sesi milik pengguna (termasuk riwayat dan data RTDB). */
export async function deleteAllOwnSessions(uid: string): Promise<void> {
  const { db } = getFirebase();
  const snap = await getDocs(query(collection(db, 'locationSessions'), where('ownerUid', '==', uid)));
  for (const d of snap.docs) {
    if (d.data().status === 'active') await finishSession(d.id, 'stopped');
    await deleteSessionHistory(d.id);
  }
}

export function describeLocationError(e: unknown): string {
  if (e instanceof FirebaseError) {
    if (e.code === 'permission-denied') return 'Ditolak oleh aturan keamanan.';
    if (e.code === 'resource-exhausted') return 'Kuota harian Firebase (paket gratis) habis. Coba lagi besok.';
    if (e.code === 'unavailable') return 'Tidak ada koneksi atau layanan sedang tidak tersedia. Coba lagi.';
  }
  return e instanceof Error ? e.message : 'Terjadi kesalahan.';
}
