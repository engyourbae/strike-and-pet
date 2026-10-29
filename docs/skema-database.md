# Skema database (Fase 1–3)

## `usernames/{username}`
- **Tujuan**: kunci keunikan @username. ID dokumen = username huruf kecil.
- **Field**: `uid: string`, `createdAt: timestamp (server)`.
- **Akses**: `get` oleh pengguna login; `list` ditolak; `create` hanya bila `users/{uid}` dalam transaksi yang sama berisi username yang sama; `update/delete` ditolak.
- **Validasi**: regex `^[a-z][a-z0-9_]{2,19}$` (sama dengan `src/features/profile/username.ts`).

## `users/{uid}`
- **Tujuan**: profil publik. Tidak berisi email atau data privat.
- **Field**: `uid`, `username`, `displayName (1–50)`, `photoURL (string|null, ≤500)`, `bio (≤160)`, `createdAt`, `updatedAt`.
- **Akses**: baca oleh pengguna login; `create` oleh pemilik bersama klaim username (`getAfter`); `update` hanya `displayName`, `bio`, `updatedAt`; `delete` ditolak (akan lewat Cloud Function).
- **Catatan**: pembuatan memakai `runTransaction` agar klaim username atomik.

# Tambahan Fase 4

Semua koleksi di bawah hanya bisa diakses pengguna terkait; indeks komposit tidak diperlukan (query memakai filter kesetaraan atau satu `array-contains`).

## `friendRequests/{fromUid}_{toUid}`
- **Field**: `fromUid`, `toUid`, `fromUsername`, `status (pending|accepted|declined)`, `createdAt`, `updatedAt`.
- **Akses**: baca oleh pengirim/penerima. Buat oleh pengirim (ditolak bila diblokir salah satu pihak atau sudah berteman). Penerima hanya boleh mengubah `status`. Pengirim boleh menghapus kapan saja; penerima hanya setelah tidak `pending`.

## `friendships/{uidA}_{uidB}` (uid terurut)
- **Field**: `members: [uid, uid]`, `createdAt`. Dibuat penerima dalam batch yang sama dengan penerimaan permintaan (dicek `getAfter`). Bisa dihapus kedua anggota.

## `blocks/{blockerUid}_{blockedUid}`
- **Field**: `blockerUid`, `blockedUid`, `blockedUsername`, `createdAt`. Hanya pemblokir yang bisa membaca. Pemblokiran menghapus pertemanan dan permintaan terkait.

## `reports/{id}`
- **Field**: `reporterUid`, `reportedUid`, `reason (spam|pelecehan|akun_palsu|lainnya)`, `createdAt`. Klien hanya bisa membuat; tidak bisa membaca.

## `groups/{id}`
- **Field**: `type (duo|squad)`, `name (1–40)`, `ownerUid`, `memberUids[]`, `maxMembers (duo=2, squad 3–8)`, `createdAt`, `updatedAt`.
- **Akses**: baca oleh anggota. Pemilik: ganti nama, keluarkan anggota, hapus grup. Anggota: keluar sendiri. Bergabung hanya lewat undangan yang diterima pada operasi yang sama.

## `invitations/{groupId}_{toUid}`
- **Field**: `groupId`, `groupName`, `groupType`, `fromUid`, `fromUsername`, `toUid`, `status`, `createdAt`, `updatedAt`.
- **Akses**: dibuat pemilik grup untuk teman (bukan yang memblokirnya). Penerima menjawab; tidak ada yang bisa dimasukkan ke grup tanpa menerima.

# Tambahan Fase 5 (ditulis hanya oleh Cloud Functions, kecuali nama Pet)

## `petProfiles/{uid}`
- **Field**: `species (mochi|bolt|luna)`, `name (1–20)`, `xp`, `fullness/joy/cleanliness (0–100)`, `statsAtMs`, `lastAction {feed,play,clean}` (ms), `xpDay`, `xpToday`, `createdAt`.
- **Akses**: baca pemilik; klien hanya boleh mengubah `name`; create/delete ditolak.
- **Aturan**: statistik dihitung lazy (turun per jam sejak `statsAtMs`); jeda per aksi; XP aksi maksimal 60/hari; level = floor(sqrt(xp/20))+1.

