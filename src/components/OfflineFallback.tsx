import { Link } from 'react-router-dom';
import { useOnline } from '@/hooks/useOnline';

/** Penjelasan ringkas saat offline: apa yang tetap bisa dipakai dan apa yang butuh koneksi. */
export function OfflineFallback({ what = 'Fitur ini' }: { what?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="card" role="status">
      <h2>Kamu sedang offline</h2>
      <p>{what} membutuhkan koneksi internet. Saat offline kamu masih bisa membuka antarmuka, media lokal, dan chat yang sudah dimuat. Pesan yang kamu tulis dikirim saat koneksi kembali.</p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <Link className="btn btn--ghost btn--sm" to="/media-lokal">Media lokal</Link>
        <button className="btn btn--ghost btn--sm" onClick={() => window.location.reload()}>Coba lagi</button>
      </div>
    </div>
  );
}

export function OfflinePage() {
  const online = useOnline();
  return (
    <>
      <h1>{online ? 'Kamu sudah online' : 'Mode offline'}</h1>
      <p>{online ? 'Koneksi kembali. Semua fitur tersedia.' : 'Tidak ada koneksi internet.'}</p>
      <section className="card">
        <h2>Yang tetap bisa dipakai offline</h2>
        <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
          <li>Membuka antarmuka aplikasi dan pengaturan tema.</li>
          <li>Membaca profil, chat, dan data yang sudah dimuat sebelumnya.</li>
          <li>Membuka media yang sudah tersimpan di perangkat.</li>
          <li>Menulis pesan: akan dikirim otomatis saat koneksi kembali.</li>
        </ul>
        <h2>Yang membutuhkan koneksi</h2>
        <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
          <li>Login baru, mengunggah dan mengunduh media, Live Location, peta, Pet dan Strike.</li>
        </ul>
      </section>
    </>
  );
}
