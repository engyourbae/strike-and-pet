# STRIKE & PET — Status implementasi (ringkasan akhir)

Terakhir diperbarui: 1 Nov 2026

| Fase | Isi | Status |
|---|---|---|
| 1 | Audit & arsitektur | Selesai (`docs/arsitektur.md`) |
| 2 | Struktur proyek & design system | Selesai (kode) |
| 3 | Auth, profil, username | Selesai (kode) |
| 4 | Teman, undangan, Duo, Squad | Selesai (kode) |
| 5 | Pet, XP, streak, achievement | Selesai (kode) |
| 6 | Chat & notifikasi dalam aplikasi | Selesai (kode) |
| 7 | Media, Story, IndexedDB | Selesai (kode) |
| 8 | Live Location & kecepatan | Selesai (kode) |
| 9 | PWA/offline, instal, pembaruan, push | Selesai (kode) |
| 10 | Rules, Functions, retensi, akun (ekspor/hapus) | Selesai (kode) |
| 11 | Pengujian | Sebagian: unit test + test Rules ditulis; belum dijalankan |
| 12 | Dokumentasi & deployment | Selesai (README, docs/, workflow CI & deploy) |

**Belum diverifikasi (belum pernah dijalankan):** `npm install`, lint, build, seluruh test, Firebase Emulator, Cloud Functions, UI di browser/perangkat. **Diverifikasi:** logika murni `src/shared` dan logika murni chat/sosial/username (typecheck strict + pemeriksaan Node), konsistensi import/ekspor, sintaks Rules/JSON. Kriteria selesai (spesifikasi bagian 26) **belum terpenuhi**; ikuti checklist di README bagian 9. Celah yang diketahui: `docs/laporan-fitur.md`.

---

Terakhir diperbarui: 31 Okt 2026

## Fase 1–3 (kode ditulis, BELUM dibangun/diuji)
Kode ditulis di lingkungan tanpa akses internet, jadi `npm install`, `npm run build`, lint, dan test **belum pernah dijalankan**. Kemungkinan ada error kecil saat pertama build; jalankan perintah di README dan laporkan hasilnya.

Sudah ditulis:
- Konfigurasi: Vite (base path GitHub Pages), TypeScript strict, ESLint, workflow GitHub Actions, `.env.example`, `.gitignore`.
- Design system: token terang (default) dan gelap, pilihan "ikuti sistem", skeleton shimmer, `prefers-reduced-motion`.
- Aset: logo, favicon, ikon PWA (PNG dibuat dengan `scripts/generate-icons.py`), 3 ilustrasi onboarding, `assets-manifest.csv`.
- Auth: login Google (popup, cadangan redirect), logout, pemulihan sesi, splash, onboarding.
- Username: klaim atomik lewat transaksi + Security Rules (`getAfter`).
- Profil: lihat/ubah nama tampilan dan bio.
- PWA: manifest, service worker (precache aset statis saja), banner offline, banner update.
- Rules: `firestore.rules` (users, usernames), `database.rules.json` dan `storage.rules` ditolak semua dulu.
- Test unit: validasi username dan resolusi tema.

## Fase 4 (kode ditulis, BELUM dibangun/diuji)
- Cari @username, profil publik singkat, kirim/terima/tolak/batalkan permintaan, hapus teman.
- Blokir/buka blokir dan laporan pengguna.
- Dynamic Duo (2 orang) dan Squad (hingga 8) dengan undangan langsung lewat @username, persetujuan penerima, ganti nama, keluar, keluarkan anggota, hapus grup.
- Lencana notifikasi realtime untuk permintaan dan undangan masuk di navigasi.
- Rules di `firestore.rules` diperluas; test unit logika di `tests/social.test.ts`.