## `streaks/{uid}`
- **Field**: `current`, `longest`, `totalDays`, `lastDate (YYYY-MM-DD)`, `freezes`, `recentDays[]` (maks 120).
- **Akses**: baca pemilik; tulis hanya server.

## `groupStreaks/{groupId}`
- **Field**: `tz`, `current`, `longest`, `lastCompleteDate`, `dayDate`, `dayUids[]`.
- **Akses**: baca anggota grup (`get` saja); tulis hanya server.

## `achievements/{uid}`
- **Field**: `unlocked: { <id>: timestamp }`. Baca pemilik; tulis hanya server.

# Tambahan Fase 6 (chat)

ID percakapan (`cid`): chat pribadi = `<uidA>_<uidB>` (terurut); chat grup = id dokumen grup (20 karakter alfanumerik). Akses diturunkan dari id: peserta/pasangan teman, atau anggota grup saat ini.

## `conversations/{cid}`
- **Field**: `type (direct|group)`, `lastText (≤120)`, `lastSenderUid`, `lastMessageAt`, `lastMessageId`. Pratinjau; ditulis pengirim dalam batch yang sama dengan pesannya (dicek `getAfter`).
- **Akses**: `get` oleh peserta; tulis oleh peserta yang boleh mengirim (chat pribadi: berteman dan tidak saling memblokir).

## `conversations/{cid}/messages/{messageId}`
- **Field**: `senderUid`, `text (1–2000)`, `createdAt`, `replyToId|null`, `editedAt|null`, `deleted`, `reactions {uid: emoji}`.
- **Akses**: baca oleh peserta. Buat oleh pengirim. Edit hanya pengirim, maksimal 15 menit, tidak untuk pesan terhapus. Hapus = `deleted:true` + `text:''` oleh pengirim. Reaksi: tiap peserta hanya mengubah kuncinya sendiri, emoji dari daftar tetap. Tidak ada hapus permanen oleh klien.
- **Indeks**: hanya `createdAt` (otomatis). Pagination: 30 pesan per halaman.

## `conversations/{cid}/reads/{uid}`
- **Field**: `lastReadAt`. Tanda dibaca; ditulis hanya bila `readReceipts` aktif, chat pribadi.

## `users/{uid}/chatState/{cid}`
- **Field**: `lastReadAt`, `muted`. Pribadi (hanya pemilik); dipakai untuk penanda belum dibaca dan mute.

## `userSettings/{uid}`
- **Field (boolean)**: `readReceipts` (default true), `showOnline` (default false), `notifyMessages`, `remindStreak`, `remindPet` (default true). Hanya pemilik.

## `reports/{id}` (diperluas)
- Menambah `conversationId`, `messageId` opsional untuk laporan pesan.

## Realtime Database
- `typing/{cid}/{uid}`: timestamp server; dihapus otomatis saat putus; dianggap basi setelah 8 detik. Tulis hanya oleh pemilik uid.
- `presence/{uid}`: `{online, lastChanged}`; hanya dipublikasikan bila `showOnline` aktif.

# Tambahan Fase 7 (media)

## `mediaMetadata/{mediaId}` (id 20 karakter alfanumerik, dibuat klien)
- **Tujuan**: metadata + status media sementara. File: Storage `media/{mediaId}`.
- **Field dari klien (saat dibuat, status `uploading`)**: `ownerUid`, `context (chat|story)`, `conversationId|null`, `kind`, `mime`, `size`, `width`, `height`, `durationSec`, `caption (≤200)`, `recipients: []`, `receivedBy: []`, `status`, `createdAt`.
- **Field dari server**: `recipients`, `receivedBy` (via `acknowledgeMedia`), `status (available|deleted|expired|rejected)`, `reason`, `expiresAt`, `storyExpiresAt`, `deletedAt`.
- **Akses**: baca oleh pengirim dan penerima yang berhak. Klien hanya boleh membuat; semua pembaruan oleh Functions. Pembuatan untuk chat mensyaratkan hak kirim ke percakapan.
- **Indeks**: `(status, expiresAt)`, `(status, createdAt)`, `(recipients array-contains, storyExpiresAt)`, `(ownerUid, storyExpiresAt)`.
- **Retensi**: berkas dihapus setelah semua penerima mengonfirmasi atau saat kedaluwarsa (chat 7 hari, Story 24 jam). Dokumen metadata disimpan sebagai jejak audit (status + alasan + waktu).

