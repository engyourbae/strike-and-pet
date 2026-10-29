# STRIKE & PET

Aplikasi sosial privat untuk pasangan dan teman dekat (PWA): Pet virtual dan streak bersama, Dynamic Duo/Squad, chat real-time, foto/video/Story, dan berbagi lokasi berbasis persetujuan. Frontend React + TypeScript + Vite di GitHub Pages; backend Firebase.

> ## Versi paket gratis (Firebase Spark)
> Proyek ini sudah disesuaikan agar berjalan di **paket Spark (gratis, tanpa kartu kredit)**. Cloud Functions dan Cloud Storage keduanya wajib Blaze, jadi: logika Pet/Strike/akun/lokasi kini dijalankan di perangkat (transaksi Firestore) dan dibatasi Security Rules; media dititipkan sementara sebagai potongan di Firestore; pembersihan terjadwal diganti pembersihan oleh pemilik saat aplikasi dibuka. Satu hal **tidak bisa** gratis: push notification saat aplikasi/browser ditutup total (butuh server). Gantinya, notifikasi sistem muncul selama aplikasi masih berjalan di latar belakang. Lihat bagian 8 dan 10.
>
> ## Status verifikasi (baca dulu)
> Kode ditulis di lingkungan **tanpa akses internet**, sehingga `npm install`, `npm run build`, lint, test, dan Firebase Emulator **belum pernah dijalankan** (termasuk perubahan ke paket Spark). Yang sudah diperiksa: logika murni di `src/shared/` (typecheck strict + pemeriksaan Node), konsistensi seluruh import/ekspor antar-file, dan keseimbangan sintaks Security Rules. Sangat mungkin ada error kecil saat build pertama. Proyek **belum boleh dianggap selesai** sebelum langkah di bagian 9 (checklist verifikasi) lolos. Detail per fitur: `docs/laporan-fitur.md`.

## 1. Ringkasan fitur
| Area | Isi |
|---|---|
| Akun | Login Google, username unik `@username` (transaksi + Rules), profil, onboarding |
| Sosial | Cari @username, permintaan teman, blokir, laporan, Dynamic Duo & Squad via undangan (tanpa kode) |
| Pet & Strike | Pet (3 jenis), XP/level, perawatan, streak pribadi + grup, hari istirahat, kalender, achievement (dihitung di perangkat, dibatasi Rules) |
| Chat | Pribadi + grup, balas, edit 15 menit, hapus, reaksi, pagination, pencarian lokal, mute, lapor, mengetik/online (opsional) |
| Media | Foto/video pendek/Story, kompresi, validasi isi berkas, potongan sementara di Firestore → unduh → simpan IndexedDB → acknowledgment → potongan dihapus |
| Lokasi | Sesi berbagi atas izin, durasi, penerima terpilih, peta OpenStreetMap, kecepatan (GPS/estimasi), riwayat opsional, retensi |
| PWA | Instal, offline, pembaruan aman, notifikasi sistem (tanpa FCM), antrean unggah, tema terang/gelap |
| Data | Ekspor data, hapus akun, halaman bantuan/kebijakan/syarat |

Arsitektur: `docs/arsitektur.md` · Keamanan: `docs/keamanan.md` · PWA/offline: `docs/pwa-offline.md` · Skema data: `docs/skema-database.md` · Laporan fitur: `docs/laporan-fitur.md`.

## 2. Prasyarat
Node.js 20+, akun Google, akun GitHub, Java 17 (hanya untuk emulator/test Rules), Python 3 + Pillow (opsional, hanya untuk membuat ulang ikon: `npm run icons`).

## 3. Buat proyek Firebase dari nol
1. https://console.firebase.google.com → **Add project**.
2. **Biarkan di paket Spark (gratis).** Jangan upgrade ke Blaze, dan jangan membuat Storage atau Functions.
3. **Firestore Database → Create database** (production mode, pilih lokasi, mis. `nam5`/`us-central`).
4. **Realtime Database → Create database** (production). Salin URL-nya.
6. **Authentication → Sign-in method → Google → Enable**; isi email dukungan.
7. **Authentication → Settings → Authorized domains** → tambahkan `NAMA-AKUN.github.io`.
8. **Project settings → Your apps → Web (`</>`)** → daftarkan app, salin konfigurasi.
9. (Opsional, disarankan) **Firestore → Time-to-live**: tambah kebijakan pada collection group `parts`, field `expireAt`, agar sisa potongan media terhapus otomatis walau pengirim tidak membuka aplikasi lagi.

