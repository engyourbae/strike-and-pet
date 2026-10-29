const operator = import.meta.env.VITE_OPERATOR_NAME || 'pemilik aplikasi';

export function TermsPage() {
  return (
    <>
      <h1>Syarat Penggunaan</h1>
      <p className="field-hint">Dokumen ini adalah templat. {operator} wajib meninjaunya sebelum rilis publik.</p>
      <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
        <li><strong>Akun.</strong> Kamu bertanggung jawab atas akun Google yang dipakai dan atas aktivitas di akunmu. Gunakan username dan profil yang tidak menyesatkan atau meniru orang lain.</li>
        <li><strong>Perilaku.</strong> Dilarang melecehkan, mengancam, spam, membagikan konten ilegal atau eksplisit, atau mencoba mengakses data orang lain. Pelanggaran dapat berujung pada pembatasan atau penghapusan akun.</li>
        <li><strong>Lokasi.</strong> Berbagi lokasi hanya dengan persetujuan orang yang dibagikan. Dilarang memakainya untuk membuntuti atau memantau seseorang tanpa sepengetahuannya. Kecepatan yang ditampilkan hanyalah perkiraan situasional, bukan alat ukur tersertifikasi, dan tidak boleh dipakai untuk keselamatan atau penegakan hukum. Jangan menggunakan ponsel saat mengemudi.</li>
        <li><strong>Konten.</strong> Kamu memegang hak atas kontenmu dan memberi kami izin terbatas untuk menyimpan serta meneruskannya kepada penerima yang kamu pilih agar layanan berfungsi. Pastikan kamu berhak membagikan foto/video yang kamu kirim.</li>
        <li><strong>Keamanan.</strong> Gunakan fitur blokir dan lapor bila perlu. Kami dapat meninjau laporan dan mengambil tindakan.</li>
        <li><strong>Ketersediaan.</strong> Layanan diberikan apa adanya tanpa jaminan. Pengiriman lokasi di latar belakang, push notification, dan penyimpanan lokal tidak dijamin; data lokal dapat hilang. Fitur dapat berubah atau dihentikan.</li>
        <li><strong>Penghapusan.</strong> Kamu dapat menghapus akunmu kapan saja di Lainnya → Akun.</li>
        <li><strong>Perubahan.</strong> Syarat dapat diperbarui; penggunaan berkelanjutan berarti menyetujui versi terbaru.</li>
      </ul>
    </>
  );
}