Keterbatasan Fase 4:
- Foto profil grup dan peran selain pemilik/anggota belum ada (butuh Storage, Fase 7/10).
- Pengiriman undangan saat membuat grup dilakukan satu per satu (batas rules 20 akses per batch); jika sebagian gagal, kirim ulang dari halaman grup.
- Memblokir teman tidak otomatis mengeluarkan dari grup bersama; aturan akses chat/lokasi akan memeriksa blokir di fase berikutnya.
- Operasi pertemanan/undangan divalidasi Security Rules (bukan Cloud Functions); Rules belum diuji dengan emulator.

## Fase 5 (kode ditulis; sebagian logika diverifikasi)
Diverifikasi di sini (tanpa npm): logika murni di `src/shared/` lolos typecheck TypeScript strict dan 17 kelompok pemeriksaan (zona waktu, streak, hari istirahat, streak grup idempoten, batas XP harian, level, achievement) dijalankan lewat Node. Yang BELUM diverifikasi: seluruh UI React, Cloud Functions (`functions/src/index.ts`), Firebase Rules, dan `npm run build`.

Sudah ditulis:
- Pet: adopsi (Mochi/Bolt/Luna), nama bisa diganti, level + XP, tiga perawatan (makan, main, bersihkan) dengan jeda, statistik turun seiring waktu, animasi (santai, senang, lapar, tidur, bermain/makan/bersih), halaman `/pet`.
- Strike: strike harian, streak pribadi, hari istirahat otomatis (diperoleh tiap 7 hari, maks 2), kalender aktivitas, streak grup Duo/Squad (semua anggota harus strike di hari grup yang sama), achievement, halaman `/strike`.
- Validasi di server: Cloud Functions `adoptPet`, `performPetAction`, `dailyStrike`. Rules melarang klien menulis XP/streak/achievement (hanya mengubah nama Pet).
- Nama Pet diganti langsung lewat Firestore (Rules membatasi field `name`).

Keterbatasan Fase 5:
- Cloud Functions membutuhkan paket Blaze dan harus di-deploy (lihat README). Tanpa itu, Pet dan Strike tidak bisa dipakai.
- Hanya 1 Pet per pengguna; halaman "Pet collection" dan jenis Pet yang terbuka lewat progres belum ada.
- Pengingat/notifikasi streak belum ada (Fase 6). Opsi "istirahat" saat ini otomatis (tidak ada tombol manual).
- Hadiah XP grup diberikan setelah transaksi selesai; bila gagal di tengah jalan, XP bonus hari itu bisa terlewat (tidak pernah ganda).
- Belum ada App Check; cooldown dan batas XP harian menjadi pembatas penyalahgunaan utama.
- Pet milik anggota lain belum bisa dilihat (Rules hanya mengizinkan pemilik).

## Fase 6 (kode ditulis; hanya logika murni diverifikasi)
Diverifikasi di sini: `src/features/chat/logic.ts` (typecheck strict + pemeriksaan Node). BELUM diverifikasi: UI, Rules chat, RTDB rules, build.

Sudah ditulis:
- Chat pribadi (antar teman) dan chat grup (Duo/Squad): teks, emoji (papan emoji cepat + emoji bawaan keyboard), balas, edit (dalam 15 menit, ada penanda "diedit"), hapus (tanda "Pesan dihapus"), reaksi (6 emoji), timestamp + pemisah hari, pagination (30 pesan terbaru realtime + "Muat pesan lebih lama"), pencarian di pesan yang sudah dimuat.
- Status pesan: Mengirim… / Terkirim; "Dibaca" hanya di chat pribadi dan hanya bila lawan bicara mengaktifkan tanda dibaca.
- Offline: tulisan masuk antrean lokal Firestore dan terkirim saat online (id dibuat klien → aman dikirim ulang); pesan yang ditolak server tampil dengan tombol Kirim ulang/Buang.
- Indikator mengetik dan status online/terakhir aktif lewat Realtime Database (opsional, perlu VITE_FIREBASE_DATABASE_URL; status online MATI secara default dan hanya dipublikasikan bila diaktifkan).
- Mute per percakapan, lapor pesan, blokir (memutus pertemanan sehingga chat hilang dari daftar dan tidak bisa mengirim).
- Notifikasi dalam aplikasi (halaman Notifikasi + lencana): permintaan teman, undangan grup, pesan belum dibaca, pengingat streak, perawatan Pet. Pengingat dan pesan bisa dimatikan di Privasi & notifikasi.
- Pengaturan privasi: tanda dibaca, status online, notifikasi pesan, pengingat.