## 4. Konfigurasi lokal
```bash
cp .env.example .env.local     # isi VITE_FIREBASE_* (publik), VITE_FIREBASE_DATABASE_URL
npm install
npm run dev
```
Variabel penting (lihat `.env.example`): `VITE_FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/APP_ID`, `VITE_FIREBASE_DATABASE_URL` (wajib untuk lokasi/mengetik/online), `VITE_BASE` (diisi otomatis oleh workflow), `VITE_SUPPORT_EMAIL` dan `VITE_OPERATOR_NAME` (opsional, tampil di Bantuan/Kebijakan). Nilai `VITE_FIREBASE_*` bersifat publik; keamanan ada di Security Rules. **Jangan** menaruh service account atau kunci rahasia di repository.

## 5. Deploy backend Firebase (hanya Rules dan indeks)
```bash
npm i -g firebase-tools && firebase login
firebase use --add                              # pilih proyekmu
firebase deploy --only firestore:rules,firestore:indexes,database
# tunggu semua indeks Firestore berstatus Enabled (Console → Firestore → Indexes)
```
- Tidak ada Cloud Functions/Storage yang perlu di-deploy. Semua logika server lama sudah pindah ke klien (`*.service.ts`) dan Rules.
- Rules Firestore memakai pembacaan lintas dokumen (`get`/`getAfter`/`exists`); penggunaan pembacaan ini ikut dihitung ke kuota baca.

## 6. Deploy frontend ke GitHub Pages
1. Push ke branch `main` di repository GitHub.
2. **Settings → Pages → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables**: tambahkan `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_URL`, serta opsional `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `VITE_SUPPORT_EMAIL`, `VITE_OPERATOR_NAME`.
4. Push → workflow **Deploy ke GitHub Pages** menjalankan lint, test, build, lalu menerbitkan. `VITE_BASE` otomatis `/<nama-repo>/`.
5. Jalankan `npm install` sekali, commit `package-lock.json` agar CI memakai `npm ci`.
- Routing memakai hash (`/#/profil`) sehingga refresh/tautan langsung tidak 404 di GitHub Pages. Domain root dan subpath repo sama-sama didukung lewat `VITE_BASE`.
- Domain development (`localhost`) sudah diizinkan Firebase; domain produksi harus ditambahkan di Authorized domains (langkah 3.7).
- `.github/workflows/ci.yml` menjalankan web dan test Rules pada PR.

## 7. Menjalankan test
```bash
npm test                         # unit test logika murni + IndexedDB (fake-indexeddb)
npm run lint
npm run build                    # tsc + vite build
npm run test:rules               # Security Rules (Firestore, RTDB) lewat Firebase Emulator; butuh Java 17
npm run emulators                # emulator manual (set VITE_USE_EMULATORS=true)
```
Test Rules memakai pengguna biasa (bukan admin) untuk skenario: pengguna A membaca data privat B, orang asing mengakses lokasi, anggota yang keluar dari grup membaca chat lama, balapan username, edit di luar jendela 15 menit, reaksi tidak sah, media palsu, acknowledgment palsu, batas XP/streak/tanggal, pembuatan sesi lokasi, dan RTDB. **Belum ada** test klien terhadap emulator dan test komponen/routing (lihat laporan fitur).

