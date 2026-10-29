# Keamanan dan privasi

## Kontrol utama
| Ancaman | Kontrol |
|---|---|
| Membaca data privat pengguna lain | Rules per koleksi (`isOwner`, keanggotaan, penerima); tes di `tests-rules/` |
| Merebut/menggandakan username | Transaksi + `getAfter` pada Rules (klaim atomik) |
| Memalsukan XP/streak/reward | Hanya Functions yang menulis; cooldown, batas XP harian, aturan streak di server |
| Memasukkan orang ke grup tanpa izin | Bergabung hanya bersama penerimaan undangan pada operasi yang sama |
| Media privat bocor | Storage privat, tanpa URL publik, unduh via Rules lintas layanan, hapus setelah semua ack |
| Berkas berbahaya menyamar sebagai gambar | Validasi byte awal di klien **dan** server; MIME dipaksa sama dengan metadata; tipe dibatasi |
| Lokasi tersembunyi/berlebihan | Hanya dimulai pengguna, durasi terbatas, indikator, penerima dipilih, RTDB Rules per sesi, jeda tulis, hapus saat berhenti |
| Pelacakan oleh anggota yang keluar | Dibatasi durasi sesi (maks 8 jam); daftar penerima dikunci saat mulai (batasan diketahui) |
| Spam/penyalahgunaan | Blokir, lapor, batas panjang, validasi bentuk data di Rules |
| XSS | Semua teks dirender sebagai teks React (tanpa `dangerouslySetInnerHTML`); marker peta dibangun dengan `textContent`; CSP bawaan hosting |
| Rahasia di repo | Tidak ada; `.env.example` hanya konfigurasi publik; `.gitignore` mengecualikan `.env*` dan service account |

## Batasan yang jujur
- Bukan end-to-end encrypted; pengelola proyek Firebase dapat mengakses data tersimpan.
- Data RTDB mengetik/online dapat dibaca pengguna login yang tahu id-nya; online hanya dipublikasikan bila diaktifkan pengguna.
- Konfirmasi penerimaan media adalah pernyataan klien (hanya merugikan pelakunya sendiri bila palsu).
- Belum ada App Check dan moderasi otomatis; laporan hanya tersimpan di koleksi `reports`.
- Log Functions tidak memuat isi pesan atau koordinat.

## Retensi
Media server: ≤7 hari (Story 24 jam) atau setelah semua ack. Koordinat aktif: dihapus saat sesi berakhir. Metadata sesi: 24 jam; riwayat rute opsional: 7 hari. Akun: dihapus penuh lewat Akun → Hapus akun.