Kebijakan akses chat: peserta chat pribadi tetap bisa membaca riwayat tetapi tidak bisa mengirim bila tidak lagi berteman/diblokir (chat disembunyikan dari daftar). Anggota yang keluar dari grup kehilangan akses ke seluruh chat grup (baru dan lama). Penghapusan pesan hanya oleh pengirim; pemilik grup belum bisa menghapus pesan orang lain.

Keterbatasan Fase 6:
- Pesan TIDAK dienkripsi end-to-end: dilindungi enkripsi transport dan Security Rules, tetapi pemilik proyek Firebase secara teknis dapat membaca data di Firestore.
- Push notification (FCM) belum ada; notifikasi hanya tampil saat aplikasi terbuka.
- Status "diterima" (delivered) tidak tersedia karena tidak bisa dipastikan; hanya Terkirim dan Dibaca.
- Pencarian hanya pada pesan yang sudah dimuat (Firestore tidak punya pencarian teks penuh).
- Data mengetik/online di Realtime Database dapat dibaca pengguna login mana pun yang mengetahui id-nya (RTDB Rules tidak bisa memeriksa pertemanan); karena itu status online hanya dipublikasikan bila pengguna mengaktifkannya.
- Daftar chat membuka satu listener per percakapan; cocok untuk puluhan percakapan, bukan ribuan.
- Laporan hanya tersimpan di koleksi `reports` (ditinjau lewat Console); belum ada alat moderasi.
- Tidak ada penghapusan otomatis pesan lama (kebijakan retensi menyusul).

## Fase 7 (kode ditulis; hanya logika murni diverifikasi)
Diverifikasi di sini: `src/shared/mediaLogic.ts` (typecheck strict + 25 pemeriksaan Node: pengenalan format dari byte awal, batas ukuran/durasi, skala gambar). BELUM diverifikasi: seluruh UI, Dexie/IndexedDB (`tests/mediaStore.test.ts` butuh `npm install` untuk `fake-indexeddb`), Cloud Functions media, Storage/Firestore Rules, dan build. Tidak ada test Functions/Rules dengan emulator.

Alur media (sesuai spesifikasi bagian 14):
1. Klien memvalidasi isi berkas (byte awal, bukan MIME/ekstensi), mengompres foto (maks 1600 px, JPEG; metadata EXIF/lokasi ikut terhapus), memeriksa durasi video (maks 30 dtk) dan ukuran (foto 10 MB, video 25 MB), lalu membuat thumbnail.
2. Salinan "terkirim" disimpan di IndexedDB dan pekerjaan masuk antrean (`outbox`) yang bertahan setelah aplikasi ditutup.
3. Klien membuat `mediaMetadata` (status `uploading`) lalu mengunggah ke Storage privat `media/{id}` (progress ditampilkan).
4. Cloud Function `onMediaUploaded` memvalidasi ulang isi berkas, ukuran, dan menentukan penerima yang berhak (chat: lawan bicara/anggota grup; Story: teman; pihak yang saling blokir dikeluarkan). Hanya setelah itu status `available`.
5. Chat: klien mengirim pesan yang merujuk `mediaId` (Rules memastikan media milik pengirim dan sudah `available`). Story: langsung tampil di feed teman selama 24 jam.
6. Penerima mengunduh lewat akses terautentikasi (Storage Rules), memverifikasi ukuran + isi, menyimpan ke IndexedDB, MEMBACA ULANG untuk memastikan tertulis, baru memanggil `acknowledgeMedia`. Bila penyimpanan penuh/gagal, tidak ada acknowledgment (server tetap menyimpan sampai kedaluwarsa).
7. `acknowledgeMedia` idempoten; berkas server dihapus hanya setelah SEMUA penerima yang berhak mengonfirmasi. `cleanupMedia` (tiap jam) menghapus media kedaluwarsa (chat 7 hari, Story 24 jam), unggahan macet, dan berkas yatim. Status + alasan + waktu tersimpan sebagai jejak audit.
8. Metadata/UI tidak menyiratkan media masih bisa diunduh: status `deleted/expired/rejected` ditampilkan sebagai "tidak tersedia di server"; salinan lokal tidak pernah dihapus otomatis.