## Pesan media
- `conversations/{cid}/messages/{mediaId}` memiliki field `mediaId` (id pesan = id media). `text` boleh kosong bila ada `mediaId`; Rules memastikan media milik pengirim, `context = chat`, `conversationId` cocok, dan status `available`.

## Storage `media/{mediaId}`
- Baca: hanya pengguna di `recipients` saat status `available`. Buat: hanya pemilik metadata berstatus `uploading`, ukuran ≤ 25 MB dan sama dengan metadata, `contentType` = `mime`. Tidak bisa ditimpa/dihapus klien.

## IndexedDB (klien, Dexie `strike-and-pet-local`)
- `media`: salinan lokal (`accountUid`, `direction`, `blob`, `thumb`, ...). `outbox`: antrean unggah (blob-nya ada di `media`). Data dipisah per `accountUid`.

# Tambahan Fase 8 (lokasi)

## `locationSessions/{sessionId}` (ditulis hanya oleh Cloud Functions)
- **Field**: `ownerUid`, `groupId`, `groupName`, `viewerUids[] (1–7, anggota grup)`, `status (active|stopped|expired)`, `historyEnabled`, `durationMin (15|60|240|480)`, `startedAt`, `expiresAt`, `endedAt|null`.
- **Akses**: baca oleh pemilik dan penerima; klien tidak bisa membuat/mengubah; pemilik boleh menghapus sesi yang sudah berakhir.
- **Indeks**: `(viewerUids array-contains, status)`, `(ownerUid, startedAt desc)`, `(ownerUid, status)`, `(status, expiresAt)`, `(historyEnabled, endedAt)`.
- **Retensi**: tanpa riwayat dihapus 24 jam setelah berakhir; dengan riwayat 7 hari (rekursif beserta titik rute).

## `locationSessions/{sessionId}/points/{id}` (opt-in)
- **Field**: `lat`, `lng`, `acc`, `speed|null`, `ts`. Hanya pemilik; dibuat klien hanya bila `historyEnabled` dan sesi aktif; sekitar 1 titik/menit.

## Realtime Database `locations/{sessionId}`
- `meta` (hanya server; pemilik boleh menyetel `active=false`): `{ownerUid, viewers:{uid:true}, expiresAt, active}`. Dapat dibaca pemilik/penerima.
- `pos` (ditulis pemilik saat sesi aktif dan belum kedaluwarsa; jeda ≥ 2 dtk): `{lat, lng, acc, speed?, src?, trust, max?, avg?, ts}`. Dapat dibaca pemilik/penerima hanya selama sesi aktif; dihapus saat sesi berhenti/kedaluwarsa.
- `conn`: `{online, ts}`; `onDisconnect` menandai pengirim offline.

## `userSettings/{uid}` (diperluas)
- Menambah `notifyLocation` (default true).

# Tambahan Fase 9–10

## `users/{uid}/devices/{sha256(token)}`
- **Field**: `token`, `platform`, `createdAt`. Hanya pemilik; dipakai Functions untuk push; token kedaluwarsa dibersihkan otomatis.

## Akun
- `deleteMyAccount` menghapus: sesi lokasi (+riwayat), media milik pengguna (berkas + metadata), grup milik sendiri (+chat, undangan, streak grup), keluar dari grup lain, undangan, pertemanan, permintaan, blokir, `users/{uid}` (+ `chatState`, `devices`), `usernames`, `userSettings`, `petProfiles`, `streaks`, `achievements`, `presence`, lalu akun Auth. Pesan yang pernah ditulis di percakapan orang lain dikosongkan (`deleted: true`).
- `exportMyData` mengembalikan JSON data milik pengguna (profil, pengaturan, pertemanan, grup, pesan yang ditulis, metadata media/sesi, riwayat rute opsional); tanpa token push.

## Indeks (ringkas)
`mediaMetadata`: (status, expiresAt), (status, createdAt), (recipients array-contains, storyExpiresAt), (ownerUid, storyExpiresAt). `locationSessions`: (viewerUids array-contains, status), (ownerUid, startedAt desc), (ownerUid, status), (status, expiresAt), (historyEnabled, endedAt). Collection-group: `messages.senderUid`.
