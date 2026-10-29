import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FirebaseError } from 'firebase/app';
import { collection, doc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import type { OutboxItem } from '@/lib/local/db';
import { MEDIA_LIMITS } from '@/shared/mediaLogic';
import { messageExists, sendMediaMessage } from '@/features/chat/chat.service';
import { describeSocialError } from '@/features/friends/friends.service';
import type { UserProfile } from '@/types/user';
import { createMetadata, describeMediaError, getMetadataState, resolveRecipients, sweepOwnMedia, uploadMedia } from './media.service';
import type { PreparedMedia } from './mediaProcessing';
import { enqueueOutbox, getLocalMedia, listOutbox, removeOutbox, saveLocalMedia, updateOutbox } from './mediaStore';

interface EnqueueOpts {
  context: 'chat' | 'story';
  cid: string | null;
  caption: string;
}
type EnqueueResult = { ok: true; id: string } | { ok: false; error: string };

interface QueueCtx {
  items: OutboxItem[];
  progress: Record<string, number>;
  enqueue: (media: PreparedMedia, opts: EnqueueOpts) => Promise<EnqueueResult>;
  retry: (id: string) => void;
  discard: (id: string) => Promise<void>;
}

const QueueContext = createContext<QueueCtx>({
  items: [], progress: {}, enqueue: async () => ({ ok: false, error: 'Antrean belum siap.' }), retry: () => {}, discard: async () => {},
});

function describe(e: unknown): string {
  if (e instanceof FirebaseError) return e.code === 'resource-exhausted' || e.code === 'not-found' ? describeMediaError(e).message : describeSocialError(e);
  return e instanceof Error ? e.message : 'Gagal mengirim media.';
}

/**
 * Antrean unggah yang bertahan di IndexedDB: unggah potongan → tandai tersedia → (chat) kirim pesan.
 * Setiap langkah idempoten, jadi aman diulang setelah koneksi putus atau aplikasi ditutup.
 */
export function MediaQueueProvider({ me, children }: { me: UserProfile; children: ReactNode }) {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const running = useRef(false);

  const refresh = useCallback(async () => setItems(await listOutbox(me.uid)), [me.uid]);

  const runItem = useCallback(async (item: OutboxItem) => {
    try {
      const local = await getLocalMedia(me.uid, item.id);
      if (!local) throw new Error('Berkas lokal tidak ditemukan (mungkin sudah dihapus).');
      await updateOutbox(item.id, { status: 'uploading', error: null, attempts: item.attempts + 1 });
      await refresh();

      let state = await getMetadataState(item.id);
      if (!state) {
        const recipients = await resolveRecipients(me.uid, item.context, item.cid);
        if (recipients.length === 0) throw new Error('Tidak ada penerima yang berhak.');
        await createMetadata(local, recipients);
        state = { status: 'uploading', reason: null };
      }
      if (state.status === 'uploading') {
        // Potongan yang sudah terunggah pada percobaan sebelumnya ditimpa dengan aman (idempoten).
        await uploadMedia(item.id, local.blob, item.context, (f) => setProgress((p) => ({ ...p, [item.id]: f })));
        state = { status: 'available', reason: null };
      }
      if (state.status === 'rejected') throw new Error(state.reason ?? 'Berkas ditolak oleh server.');
      if (state.status !== 'available') throw new Error('Media tidak tersedia di server.');
      if (item.context === 'chat' && item.cid && !(await messageExists(item.cid, item.id))) {
        await sendMediaMessage({ cid: item.cid, me, mediaId: item.id, kind: local.kind, caption: local.caption });
      }
      await removeOutbox(item.id);
    } catch (e) {
      await updateOutbox(item.id, { status: 'failed', error: describe(e) });
    }
  }, [me, refresh]);

  const process = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    try {
      for (;;) {
        const next = (await listOutbox(me.uid)).find((i) => i.status === 'queued');
        if (!next) break;
        await runItem(next);
        await refresh();
      }
    } finally {
      running.current = false;
      await refresh();
    }
  }, [me.uid, runItem, refresh]);

  useEffect(() => {
    void (async () => {
      for (const i of await listOutbox(me.uid)) if (i.status === 'uploading') await updateOutbox(i.id, { status: 'queued' }); // pulihkan setelah aplikasi tertutup
      await refresh();
      await process();
      void sweepOwnMedia(me.uid).catch(() => undefined); // pengganti pembersihan terjadwal server
    })();
    const onOnline = () => void process();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [me.uid, refresh, process]);

  const enqueue = useCallback(async (m: PreparedMedia, o: EnqueueOpts): Promise<EnqueueResult> => {
    const id = doc(collection(getFirebase().db, 'mediaMetadata')).id;
    const saved = await saveLocalMedia({
      id, accountUid: me.uid, ownerUid: me.uid, direction: 'sent', context: o.context, cid: o.cid,
      kind: m.kind, mime: m.mime, size: m.blob.size, width: m.width, height: m.height, durationSec: m.durationSec,
      caption: o.caption.trim().slice(0, MEDIA_LIMITS.captionMax), blob: m.blob, thumb: m.thumb, savedAt: Date.now(),
    });
    if (!saved.ok) return { ok: false, error: saved.message };
    await enqueueOutbox({ id, accountUid: me.uid, context: o.context, cid: o.cid, status: 'queued', error: null, attempts: 0, createdAt: Date.now() });
    await refresh();
    void process();
    return { ok: true, id };
  }, [me.uid, refresh, process]);

  const retry = useCallback((id: string) => {
    void updateOutbox(id, { status: 'queued', error: null }).then(() => process());
  }, [process]);

  const discard = useCallback(async (id: string) => {
    await removeOutbox(id);
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({ items, progress, enqueue, retry, discard }), [items, progress, enqueue, retry, discard]);
  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useMediaQueue(): QueueCtx {
  return useContext(QueueContext);
}
