import { useState, type ChangeEvent } from 'react';
import { MEDIA_LIMITS } from '@/shared/mediaLogic';
import { useMediaQueue } from './MediaQueueProvider';
import { prepareFile, type PreparedMedia } from './mediaProcessing';
import { useObjectUrl } from './useLocalMedia';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime';

/** Pilih dari galeri/kamera → validasi & kompresi → pratinjau + caption → masuk antrean unggah. */
export function MediaComposer({ context, cid, onClose }: { context: 'chat' | 'story'; cid: string | null; onClose: () => void }) {
  const queue = useMediaQueue();
  const [prepared, setPrepared] = useState<PreparedMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = useObjectUrl(prepared?.blob);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    setPrepared(null);
    try {
      const r = await prepareFile(file);
      if (r.ok) setPrepared(r.media);
      else setError(r.error);
    } catch {
      setError('Gagal memproses berkas.');
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!prepared) return;
    setBusy(true);
    const r = await queue.enqueue(prepared, { context, cid, caption });
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={context === 'story' ? 'Tambah story' : 'Kirim media'}>
      <div className="overlay-card">
        <h2>{context === 'story' ? 'Tambah story' : 'Kirim media'}</h2>
        <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          <label className="btn btn--ghost">Galeri<input className="sr-only" type="file" accept={ACCEPT} onChange={(e) => void onPick(e)} /></label>
          <label className="btn btn--ghost">Kamera<input className="sr-only" type="file" accept="image/*,video/*" capture="environment" onChange={(e) => void onPick(e)} /></label>
        </div>
        {busy && !prepared && <div className="skeleton" style={{ height: 160 }} aria-label="Memproses" />}
        {prepared && url && (
          <div className="preview">
            {prepared.kind === 'image' ? <img src={url} alt="Pratinjau" /> : <video src={url} controls playsInline muted />}
            <p className="field-hint">{(prepared.blob.size / 1024 / 1024).toFixed(1)} MB{prepared.kind === 'video' ? ` · ${prepared.durationSec} dtk` : ''}</p>
          </div>
        )}
        {prepared && (
          <div className="field">
            <label htmlFor="mcaption">Caption (opsional)</label>
            <input id="mcaption" className="input" maxLength={MEDIA_LIMITS.captionMax} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="field-hint">Foto dikompres dan metadata lokasinya dihapus. Video maksimal {MEDIA_LIMITS.videoMaxSeconds} detik dan 25 MB. {!navigator.onLine && 'Kamu offline: media dikirim saat koneksi kembali.'}</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn--ghost" onClick={onClose}>Batal</button>
          <button className="btn btn--primary" disabled={!prepared || busy} onClick={() => void onSend()}>{busy && prepared ? 'Menyimpan…' : 'Kirim'}</button>
        </div>
      </div>
    </div>
  );
}
