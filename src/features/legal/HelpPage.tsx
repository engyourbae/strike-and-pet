import { Link } from 'react-router-dom';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

const FAQ: { q: string; a: string }[] = [
  { q: 'Bagaimana cara menambah teman?', a: 'Buka tab Teman, cari @username, lalu kirim permintaan. Pertemanan terjadi setelah permintaan diterima.' },
  { q: 'Apa itu Strike dan Pet?', a: 'Catat strike sekali sehari untuk membangun streak dan merawat Pet agar naik level. XP dan streak dihitung di server. Terlewat satu hari bisa diselamatkan oleh "hari istirahat" yang kamu dapat tiap 7 hari berturut-turut.' },
  { q: 'Siapa yang bisa melihat lokasiku?', a: 'Hanya anggota grup yang kamu pilih, hanya selama sesi aktif, dan hanya setelah kamu menekan Mulai. Kamu bisa menghentikannya kapan saja. Berbagi tidak berjalan andal saat aplikasi di latar belakang.' },
  { q: 'Ke mana foto dan video yang kukirim pergi?', a: 'Media disimpan sementara di server privat (maks 7 hari; Story 24 jam) dan dihapus setelah semua penerima menyimpannya di perangkat mereka. Salinan di perangkat bisa hilang jika data browser dihapus, jadi simpan yang penting.' },
  { q: 'Apakah chat terenkripsi end-to-end?', a: 'Tidak. Pesan dan media dilindungi enkripsi saat dikirim dan aturan akses, tetapi bukan end-to-end. Lihat Kebijakan Privasi.' },
  { q: 'Bagaimana jika aku offline?', a: 'Antarmuka, data yang sudah dimuat, dan media lokal tetap bisa dibuka. Pesan yang kamu tulis dikirim otomatis saat online. Login baru, unggah/unduh media, peta, dan Pet/Strike butuh koneksi.' },
  { q: 'Bagaimana cara menghapus akun atau mengunduh datakku?', a: 'Buka Lainnya → Akun. Kamu bisa mengekspor data (JSON) dan menghapus akun beserta data pribadimu secara permanen.' },
  { q: 'Bagaimana melaporkan penyalahgunaan?', a: 'Gunakan tombol Laporkan pada profil pengguna atau pesan. Kamu juga bisa memblokir pengguna dari tab Teman.' },
];

export function HelpPage() {
  const install = useInstallPrompt();
  const email = import.meta.env.VITE_SUPPORT_EMAIL;
  return (
    <>
      <h1>Bantuan</h1>
      {FAQ.map((f) => (
        <details key={f.q} className="card" style={{ padding: 'var(--space-3) var(--space-4)' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 40, display: 'flex', alignItems: 'center' }}>{f.q}</summary>
          <p style={{ margin: 0 }}>{f.a}</p>
        </details>
      ))}
      <section className="card">
        <h2>Pasang aplikasi</h2>
        {install.installed ? <p style={{ margin: 0 }}>Aplikasi sudah terpasang di perangkat ini.</p> : install.canPrompt ? (
          <button className="btn btn--primary" onClick={() => void install.install()}>Pasang STRIKE &amp; PET</button>
        ) : install.showIosHint ? (
          <p style={{ margin: 0 }}>Di iPhone/iPad: ketuk tombol Bagikan di Safari lalu pilih <strong>Tambah ke Layar Utama</strong>.</p>
        ) : (
          <p style={{ margin: 0 }}>Gunakan menu browser (<em>Instal aplikasi</em> / <em>Tambahkan ke layar utama</em>) untuk memasangnya.</p>
        )}
      </section>
      <section className="card">
        <h2>Informasi</h2>
        <p className="field-hint">Versi {__APP_VERSION__} · dibangun {new Date(__BUILD_TIME__).toLocaleString('id-ID')}</p>
        <p style={{ margin: 0 }}>
          <Link to="/kebijakan-privasi">Kebijakan Privasi</Link> · <Link to="/syarat">Syarat Penggunaan</Link>
          {email ? <> · <a href={`mailto:${email}`}>{email}</a></> : null}
        </p>
      </section>
    </>
  );
}
