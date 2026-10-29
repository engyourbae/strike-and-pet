import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LocalMedia } from '@/lib/local/db';
import type { UserProfile } from '@/types/user';
import { localUsage, type LocalFilter } from './mediaStore';
import { useLocalList, useObjectUrl } from './useLocalMedia';

function Thumb({ rec }: { rec: LocalMedia }) {
  const url = useObjectUrl(rec.thumb ?? (rec.kind === 'image' ? rec.blob : null));
  return (
    <Link to={`/media/${rec.id}`} className="grid-item" aria-label={`${rec.kind === 'video' ? 'Video' : 'Foto'} ${rec.direction === 'sent' ? 'terkirim' : 'diterima'}`}>
      {url ? <img src={url} alt="" /> : <span className="media-ph">{rec.kind === 'video' ? '🎬' : '🖼️'}</span>}
      {rec.kind === 'video' && <span className="media-play" aria-hidden="true">▶</span>}
    </Link>
  );
}

const TABS: { id: LocalFilter; label: string }[] = [{ id: 'all', label: 'Semua' }, { id: 'received', label: 'Diterima' }, { id: 'sent', label: 'Terkirim' }];

export function LocalMediaPage({ me }: { me: UserProfile }) {
  const [filter, setFilter] = useState<LocalFilter>('all');
  const list = useLocalList(me.uid, filter);
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  useEffect(() => { void localUsage(me.uid).then(setUsage); }, [me.uid, list]);

  return (
    <>
      <h1>Media lokal</h1>
      <p>{usage ? `${usage.count} berkas · ${(usage.bytes / 1024 / 1024).toFixed(1)} MB di perangkat ini.` : 'Menghitung…'} <Link to="/pengaturan/penyimpanan">Kelola penyimpanan</Link></p>
      <div className="seg" role="tablist" aria-label="Filter media" style={{ gridAutoFlow: 'column', marginBottom: 16 }}>
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={filter === t.id} aria-checked={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</button>)}
      </div>
      {list === undefined ? <div className="skeleton" style={{ height: 160 }} /> : list.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>Belum ada media tersimpan. Media yang kamu kirim dan terima akan muncul di sini.</p></div>
      ) : (
        <div className="grid">{list.map((r) => <Thumb key={r.id} rec={r} />)}</div>
      )}
      <p className="field-hint" style={{ marginTop: 16 }}>Media disimpan di browser perangkat ini. Browser atau sistem dapat menghapusnya (mis. saat data situs dibersihkan atau ruang penuh), jadi simpan yang penting ke perangkat.</p>
    </>
  );
}
