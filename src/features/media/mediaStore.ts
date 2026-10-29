import { liveQuery } from 'dexie';
import { localDb, type LocalMedia, type OutboxItem } from '@/lib/local/db';

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'verify' | 'error'; message: string };

function nameOf(x: unknown): string {
  return typeof x === 'object' && x !== null && 'name' in x ? String((x as { name: unknown }).name) : '';
}

/** Dexie membungkus error IndexedDB; QuotaExceededError bisa ada di error itu sendiri atau di `inner`. */
export function isQuotaError(e: unknown): boolean {
  const inner = typeof e === 'object' && e !== null && 'inner' in e ? (e as { inner: unknown }).inner : null;
  return nameOf(e) === 'QuotaExceededError' || nameOf(inner) === 'QuotaExceededError';
}

/**
 * Menyimpan media ke IndexedDB LALU membaca ulang untuk memastikan data benar-benar tertulis.
 * Hanya hasil `ok: true` yang boleh dipakai sebagai dasar acknowledgment ke server.
 */
export async function saveLocalMedia(rec: LocalMedia): Promise<SaveResult> {
  try {
    await localDb.media.put(rec);
    const back = await localDb.media.get(rec.id);
    if (!back || back.blob.size !== rec.blob.size) {
      await localDb.media.delete(rec.id).catch(() => undefined);
      return { ok: false, reason: 'verify', message: 'Penyimpanan lokal tidak dapat diverifikasi. Coba lagi.' };
    }
    return { ok: true };
  } catch (e) {
    await localDb.media.delete(rec.id).catch(() => undefined);
    if (isQuotaError(e)) return { ok: false, reason: 'quota', message: 'Penyimpanan perangkat penuh. Hapus media lokal atau kosongkan ruang, lalu coba lagi.' };
    return { ok: false, reason: 'error', message: 'Gagal menyimpan media di perangkat.' };
  }
}

export async function getLocalMedia(accountUid: string, id: string): Promise<LocalMedia | undefined> {
  const rec = await localDb.media.get(id);
  return rec && rec.accountUid === accountUid ? rec : undefined;
}

export type LocalFilter = 'all' | 'sent' | 'received';

export async function listLocalMedia(accountUid: string, filter: LocalFilter = 'all'): Promise<LocalMedia[]> {
  const all = await localDb.media.where('accountUid').equals(accountUid).toArray();
  return all.filter((m) => filter === 'all' || m.direction === filter).sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteLocalMedia(accountUid: string, id: string): Promise<void> {
  const rec = await localDb.media.get(id);
  if (rec && rec.accountUid === accountUid) await localDb.media.delete(id);
}

export async function clearLocalMedia(accountUid: string): Promise<number> {
  return localDb.media.where('accountUid').equals(accountUid).delete();
}

export async function localUsage(accountUid: string): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;
  await localDb.media.where('accountUid').equals(accountUid).each((m) => {
    count += 1;
    bytes += m.size + (m.thumb?.size ?? 0);
  });
  return { count, bytes };
}

/** Pengamat realtime (dipakai UI agar langsung berubah setelah unduhan selesai). */
export function watchLocalMedia(accountUid: string, id: string, cb: (rec: LocalMedia | null) => void): () => void {
  const sub = liveQuery(() => getLocalMedia(accountUid, id)).subscribe({ next: (r) => cb(r ?? null), error: () => cb(null) });
  return () => sub.unsubscribe();
}

export function watchLocalList(accountUid: string, filter: LocalFilter, cb: (list: LocalMedia[]) => void): () => void {
  const sub = liveQuery(() => listLocalMedia(accountUid, filter)).subscribe({ next: cb, error: () => cb([]) });
  return () => sub.unsubscribe();
}

// ---- Antrean unggah ----
export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  await localDb.outbox.put(item);
}
export function listOutbox(accountUid: string): Promise<OutboxItem[]> {
  return localDb.outbox.where('accountUid').equals(accountUid).sortBy('createdAt');
}
export async function updateOutbox(id: string, patch: Partial<OutboxItem>): Promise<void> {
  await localDb.outbox.update(id, patch);
}
export async function removeOutbox(id: string): Promise<void> {
  await localDb.outbox.delete(id);
}

// ---- Info penyimpanan browser ----
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
export async function isStoragePersisted(): Promise<boolean | null> {
  return navigator.storage?.persisted ? navigator.storage.persisted() : null;
}
export async function requestPersistentStorage(): Promise<boolean | null> {
  return navigator.storage?.persist ? navigator.storage.persist() : null;
}
