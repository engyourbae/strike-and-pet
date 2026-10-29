# Arsitektur

```
Browser (PWA, GitHub Pages)
 ├─ React + TS + Vite, HashRouter, service worker (precache aset statis + push-sw.js)
 ├─ IndexedDB (Dexie): media lokal + antrean unggah     ← data pengguna, bukan cache publik
 ├─ Firestore (cache persisten multi-tab)               ← profil, sosial, chat, metadata
 ├─ Realtime Database                                   ← lokasi aktif, mengetik, online
 ├─ Storage (privat, sementara)                         ← media menunggu penerima
 └─ Cloud Functions (callable/trigger/terjadwal)        ← operasi tepercaya
```

## Prinsip
- **Klien tidak dipercaya**: XP/streak/achievement, validasi media, penentuan penerima, pembuatan sesi lokasi, ekspor/hapus akun, dan penghapusan file server dilakukan Cloud Functions; Rules melarang klien menulisnya.
- **Akses diturunkan dari data**: chat pribadi = pasangan teman terurut (`uidA_uidB`); chat grup = anggota grup saat ini; media = daftar `recipients` yang diisi server; lokasi = `viewers` di RTDB yang diisi server.
- **Idempoten**: id media = id pesan; acknowledgment/penghapusan/pembersihan aman diulang.
- **Offline-first seperlunya**: cache Firestore persisten, antrean IndexedDB, pesan tertunda lewat antrean tulis Firestore.

## Logika bersama
`src/shared/*.ts` murni (tanpa dependensi) dipakai klien dan Functions; disalin ke `functions/src/shared` oleh `npm run sync:functions` dan dijaga identik oleh test.

## Alur media
klien validasi+kompres → IndexedDB (terkirim) + outbox → `mediaMetadata`(uploading) → Storage `media/{id}` → `onMediaUploaded` (sniff isi, ukuran, penerima) → `available` → pesan merujuk `mediaId` → penerima unduh → simpan IndexedDB + baca ulang → `acknowledgeMedia` → semua penerima ack → hapus file → status `deleted`; kedaluwarsa/yatim dibersihkan `cleanupMedia`.

## Alur lokasi
Mulai (dialog persetujuan) → `startLocationSession` (validasi grup/blokir/durasi; tulis `locationSessions` + RTDB `meta`) → `watchPosition` → `pos` di RTDB (adaptif, jeda ≥2 dtk) → penerima membaca selama sesi aktif → henti/kedaluwarsa: `pos` dihapus, retensi 24 jam/7 hari.
