import { useCallback, useEffect, useRef, useState } from 'react';
import { doc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { getFirebase } from '@/lib/firebase/client';
import type { OutboxItem } from '@/lib/local/db';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { MEDIA_LIMITS } from '@/shared/mediaLogic';
import type { Message } from '@/types/chat';
import type { UserProfile } from '@/types/user';
import { parseMediaMeta } from './mappers';
import { receiveMedia } from './receive';
import { useLocalMedia, useObjectUrl } from './useLocalMedia';

/** Media di dalam gelembung chat: tampil dari salinan lokal; penerima mengunduh lalu menyimpan ke IndexedDB. */
export function MediaBubble({ me, msg }: { me: UserProfile; msg: Message }) {
  const id = msg.mediaId ?? '';
  const meta = useLiveDoc(id ? `mm:${id}` : null, () => doc(getFirebase().db, 'mediaMetadata', id), (d) => parseMediaMeta(id, d));
  const local = useLocalMedia(me.uid, id || null);
  const thumbUrl = useObjectUrl(local ? (local.thumb ?? (local.kind === 'image' ? local.blob : null)) : null);
  const [state, setState] = useState<{ busy: boolean; error: string | null; quota: boolean }>({ busy: false, error: null, quota: false });
  const autoTried = useRef(false);
  const mine = msg.senderUid === me.uid;
  const m = meta.data;
  const isRecipient = !!m && m.recipients.includes(me.uid);

  const download = useCallback(async () => {
    if (!m) return;
    setState({ busy: true, error: null, quota: false });
    const r = await receiveMedia(me.uid, m);
    setState({ busy: false, error: r.ok ? null : r.error, quota: !r.ok && !!r.quota });
  }, [m, me.uid]);

  useEffect(() => {
    if (autoTried.current || local !== null || mine || !m || m.status !== 'available' || !isRecipient) return;
    if (m.size <= MEDIA_LIMITS.autoDownloadMaxBytes) {
      autoTried.current = true;
      void download();
    }
  }, [local, mine, m, isRecipient, download]);

  // Salinan lokal sudah ada tetapi konfirmasi ke server belum tercatat: coba lagi (idempoten).
  const needsAck = !!local && !!m && !mine && isRecipient && m.status === 'available' && !m.receivedBy.includes(me.uid);
  useEffect(() => {
    if (needsAck && m) void receiveMedia(me.uid, m);
  }, [needsAck, m, me.uid]);

  if (local === undefined) return <span className="skeleton" style={{ display: 'block', width: 200, height: 140 }} aria-hidden="true" />;

  if (local) {
    return (
      <span className="media-bubble">
        <Link to={`/media/${id}`} className="media-thumb" aria-label={local.kind === 'video' ? 'Putar video' : 'Buka foto'}>
          {thumbUrl ? <img src={thumbUrl} alt={msg.text || 'Media'} /> : <span className="media-ph">{local.kind === 'video' ? '🎬' : '🖼️'}</span>}
          {local.kind === 'video' && <span className="media-play" aria-hidden="true">▶</span>}
        </Link>
        {msg.text && <span className="msg-text">{msg.text}</span>}
      </span>
    );
  }

  let body: string;
  let action: 'retry' | 'download' | null = null;
  if (mine) body = 'Media ini tidak tersedia di perangkat ini.';
  else if (meta.loading) body = 'Memuat…';
  else if (!m) body = 'Media tidak tersedia.';
  else if (m.status !== 'available') body = 'Media sudah tidak tersedia di server (kedaluwarsa atau dihapus).';
  else if (state.busy) body = 'Mengunduh…';
  else if (state.error) { body = state.error; action = 'retry'; }
  else { body = `${m.kind === 'video' ? 'Video' : 'Foto'} · ${(m.size / 1024 / 1024).toFixed(1)} MB`; action = 'download'; }

  return (
    <span className="media-bubble">
      <span className="media-ph media-ph--wait" aria-live="polite">{body}</span>
      {state.quota && <Link to="/pengaturan/penyimpanan">Kelola penyimpanan</Link>}
      {action && <button className="btn btn--ghost btn--sm" onClick={() => void download()}>{action === 'retry' ? 'Coba lagi' : 'Unduh'}</button>}
      {msg.text && <span className="msg-text">{msg.text}</span>}
    </span>
  );
}

/** Baris status unggahan di chat (antre, mengunggah, gagal). */
export function UploadRow({ item, progress, onRetry, onDiscard }: { item: OutboxItem; progress: number | undefined; onRetry: () => void; onDiscard: () => void }) {
  const pct = Math.round((progress ?? 0) * 100);
  return (
    <div className={`msg msg--me${item.status === 'failed' ? ' msg--failed' : ''}`} role={item.status === 'failed' ? 'alert' : 'status'}>
      <span className="msg-text">
        {item.status === 'uploading' ? `Mengunggah media… ${pct}%` : item.status === 'queued' ? (navigator.onLine ? 'Menunggu giliran…' : 'Menunggu koneksi…') : `Gagal mengirim media: ${item.error ?? ''}`}
      </span>
      {item.status === 'uploading' && <span className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>}
      {item.status === 'failed' && (
        <span className="row" style={{ gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={onRetry}>Kirim ulang</button>
          <button className="btn btn--ghost btn--sm" onClick={onDiscard}>Buang</button>
        </span>
      )}
    </div>
  );
}
