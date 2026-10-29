import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localDb, type LocalMedia } from '@/lib/local/db';
import {
  clearLocalMedia, deleteLocalMedia, enqueueOutbox, getLocalMedia, isQuotaError, listLocalMedia, listOutbox, localUsage, removeOutbox, saveLocalMedia, updateOutbox,
} from '@/features/media/mediaStore';

function rec(over: Partial<LocalMedia> = {}): LocalMedia {
  return {
    id: 'm1', accountUid: 'alice', ownerUid: 'bob', direction: 'received', context: 'chat', cid: 'alice_bob', kind: 'image', mime: 'image/jpeg',
    size: 5, width: 10, height: 10, durationSec: 0, caption: '', blob: new Blob(['hello'], { type: 'image/jpeg' }), thumb: null, savedAt: 1, ...over,
  };
}

beforeEach(async () => {
  await localDb.media.clear();
  await localDb.outbox.clear();
  vi.restoreAllMocks();
});

describe('penyimpanan media lokal (IndexedDB)', () => {
  it('menyimpan, memverifikasi, dan membaca kembali (juga setelah "offline": tanpa jaringan sama sekali)', async () => {
    expect(await saveLocalMedia(rec())).toEqual({ ok: true });
    const back = await getLocalMedia('alice', 'm1');
    expect(back?.blob.size).toBe(5);
  });

  it('memisahkan akun yang memakai browser yang sama', async () => {
    await saveLocalMedia(rec());
    expect(await getLocalMedia('mallory', 'm1')).toBeUndefined();
    await deleteLocalMedia('mallory', 'm1'); // bukan pemilik: tidak menghapus
    expect(await getLocalMedia('alice', 'm1')).toBeDefined();
  });

  it('QuotaExceededError dilaporkan sebagai quota dan tidak meninggalkan data setengah jadi', async () => {
    const err = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
    vi.spyOn(localDb.media, 'put').mockRejectedValueOnce(err);
    const r = await saveLocalMedia(rec());
    expect(r).toMatchObject({ ok: false, reason: 'quota' });
    expect(await getLocalMedia('alice', 'm1')).toBeUndefined();
  });

  it('mengenali QuotaExceededError yang dibungkus Dexie (inner)', () => {
    expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true);
    expect(isQuotaError(new Error('lain'))).toBe(false);
  });

  it('gagal verifikasi (ukuran tidak cocok) = tidak dianggap tersimpan', async () => {
    vi.spyOn(localDb.media, 'get').mockResolvedValueOnce(rec({ blob: new Blob(['x']) }));
    const r = await saveLocalMedia(rec());
    expect(r).toMatchObject({ ok: false, reason: 'verify' });
  });

  it('daftar, penggunaan, filter, dan hapus semua', async () => {
    await saveLocalMedia(rec({ id: 'a', direction: 'sent', savedAt: 2 }));
    await saveLocalMedia(rec({ id: 'b', direction: 'received', savedAt: 3 }));
    await saveLocalMedia(rec({ id: 'c', accountUid: 'other' }));
    expect((await listLocalMedia('alice')).map((m) => m.id)).toEqual(['b', 'a']);
    expect((await listLocalMedia('alice', 'sent')).map((m) => m.id)).toEqual(['a']);
    expect(await localUsage('alice')).toEqual({ count: 2, bytes: 10 });
    expect(await clearLocalMedia('alice')).toBe(2);
    expect(await getLocalMedia('other', 'c')).toBeDefined();
  });

  it('antrean unggah bertahan dan bisa diperbarui', async () => {
    await enqueueOutbox({ id: 'q1', accountUid: 'alice', context: 'chat', cid: 'alice_bob', status: 'queued', error: null, attempts: 0, createdAt: 1 });
    await updateOutbox('q1', { status: 'failed', error: 'x' });
    expect((await listOutbox('alice'))[0]).toMatchObject({ id: 'q1', status: 'failed', error: 'x' });
    await removeOutbox('q1');
    expect(await listOutbox('alice')).toEqual([]);
  });
});