## 8. Kuota paket gratis (Spark) dan cara menghematnya
Spark tidak menagih, tetapi **menolak** operasi bila kuota habis (aplikasi menampilkan pesan "Kuota harian … habis"; kuota harian direset setiap hari). Batas utama (cek angka terbaru di https://firebase.google.com/pricing):
- **Firestore**: 50 ribu baca, 20 ribu tulis, 20 ribu hapus per hari; 1 GiB data; sekitar 10 GiB keluar per bulan. Tiap pesan = 2 tulis; tiap dokumen pada hasil query/listener = 1 baca; tiap `get()` di Rules = 1 baca. Media memakai tulis/baca per potongan 700 KiB: video 25 MB ≈ 37 tulis + 37 baca per penerima (foto setelah kompresi biasanya 1–2 potongan).
- **Realtime Database**: 100 koneksi bersamaan, 1 GB data, 10 GB unduh per bulan (lokasi, mengetik, online). Lebih dari 100 pengguna online bersamaan akan ditolak.
- **Auth**: Google login gratis. **Hosting**: tidak dipakai (GitHub Pages).
- Untuk grup kecil (puluhan pengguna) paket ini umumnya cukup. Bila sering kehabisan kuota, kurangi pemakaian video atau pertimbangkan upgrade ke Blaze (lalu Functions/Storage bisa dipakai kembali, tetapi kode ini tidak lagi memakainya).

## 9. Checklist verifikasi sebelum dipakai (urut)
1. `npm install` → `npm run lint` → `npm test` → `npm run build`; perbaiki error yang muncul.
2. `npm run test:rules` (emulator); perbaiki Rules/test bila ada yang gagal.
3. Deploy Rules/indeks (bagian 5), tunggu indeks selesai.
4. Uji manual dengan **dua akun Google di dua perangkat**: login → username → saling berteman → Duo → chat → kirim foto → terima dan buka offline → Strike/Pet → Live Location (mulai/henti/izin dicabut) → Story → ekspor/hapus akun.
5. Instal PWA di Android dan iOS (iOS: Tambah ke Layar Utama), uji offline dan notifikasi.
6. Isi `VITE_OPERATOR_NAME`/`VITE_SUPPORT_EMAIL`, tinjau Kebijakan Privasi/Syarat (idealnya bersama penasihat hukum).

## 10. Keterbatasan platform dan hal yang tidak otomatis
- PWA di browser **tidak** menjamin berbagi lokasi di latar belakang (tab non-aktif, browser ditutup, hemat baterai, iOS Safari). Antrean unggah dan sinkronisasi berjalan saat aplikasi terbuka; tidak ada Background Sync.
- Pesan, media, dan lokasi **tidak** dienkripsi end-to-end (hanya enkripsi transport + Rules); pemilik proyek Firebase dapat mengakses data tersimpan. Salinan media lokal (IndexedDB) tidak dienkripsi dan bisa hilang bila data browser dihapus; minta penyimpanan persisten dan gunakan "Simpan ke perangkat".
- Notifikasi sistem di iOS butuh iOS 16.4+ dan PWA terpasang. Tanpa server, notifikasi TIDAK muncul bila aplikasi/browser ditutup total.
- **Tanpa Cloud Functions, angka Pet/streak/XP dihitung di perangkat.** Rules membatasi lompatan (tanggal ±1 hari UTC, XP harian, jeda aksi, XP strike harus disertai kenaikan streak, bonus grup harus cocok dengan streak grup), tetapi pengguna yang sengaja mengutak-atik data miliknya sendiri bisa menyiasati batas itu. Bonus XP grup diklaim masing-masing anggota saat membuka aplikasi.
- Pembersihan (media kedaluwarsa, sesi lokasi, retensi) dijalankan pemilik saat aplikasi dibuka, bukan terjadwal; pasang kebijakan TTL (langkah 3.9) agar potongan media tetap terhapus.
- Penerima media dipilih pengirim dan hanya dibatasi Rules untuk chat; blokir diperiksa saat unduh. Hapus akun tidak menghapus blokir yang dibuat orang lain terhadapmu.
- Server ubin publik OpenStreetMap punya kebijakan penggunaan; untuk trafik besar gunakan penyedia ubin sendiri.
- Tanpa App Check; pembatas penyalahgunaan utama: Rules, jeda aksi, dan batas XP/frekuensi.
- Konfigurasi manual yang tidak bisa dilakukan otomatis: membuat proyek Firebase, Authorized domains, kebijakan TTL, variabel GitHub Actions, dan peninjauan dokumen hukum.

## 11. Struktur proyek
`src/app` (provider, router) · `src/components` · `src/features/{auth,profile,friends,groups,social,pet,streak,chat,media,location,notifications,settings,push,legal}` · `src/lib/{firebase,local}` · `src/shared` (logika murni klien+server) · `src/hooks` · `src/types` · `src/utils` · `src/styles` · `tests` (unit) · `tests-rules` (emulator) · `scripts` · `docs` · `public/assets`.
