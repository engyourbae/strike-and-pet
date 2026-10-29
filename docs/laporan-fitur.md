# Laporan fitur (jujur)

Legenda: **Terverifikasi** = diuji di lingkungan penulis. **Selesai (kode)** = kode lengkap tetapi belum pernah dibuild/dijalankan. **Sebagian** / **Belum** = lihat catatan.

## Yang terverifikasi di lingkungan penulis
- Logika murni `src/shared/*` dan logika chat/sosial/username (typecheck strict + pemeriksaan Node): tanggal/zona waktu, streak, Pet, achievement, media (sniff/validasi), lokasi/kecepatan, id percakapan.
- Konsistensi import/ekspor seluruh file; JSON konfigurasi valid; kurung Security Rules seimbang.

## Fitur per bagian spesifikasi
| Bagian | Status | Catatan |
|---|---|---|
| 6 Login/profil | Selesai (kode) | Ekspor & hapus akun ada; ganti username, unggah foto, status "akun dinonaktifkan" (hanya pesan error), last seen privasi: online opsional |
| 7 Teman/Duo/Squad | Selesai (kode) | Peran hanya pemilik/anggota; foto grup belum |
| 8 Pet/Strike | Selesai (kode) | 1 Pet/akun; reward berupa achievement (tanpa item); pengingat hanya dalam aplikasi |
| 9–11 Lokasi/kecepatan/peta | Selesai (kode) | Tidak andal di latar belakang (batasan platform) |
| 12 Chat | Selesai (kode) | Delivered tidak tersedia; E2EE tidak ada; hapus oleh pemilik grup belum |
| 13–14 Media/Story/IndexedDB | Selesai (kode) | Video tidak di-transcode; salinan lokal tidak terenkripsi |
| 15 Keamanan | Selesai (kode) | Rules lengkap; tanpa App Check |
| 16 PWA/offline | Selesai (kode) | Tanpa Background Sync |
| 17 Notifikasi | Selesai (kode) | Dalam aplikasi + push (pesan, permintaan, undangan, lokasi); streak/Pet hanya dalam aplikasi |
| 19–20 Skema/Rules/biaya | Selesai (kode) | `docs/skema-database.md`; biaya di README |
| 21 Google Auth + Pages | Selesai (kode) | Perlu konfigurasi manual (README) |
| 23 Pengujian | Sebagian | Unit test + test Rules/Storage/RTDB **ditulis**, belum dijalankan; belum ada test Functions (emulator), komponen, routing, login/logout |
| 24 Kualitas kode | Selesai (kode) | TypeScript strict, ESLint; `any` dilarang |
| 26 Kriteria selesai | **Belum terpenuhi** | Build/lint/test/emulator belum dijalankan; proyek belum boleh dinyatakan selesai |

## Halaman (34 halaman spesifikasi)
| # | Halaman | Status |
|---|---|---|
| 1 | Splash | Selesai (kode) |
| 2 | Onboarding | Selesai (kode) |
| 3 | Login | Selesai (kode) |
| 4 | Pembuatan username | Selesai (kode) |
| 5 | Home | Selesai (kode) |
| 6 | Pet dashboard | Selesai (kode) |
| 7 | Pet collection | **Belum** (hanya 1 Pet per akun; jenis dipilih saat adopsi) |
| 8 | Strike & streak | Selesai (kode) |
| 9–10 | Daftar teman, cari @username | Selesai (kode; satu halaman Teman) |
| 11 | Profil | Selesai (kode); ganti username & unggah foto belum |
| 12 | Invite center | Sebagian (permintaan di Teman, undangan di Grup, ringkasan di Notifikasi) |
| 13–14 | Dynamic Duo, Squad | Selesai (kode; satu halaman Grup) |
| 15–16 | Live Location, peta & detail sesi | Selesai (kode) |
| 17–19 | Daftar chat, chat pribadi, chat grup | Selesai (kode) |
| 20 | Media viewer | Selesai (kode) |
| 21–22 | Story feed, Story viewer | Selesai (kode) |
| 23 | Media lokal | Selesai (kode) |
| 24 | Notifikasi | Selesai (kode) |
| 25–28 | Tema, privasi, lokasi, penyimpanan | Selesai (kode) |
| 29 | Akun | Selesai (kode) |
| 30–32 | Bantuan, Kebijakan Privasi, Syarat | Selesai (kode; templat hukum perlu ditinjau pemilik) |
| 33 | Offline fallback | Selesai (kode) |
| 34 | Error | Selesai (kode: ErrorBoundary, error akun, 404) |

## Daftar celah yang diketahui
1. Pet collection dan Pet tambahan lewat progres. 2. Ganti username; foto profil/grup kustom. 3. Peran grup selain pemilik/anggota; moderasi pemilik grup atas pesan. 4. App Check dan moderasi laporan. 5. E2EE. 6. Background Sync / lokasi andal di latar belakang. 7. Retensi otomatis pesan lama. 8. Test Functions/komponen/routing. 9. Pengingat Pet/streak lewat push. 10. Cakupan "akun dinonaktifkan" selain pesan error login.
