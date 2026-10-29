import { Link } from 'react-router-dom';

export function ConfigMissingPage() {
  return (
    <div className="center-page">
      <div className="center-card">
        <h1>Firebase belum dikonfigurasi</h1>
        <p>Salin <code>.env.example</code> menjadi <code>.env.local</code>, isi nilai dari Firebase Console, lalu jalankan ulang aplikasi. Panduan lengkap ada di README.</p>
      </div>
    </div>
  );
}

export function ErrorPage({ message }: { message: string }) {
  return (
    <div className="center-page">
      <div className="center-card">
        <h1>Tidak bisa memuat akun</h1>
        <p>{message}</p>
        <button className="btn btn--primary" onClick={() => window.location.reload()}>Coba lagi</button>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <>
      <h1>Halaman tidak ditemukan</h1>
      <p>Alamat yang kamu buka tidak ada.</p>
      <Link className="btn btn--primary" to="/">Ke Beranda</Link>
    </>
  );
}
