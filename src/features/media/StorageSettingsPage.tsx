import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserProfile } from '@/types/user';
import { clearLocalMedia, getStorageEstimate, isStoragePersisted, localUsage, requestPersistentStorage } from './mediaStore';

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

export function StorageSettingsPage({ me }: { me: UserProfile }) {
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEst(await getStorageEstimate());
    setPersisted(await isStoragePersisted());
    setUsage(await localUsage(me.uid));
  }, [me.uid]);
  useEffect(() => { void load(); }, [load]);

  async function persist() {
    const ok = await requestPersistentStorage();
    setMsg(ok === null ? 'Browser ini tidak mendukung penyimpanan persisten.' : ok ? 'Penyimpanan persisten diaktifkan.' : 'Browser menolak. Pasang aplikasi ke layar utama atau beri izin lalu coba lagi.');
    await load();
  }

  async function clearAppCache() {
    if (!window.confirm('Bersihkan cache aplikasi? Media dan data akunmu TIDAK dihapus. Aplikasi akan memuat ulang file yang dibutuhkan.')) return;
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    setMsg(`Cache aplikasi dibersihkan (${keys.length}). Media lokal tidak tersentuh.`);
    await load();
  }

  async function clearMedia() {
    if (!window.confirm('Hapus SEMUA media lokal di perangkat ini? Media yang sudah dihapus dari server tidak bisa diunduh lagi.')) return;
    const n = await clearLocalMedia(me.uid);
    setMsg(`${n} media lokal dihapus.`);
    await load();
  }

  const pct = est && est.quota > 0 ? Math.min(100, (est.usage / est.quota) * 100) : 0;
  return (
    <>
      <h1>Penyimpanan</h1>
      <section className="card">
        <h2>Penggunaan browser</h2>
        {est ? (
          <>
            <div className="meter" role="meter" aria-label="Penggunaan penyimpanan" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} data-low={pct > 85}><i style={{ width: `${pct}%` }} /></div>
            <p className="field-hint">{mb(est.usage)} dari kira-kira {mb(est.quota)} ({pct.toFixed(1)}%). Perkiraan dari browser.</p>
          </>
        ) : <p className="field-hint">Browser tidak melaporkan penggunaan penyimpanan.</p>}
        <p style={{ marginBottom: 0 }}>Media lokal akunmu: {usage ? `${usage.count} berkas, ${mb(usage.bytes)}` : '…'}. <Link to="/media-lokal">Lihat</Link></p>
      </section>
      <section className="card">
        <h2>Penyimpanan persisten</h2>
        <p>{persisted === null ? 'Tidak didukung browser ini.' : persisted ? 'Aktif: browser tidak akan menghapus data situs secara otomatis saat ruang menipis.' : 'Belum aktif: browser boleh menghapus data situs saat ruang menipis.'}</p>
        {persisted === false && <button className="btn btn--primary" onClick={() => void persist()}>Minta penyimpanan persisten</button>}
      </section>
      <section className="card">
        <h2>Bersihkan</h2>
        <div className="stack">
          <button className="btn btn--ghost" onClick={() => void clearAppCache()}>Bersihkan cache aplikasi</button>
          <button className="btn btn--danger" onClick={() => void clearMedia()}>Hapus semua media lokal</button>
        </div>
      </section>
      {msg && <p className="field-hint" role="status">{msg}</p>}
      <p className="field-hint">Peringatan: menghapus data browser/aplikasi atau mencopot PWA dapat menghilangkan media lokal secara permanen. Penyimpanan lokal tidak dijamin selamanya.</p>
    </>
  );
}
