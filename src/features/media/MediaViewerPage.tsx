import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useAction } from '@/hooks/useAction';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import type { UserProfile } from '@/types/user';
import { parseMediaMeta } from './mappers';
import { deleteRemoteMedia } from './media.service';
import { useMediaQueue } from './MediaQueueProvider';
import { deleteLocalMedia } from './mediaStore';
import { useLocalMedia, useObjectUrl } from './useLocalMedia';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

export function MediaViewerPage({ me }: { me: UserProfile }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const local = useLocalMedia(me.uid, id);
  const url = useObjectUrl(local?.blob);
  const meta = useLiveDoc(id ? `mm:${id}` : null, () => doc(getFirebase().db, 'mediaMetadata', id), (d) => parseMediaMeta(id, d));
  const queue = useMediaQueue();
  const act = useAction();
  const [notice, setNotice] = useState<string | null>(null);
  const queued = queue.items.some((i) => i.id === id);

  if (local === undefined) return <div className="skeleton" style={{ height: 300 }} />;
  if (!local || !url) {
    return (
      <>
        <h1>Media tidak ada di perangkat ini</h1>
        <p>Salinan lokal tidak ditemukan. Jika media berasal dari chat dan belum kedaluwarsa, buka percakapannya untuk mengunduh.</p>
        <Link className="btn btn--primary" to="/media-lokal">Media lokal</Link>
      </>
    );
  }

  const canServerDelete = local.direction === 'sent' && meta.data?.status === 'available';

  return (
    <>
      <p><Link to="/media-lokal">← Media lokal</Link></p>
      <div className="viewer">{local.kind === 'image' ? <img src={url} alt={local.caption || 'Media'} /> : <video src={url} controls playsInline />}</div>
      {local.caption && <p style={{ color: 'var(--text)' }}>{local.caption}</p>}
      <p className="field-hint">{local.direction === 'sent' ? 'Terkirim' : 'Diterima'} · {(local.size / 1024 / 1024).toFixed(2)} MB · {new Date(local.savedAt).toLocaleString('id-ID')}</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <a className="btn btn--primary" href={url} download={`strike-pet-${local.id}.${EXT[local.mime] ?? 'bin'}`}>Simpan ke perangkat</a>
        <button className="btn btn--danger" disabled={queued || act.busy} onClick={() => { if (window.confirm('Hapus salinan di perangkat ini? Ini tidak bisa dibatalkan.')) void deleteLocalMedia(me.uid, id).then(() => navigate('/media-lokal')); }}>Hapus salinan lokal</button>
        {canServerDelete && (
          <button className="btn btn--ghost" disabled={act.busy} onClick={() => window.confirm('Hapus media dari server? Penerima yang belum mengunduh tidak akan bisa mengambilnya.') && void act.run(async () => { await deleteRemoteMedia(id); setNotice('Media dihapus dari server.'); })}>Hapus dari server</button>
        )}
      </div>
      {queued && <p className="field-hint">Media masih dalam antrean kirim, jadi salinan lokal belum bisa dihapus.</p>}
      {act.error && <p className="field-error" role="alert">{act.error}</p>}
      {notice && <p className="field-hint" role="status">{notice}</p>}
    </>
  );
}