Halaman baru: Story (feed + penampil dengan reaksi emoji yang dikirim ke chat), penampil media (simpan ke perangkat, hapus lokal, hapus dari server), Media lokal, Penyimpanan (estimasi `navigator.storage.estimate()`, minta penyimpanan persisten, bersihkan cache aplikasi tanpa menyentuh media, hapus semua media lokal).

Keterbatasan Fase 7:
- Media TIDAK dienkripsi end-to-end: selama tersimpan sementara di Firebase Storage, pemilik proyek bisa mengaksesnya. Salinan lokal di IndexedDB juga tidak dienkripsi.
- Server tidak bisa memeriksa isi IndexedDB penerima; acknowledgment adalah pernyataan penerima. Acknowledgment palsu hanya merugikan penerima itu sendiri.
- Daftar penerima dikunci saat validasi: anggota yang keluar dari grup sebelum kedaluwarsa masih bisa mengunduh media yang sudah diperuntukkan baginya; anggota baru tidak mendapat media lama.
- Video tidak diubah/dikompres (hanya divalidasi); dukungan format bergantung browser. Metadata video tidak dihapus. Foto HEIC hanya jalan bila browser bisa mendekodenya.
- Durasi video yang dinyatakan klien dicek di Rules, tetapi server hanya memverifikasi isi, ukuran, dan tipe (tidak mem-parse durasi).
- Tidak ada Background Sync: antrean berjalan saat aplikasi terbuka dan online; yang tertunda dilanjutkan saat aplikasi dibuka lagi.
- Story: audiens = teman saat diposting; "dilihat" = penonton sudah menyimpan salinan; hapus Story menyembunyikannya dan menghapus berkas server (salinan lokal penonton tetap ada).
- Foto profil grup belum ada.
- Butuh Blaze: Storage, Functions (trigger Storage + Scheduler). Biaya egress dan penyimpanan perlu dipantau.

## Fase 8 (kode ditulis; hanya logika murni diverifikasi)
Diverifikasi di sini: `src/shared/locationLogic.ts` (typecheck strict + pemeriksaan Node: jarak geodesik, filter kecepatan, derau GPS, lompatan GPS, interval adaptif, status sesi). BELUM diverifikasi: UI, peta Leaflet, Cloud Functions lokasi, Firestore/RTDB Rules, dan build. Tidak ada test dengan emulator (izin lokasi, pencabutan izin saat sesi, akses orang asing).

