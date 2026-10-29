import { sniffMime } from '@/shared/mediaLogic';
import type { MediaMeta } from '@/types/media';
import { acknowledgeMedia, describeMediaError, downloadMediaBlob } from './media.service';
import { makeThumbnailFromBlob } from './mediaProcessing';
import { getLocalMedia, saveLocalMedia } from './mediaStore';

export type ReceiveResult = { ok: true } | { ok: false; error: string; gone?: boolean; quota?: boolean };

const inflight = new Map<string, Promise<ReceiveResult>>();

async function ackQuietly(id: string): Promise<void> {
  try {
    await acknowledgeMedia(id);
  } catch {
    /* dicoba lagi saat media dibuka berikutnya (salinan lokal sudah ada, receivedBy belum berisi kita) */
  }
}

async function doReceive(accountUid: string, meta: MediaMeta): Promise<ReceiveResult> {
  const existing = await getLocalMedia(accountUid, meta.id);
  if (existing) {
    if (meta.status === 'available' && !meta.receivedBy.includes(accountUid)) await ackQuietly(meta.id);
    return { ok: true };
  }
  if (meta.status !== 'available') return { ok: false, error: 'Media sudah tidak tersedia di server (kedaluwarsa atau dihapus).', gone: true };
  if (!navigator.onLine) return { ok: false, error: 'Tidak ada koneksi. Media akan bisa diunduh saat online.' };

  let blob: Blob;
  try {
    blob = await downloadMediaBlob(meta.id, meta.size + 4096);
  } catch (e) {
    const d = describeMediaError(e);
    return { ok: false, error: d.message, gone: d.gone };
  }
  if (blob.size !== meta.size) return { ok: false, error: 'Ukuran unduhan tidak sesuai. Coba lagi.' };
  if (sniffMime(new Uint8Array(await blob.slice(0, 16).arrayBuffer())) !== meta.mime) return { ok: false, error: 'Isi berkas tidak valid.' };

  const typed = blob.type === meta.mime ? blob : new Blob([blob], { type: meta.mime });
  const saved = await saveLocalMedia({
    id: meta.id,
    accountUid,
    ownerUid: meta.ownerUid,
    direction: 'received',
    context: meta.context,
    cid: meta.conversationId,
    kind: meta.kind,
    mime: meta.mime,
    size: typed.size,
    width: 0,
    height: 0,
    durationSec: meta.durationSec,
    caption: meta.caption,
    blob: typed,
    thumb: await makeThumbnailFromBlob(typed, meta.kind),
    savedAt: Date.now(),
  });
  // Tanpa penyimpanan lokal terverifikasi, JANGAN acknowledge: server tetap menyimpan sampai kedaluwarsa.
  if (!saved.ok) return { ok: false, error: saved.message, quota: saved.reason === 'quota' };
  await ackQuietly(meta.id);
  return { ok: true };
}

/** Mengunduh, menyimpan ke IndexedDB, memverifikasi, lalu acknowledge. Aman dipanggil berulang. */
export function receiveMedia(accountUid: string, meta: MediaMeta): Promise<ReceiveResult> {
  const key = `${accountUid}:${meta.id}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = doReceive(accountUid, meta).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
