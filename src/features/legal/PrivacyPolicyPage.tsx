const operator = import.meta.env.VITE_OPERATOR_NAME || 'pemilik aplikasi';
const email = import.meta.env.VITE_SUPPORT_EMAIL;

export function PrivacyPolicyPage() {
  return (
    <>
      <h1>Kebijakan Privasi</h1>
      <p className="field-hint">Dokumen ini adalah templat yang menggambarkan cara kerja aplikasi. {operator} wajib meninjaunya (idealnya bersama penasihat hukum) sebelum rilis publik.</p>

      <h2>Data yang kami proses</h2>
      <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
        <li><strong>Akun:</strong> login Google (nama, foto, ID akun, dan email disimpan oleh Firebase Authentication). Profilmu (nama tampilan, foto, @username, bio) terlihat oleh pengguna login lain yang mencarimu.</li>
        <li><strong>Sosial:</strong> daftar teman, permintaan, blokir, grup Duo/Squad, undangan, dan laporan.</li>
        <li><strong>Chat:</strong> isi pesan, balasan, reaksi, status baca (bila kamu mengaktifkannya), dan status mengetik/online (bila diaktifkan).</li>
        <li><strong>Media:</strong> foto dan video yang kamu kirim, termasuk Story. Foto dikompres dan metadata lokasinya dihapus.</li>
        <li><strong>Lokasi:</strong> hanya saat kamu memulai sesi berbagi: koordinat, akurasi, kecepatan perkiraan, dan waktu. Riwayat rute hanya jika kamu mengaktifkannya.</li>
        <li><strong>Aktivitas:</strong> Pet, XP, streak, achievement, dan pengaturan privasi/notifikasi.</li>
        <li><strong>Perangkat:</strong> token push (bila kamu mengaktifkan push) dan data teknis standar layanan hosting.</li>
      </ul>

      <h2>Berapa lama disimpan</h2>
      <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
        <li>Media di server bersifat sementara: dihapus setelah semua penerima menyimpannya, atau otomatis setelah 7 hari (Story: 24 jam). Salinan di perangkat penerima ada di bawah kendali penerima.</li>
        <li>Koordinat aktif dihapus saat sesi berhenti atau berakhir. Metadata sesi dihapus setelah 24 jam; riwayat rute (opsional) setelah 7 hari.</li>
        <li>Pesan disimpan sampai dihapus oleh pengirim atau akun dihapus. Pesan yang dihapus ditandai "Pesan dihapus" dan isinya dikosongkan.</li>
        <li>Data akun dan aktivitas disimpan selama akun ada dan dihapus saat kamu menghapus akun.</li>
      </ul>

      <h2>Pihak ketiga</h2>
      <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
        <li><strong>Google Firebase</strong> (Authentication, Firestore, Realtime Database, Storage, Cloud Functions, Cloud Messaging) memproses data aplikasi.</li>
        <li><strong>OpenStreetMap</strong> menerima permintaan ubin peta (alamat IP dan area peta yang dilihat) saat kamu membuka peta. Koordinat anggota tidak dikirim ke mereka.</li>
        <li><strong>GitHub Pages</strong> menyajikan aplikasi dan dapat mencatat data teknis akses.</li>
        <li>Kami tidak menjual data dan tidak menampilkan iklan.</li>
      </ul>

      <h2>Keamanan dan batasannya</h2>
      <p>Data dilindungi enkripsi saat transit dan aturan akses di server. Pesan dan media <strong>tidak</strong> dienkripsi end-to-end, sehingga pengelola proyek Firebase secara teknis dapat mengakses data tersimpan, dan kami dapat meninjau laporan penyalahgunaan. Salinan media di perangkat tidak dienkripsi dan bisa hilang bila data browser dihapus.</p>

      <h2>Hakmu</h2>
      <p>Kamu dapat mengekspor datamu, mengubah profil dan pengaturan privasi, menghentikan berbagi lokasi kapan saja, memblokir pengguna, dan menghapus akun beserta data pribadi di Lainnya → Akun. Pesan yang pernah kamu kirim di percakapan orang lain dikosongkan, bukan dihapus dari riwayat mereka.</p>

      <h2>Anak-anak</h2>
      <p>Aplikasi ditujukan bagi pengguna yang telah memenuhi usia minimum di wilayahnya (umumnya 13 tahun ke atas). Orang tua yang menemukan akun anak yang tidak sesuai dapat menghubungi kami untuk penghapusan.</p>

      <h2>Kontak</h2>
      <p>{email ? <a href={`mailto:${email}`}>{email}</a> : `Hubungi ${operator}.`}</p>
    </>
  );
}
