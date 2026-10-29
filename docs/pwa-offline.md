# PWA dan offline

## Strategi cache
| Jenis | Strategi |
|---|---|
| Aset statis aplikasi (JS/CSS/HTML/SVG/PNG/manifest) | Precache (cache-first) oleh Workbox; versi lama dibersihkan |
| Navigasi | Fallback ke `index.html` (SPA, HashRouter) sehingga antarmuka terbuka offline |
| Data Firebase, API, media privat, koordinat, ubin peta | **Tidak** di-cache oleh service worker |
| Data dinamis | Cache persisten Firestore (milik SDK) + IndexedDB aplikasi (media/outbox) |

## Pembaruan aman
Mode `prompt`: versi baru diunduh di latar belakang dan pengguna memilih "Perbarui"; pengecekan tiap jam; bila sedang berbagi lokasi, diminta konfirmasi (muat ulang menghentikan berbagi). Versi tampil di Bantuan.

## Perilaku offline
- Tersedia: antarmuka, data yang sudah dimuat, media lokal, menulis pesan (antrean Firestore), antre unggah media.
- Butuh koneksi: login baru, unggah/unduh media, peta, lokasi, Pet/Strike, ekspor/hapus akun.
- Antrean unggah dilanjutkan saat `online`/aplikasi dibuka; tidak mengandalkan Background Sync.

## Konflik data
- Profil/pengaturan: last-write-wins per dokumen (satu pengguna, beberapa perangkat).
- Pesan: id dibuat klien; kirim ulang aman. Edit di luar jendela 15 menit ditolak server.
- Username: transaksi atomik. XP/streak/lokasi: server/jeda tulis menjadi otoritas.
- Media: id = id pesan; langkah unggah/validasi/kirim idempoten.

## Push
`public/push-sw.js` (diimpor service worker utama) menampilkan notifikasi generik (tanpa isi pesan) hanya saat aplikasi tidak terlihat; klik membuka rute hash terkait. Izin diminta hanya setelah pengguna menekan tombol di Privasi & notifikasi.