Sudah ditulis:
- Mulai berbagi hanya atas tindakan pengguna lewat dialog persetujuan: pilih grup (Duo/Squad), pilih siapa yang melihat, durasi (15 mnt–8 jam), riwayat rute (opsional, mati secara default), peringatan mengemudi. Tidak ada aktivasi otomatis setelah login atau setelah aplikasi dibuka ulang (sesi yang masih aktif harus "Dilanjutkan" secara manual).
- Sesi dibuat/diakhiri oleh Cloud Functions (`startLocationSession`, `stopLocationSession`) yang memvalidasi keanggotaan grup, penerima, blokir, dan durasi. Hak baca koordinat di Realtime Database diturunkan dari daftar penerima yang hanya bisa ditulis server dan berlaku selama sesi aktif dan belum kedaluwarsa (dipaksa Rules, termasuk jeda minimal 2 detik antar tulisan).
- Pengirim: Geolocation API (`watchPosition`), pengiriman adaptif (lebih jarang saat diam, penanda hidup tiap menit), indikator "sedang berbagi" di semua halaman + tombol Hentikan, Wake Lock bila tersedia, penanganan izin ditolak/dicabut (sesi berhenti otomatis), GPS tidak tersedia, timeout, koneksi terputus (status offline otomatis via `onDisconnect`), kedaluwarsa otomatis.
- Penerima: peta OpenStreetMap (Leaflet) dengan avatar, lingkaran akurasi, status (aktif / berhenti / tidak tersedia / kedaluwarsa / menunggu), waktu pembaruan, dan label jelas "bukan real-time" untuk lokasi terakhir saat pengirim offline. Peta gagal dimuat ditangani; koordinat tetap tampil sebagai teks.
- Kecepatan: `coords.speed` bila valid; bila tidak ada, estimasi dari jarak geodesik dan selang waktu dengan filter derau dan batas kewajaran; ditandai "estimasi" dan "kurang dapat dipercaya". Data tidak valid ditampilkan "—", bukan angka. Maksimum dan rata-rata (dari bacaan valid) dihitung di perangkat pengirim.
- Riwayat opt-in: titik rute disimpan tiap 1 menit hanya untuk pemilik; Functions menghapus metadata sesi tanpa riwayat setelah 24 jam dan riwayat rute setelah 7 hari; pengguna bisa menghapus kapan saja.
- Halaman: Live Location, detail sesi + peta, Pengaturan lokasi (status izin, batasan, kendali), notifikasi "teman berbagi lokasi" (satu per sesi, bisa dimatikan).

Keterbatasan Fase 8:
- PWA di browser TIDAK menjamin pengiriman di latar belakang: tab non-aktif, browser ditutup, atau mode hemat baterai dapat menghentikan pembaruan (iOS Safari paling ketat). Penerima akan melihat status "tidak tersedia".
- Daftar penerima dikunci saat sesi dimulai. Anggota yang keluar dari grup selama sesi tetap bisa melihat sampai sesi berakhir (maks 8 jam).
- Penentuan "tidak tersedia" membandingkan jam perangkat penerima dengan timestamp server; selisih jam yang besar dapat membuat status keliru.
- Lokasi tidak dienkripsi end-to-end; data aktif ada di Realtime Database dan dapat diakses pemilik proyek Firebase selama sesi. Fungsi tidak mencatat koordinat ke log.
- Server OpenStreetMap publik punya kebijakan penggunaan (https://operations.osmfoundation.org/policies/tiles/); untuk pemakaian besar gunakan penyedia ubin sendiri.
- Hanya satu sesi aktif per pengguna (sesi lama dihentikan otomatis). Belum ada geofence/ETA/riwayat lintas sesi.
- Biaya: RTDB (tulis tiap ≥5 dtk saat bergerak), Firestore (≈1 titik/menit bila riwayat aktif), Functions terjadwal tiap 30 menit.
- Butuh Realtime Database dan Cloud Functions aktif (Blaze).

## Belum dikerjakan
- Test Security Rules dengan Firebase Emulator (butuh `@firebase/rules-unit-testing`; Fase 11).
- Ganti username, hapus akun, ekspor data, upload foto profil, pengaturan privasi.
- Halaman: bantuan, kebijakan privasi, syarat, offline fallback khusus, halaman kebijakan.
- Fase 9–12: PWA offline lanjutan (halaman offline fallback, pembaruan aman), push notification, penghapusan akun/ekspor data, halaman bantuan/kebijakan/syarat, test Rules + Functions dengan emulator, dokumentasi akhir.

## Batasan diketahui
- Router memakai HashRouter (URL berbentuk `/#/profil`) supaya refresh tidak 404 di GitHub Pages.
- Bila dokumen `users/{uid}` belum ada di cache saat offline, pengguna bisa sementara diarahkan ke halaman username; Firestore akan memperbaikinya saat online.
