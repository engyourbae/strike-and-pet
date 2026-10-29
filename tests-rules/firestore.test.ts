import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Bytes, Timestamp, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { GROUP, MEDIA, PAIR, createEnv } from './env';

let env: RulesTestEnvironment;
const as = (uid: string): Firestore => env.authenticatedContext(uid).firestore();
const seed = (fn: (db: Firestore) => Promise<void>) => env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));

const user = (uid: string, username: string) => ({ uid, username, displayName: username, photoURL: null, bio: '', createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
const seedUsers = () => seed(async (db) => {
  await setDoc(doc(db, 'users', 'alice'), user('alice', 'alice_u'));
  await setDoc(doc(db, 'users', 'bob'), user('bob', 'bob_u'));
  await setDoc(doc(db, 'users', 'carol'), user('carol', 'carol_u'));
});
const seedFriends = () => seed(async (db) => { await setDoc(doc(db, 'friendships', PAIR), { members: ['alice', 'bob'], createdAt: Timestamp.now() }); });
const seedGroup = (members: string[] = ['alice', 'bob']) => seed(async (db) => {
  await setDoc(doc(db, 'groups', GROUP), { type: 'squad', name: 'Tim', ownerUid: 'alice', memberUids: members, maxMembers: 4, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
});
const seedMessage = (id: string, createdAt: Timestamp = Timestamp.now(), cid = PAIR) => seed(async (db) => {
  await setDoc(doc(db, 'conversations', cid, 'messages', id), { senderUid: 'alice', text: 'halo', createdAt, replyToId: null, editedAt: null, deleted: false, reactions: {} });
});

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

describe('username & profil', () => {
  const claim = (uid: string, name: string) => {
    const db = as(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'usernames', name), { uid, createdAt: serverTimestamp() });
    b.set(doc(db, 'users', uid), { uid, username: name, displayName: name, photoURL: null, bio: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return b.commit();
  };
  it('klaim atomik berhasil; username kembar (balapan) ditolak', async () => {
    await assertSucceeds(claim('alice', 'budi'));
    await assertFails(claim('bob', 'budi'));
  });
  it('profil tanpa klaim username ditolak', async () => {
    const db = as('bob');
    await assertFails(setDoc(doc(db, 'users', 'bob'), { uid: 'bob', username: 'baru', displayName: 'b', photoURL: null, bio: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
  it('username tidak bisa diubah; nama/bio bisa; orang lain tidak bisa mengubah profil', async () => {
    await seedUsers();
    await assertFails(updateDoc(doc(as('alice'), 'users', 'alice'), { username: 'lain', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'users', 'alice'), { displayName: 'Baru', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('carol'), 'users', 'alice'), { displayName: 'Hack', updatedAt: serverTimestamp() }));
  });
  it('tanpa login tidak bisa membaca profil', async () => {
    await seedUsers();
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users', 'alice')));
  });
});

describe('data privat (pengguna A mencoba membaca data pengguna B)', () => {
  it('pengaturan, streak, pet, dan status chat milik B tertutup untuk A', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'userSettings', 'bob'), { readReceipts: true });
      await setDoc(doc(db, 'streaks', 'bob'), { current: 3 });
      await setDoc(doc(db, 'petProfiles', 'bob'), { species: 'mochi', name: 'x' });
      await setDoc(doc(db, 'users', 'bob', 'chatState', PAIR), { muted: true });
    });
    for (const [c, id] of [['userSettings', 'bob'], ['streaks', 'bob'], ['petProfiles', 'bob']] as const) {
      await assertFails(getDoc(doc(as('alice'), c, id)));
      await assertSucceeds(getDoc(doc(as('bob'), c, id)));
    }
    await assertFails(getDoc(doc(as('alice'), 'users', 'bob', 'chatState', PAIR)));
  });
  const today = () => new Date().toISOString().slice(0, 10);
  const petDoc = (over: Record<string, unknown> = {}) => ({ species: 'mochi', name: 'Momo', xp: 0, fullness: 80, joy: 80, cleanliness: 80, statsAtMs: Date.now(), lastAction: { feed: 0, play: 0, clean: 0 }, xpDay: today(), xpToday: 0, groupClaims: {}, ...over });
  it('pet: adopsi valid; XP/level tidak bisa dinaikkan sembarangan; ganti nama boleh', async () => {
    await assertFails(setDoc(doc(as('alice'), 'petProfiles', 'alice'), { ...petDoc({ xp: 500 }), createdAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(as('alice'), 'petProfiles', 'alice'), { ...petDoc(), createdAt: serverTimestamp() }));
    await assertFails(setDoc(doc(as('bob'), 'petProfiles', 'alice'), { ...petDoc(), createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('alice'), 'petProfiles', 'alice'), { xp: 9999 }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'petProfiles', 'alice'), { name: 'Baru' }));
  });
  it('pet: perawatan menambah XP sesuai batas dan menghormati jeda aksi', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'petProfiles', 'alice'), { ...petDoc(), createdAt: Timestamp.now() }); });
    const now = Date.now();
    await assertSucceeds(updateDoc(doc(as('alice'), 'petProfiles', 'alice'), { xp: 5, xpToday: 5, fullness: 100, statsAtMs: now, lastAction: { feed: now, play: 0, clean: 0 } }));
    await assertFails(updateDoc(doc(as('alice'), 'petProfiles', 'alice'), { xp: 10, xpToday: 10, lastAction: { feed: now + 60_000, play: 0, clean: 0 } })); // jeda 30 menit
    await assertFails(updateDoc(doc(as('alice'), 'petProfiles', 'alice'), { xp: 105, xpToday: 105 })); // melewati batas harian
  });
  it('streak: strike pertama valid; lompatan angka atau tanggal ditolak; XP strike harus disertai streak', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'petProfiles', 'alice'), { ...petDoc(), createdAt: Timestamp.now() }); });
    await assertFails(setDoc(doc(as('alice'), 'streaks', 'alice'), { current: 99, longest: 99, totalDays: 99, lastDate: today(), freezes: 0, recentDays: [today()] }));
    await assertFails(setDoc(doc(as('alice'), 'streaks', 'alice'), { current: 1, longest: 1, totalDays: 1, lastDate: '2020-01-01', freezes: 0, recentDays: ['2020-01-01'] }));
    await assertFails(updateDoc(doc(as('alice'), 'petProfiles', 'alice'), { xp: 10 })); // tanpa kenaikan streak
    const batch = writeBatch(as('alice'));
    batch.set(doc(as('alice'), 'streaks', 'alice'), { current: 1, longest: 1, totalDays: 1, lastDate: today(), freezes: 0, recentDays: [today()] });
    batch.update(doc(as('alice'), 'petProfiles', 'alice'), { xp: 10 });
    await assertSucceeds(batch.commit());
    await assertFails(setDoc(doc(as('alice'), 'streaks', 'alice'), { current: 2, longest: 2, totalDays: 2, lastDate: today(), freezes: 0, recentDays: [today()] })); // tanggal sama
  });
  it('achievement: hanya yang sudah memenuhi syarat', async () => {
    await assertFails(setDoc(doc(as('alice'), 'achievements', 'alice'), { unlocked: { streak_30: serverTimestamp() } }));
    await assertFails(setDoc(doc(as('alice'), 'achievements', 'alice'), { unlocked: { sembarang: serverTimestamp() } }));
  });
  it('pengaturan: hanya boolean dan kunci yang dikenal', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'userSettings', 'alice'), { readReceipts: false, showOnline: true }));
    await assertFails(setDoc(doc(as('alice'), 'userSettings', 'alice'), { readReceipts: 'ya' }));
    await assertFails(setDoc(doc(as('alice'), 'userSettings', 'alice'), { admin: true }));
  });
});

describe('teman & blokir', () => {
  const req = (from: string, to: string, username: string) => setDoc(doc(as(from), 'friendRequests', `${from}_${to}`), {
    fromUid: from, toUid: to, fromUsername: username, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  it('mengirim permintaan; diri sendiri dan pihak yang memblokir ditolak', async () => {
    await seedUsers();
    await assertSucceeds(req('alice', 'bob', 'alice_u'));
    await assertFails(req('alice', 'alice', 'alice_u'));
    await seed(async (db) => { await setDoc(doc(db, 'blocks', 'carol_alice'), { blockerUid: 'carol', blockedUid: 'alice', blockedUsername: 'alice_u', createdAt: Timestamp.now() }); });
    await assertFails(req('alice', 'carol', 'alice_u'));
  });
  it('hanya penerima yang bisa menerima; pertemanan tidak bisa dipalsukan', async () => {
    await seedUsers();
    await seed(async (db) => { await setDoc(doc(db, 'friendRequests', 'alice_bob'), { fromUid: 'alice', toUid: 'bob', fromUsername: 'alice_u', status: 'pending', createdAt: Timestamp.now(), updatedAt: Timestamp.now() }); });
    await assertFails(updateDoc(doc(as('alice'), 'friendRequests', 'alice_bob'), { status: 'accepted', updatedAt: serverTimestamp() }));
    const fake = as('carol');
    await assertFails(setDoc(doc(fake, 'friendships', PAIR), { members: ['alice', 'bob'], createdAt: serverTimestamp() }));
    const bob = as('bob');
    const b = writeBatch(bob);
    b.update(doc(bob, 'friendRequests', 'alice_bob'), { status: 'accepted', updatedAt: serverTimestamp() });
    b.set(doc(bob, 'friendships', PAIR), { members: ['alice', 'bob'], createdAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});

describe('grup, undangan, dan persetujuan', () => {
  const invite = (to: string) => setDoc(doc(as('alice'), 'invitations', `${GROUP}_${to}`), {
    groupId: GROUP, groupName: 'Tim', groupType: 'squad', fromUid: 'alice', fromUsername: 'alice_u', toUid: to, status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  it('id grup harus 20 karakter alfanumerik dan pembuat menjadi satu-satunya anggota awal', async () => {
    const mk = (id: string, members: string[]) => setDoc(doc(as('alice'), 'groups', id), { type: 'squad', name: 'Tim', ownerUid: 'alice', memberUids: members, maxMembers: 4, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await assertSucceeds(mk(GROUP, ['alice']));
    await assertFails(mk('pendek', ['alice']));
    await assertFails(mk('OTHERAAAAAAAAAAAAAAA', ['alice', 'bob']));
  });
  it('tidak bisa memasukkan orang ke grup tanpa menerima undangan', async () => {
    await seedUsers();
    await seedFriends();
    await seedGroup(['alice']);
    await assertSucceeds(invite('bob'));
    await assertFails(updateDoc(doc(as('bob'), 'groups', GROUP), { memberUids: arrayUnion('bob'), updatedAt: serverTimestamp() }));
    const bob = as('bob');
    const b = writeBatch(bob);
    b.update(doc(bob, 'invitations', `${GROUP}_bob`), { status: 'accepted', updatedAt: serverTimestamp() });
    b.update(doc(bob, 'groups', GROUP), { memberUids: arrayUnion('bob'), updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
  it('mengundang non-teman ditolak; orang asing tidak bisa membaca grup', async () => {
    await seedUsers();
    await seedGroup(['alice']);
    await assertFails(invite('carol'));
    await assertFails(getDoc(doc(as('carol'), 'groups', GROUP)));
  });
});

describe('chat', () => {
  const send = (uid: string, cid: string, id: string, extra: Record<string, unknown> = {}) => {
    const db = as(uid);
    const b = writeBatch(db);
    b.set(doc(db, 'conversations', cid, 'messages', id), { senderUid: uid, text: 'halo', createdAt: serverTimestamp(), replyToId: null, editedAt: null, deleted: false, reactions: {}, ...extra });
    b.set(doc(db, 'conversations', cid), { type: cid.includes('_') ? 'direct' : 'group', lastText: 'halo', lastSenderUid: uid, lastMessageAt: serverTimestamp(), lastMessageId: id });
    return b.commit();
  };
  it('orang asing tidak bisa membaca atau menulis; teman bisa', async () => {
    await seedFriends();
    await seedMessage('m1');
    await assertFails(getDoc(doc(as('carol'), 'conversations', PAIR, 'messages', 'm1')));
    await assertSucceeds(getDoc(doc(as('bob'), 'conversations', PAIR, 'messages', 'm1')));
    await assertFails(send('carol', PAIR, 'm2'));
    await assertSucceeds(send('alice', PAIR, 'm3'));
  });
  it('bukan teman atau diblokir tidak bisa mengirim; pengirim tidak bisa dipalsukan', async () => {
    await assertFails(send('alice', PAIR, 'm1')); // belum berteman
    await seedFriends();
    await assertFails(send('alice', PAIR, 'm2', { senderUid: 'bob' }));
    await seed(async (db) => { await setDoc(doc(db, 'blocks', 'bob_alice'), { blockerUid: 'bob', blockedUid: 'alice', blockedUsername: 'alice_u', createdAt: Timestamp.now() }); });
    await assertFails(send('alice', PAIR, 'm3'));
  });
  it('edit hanya oleh pengirim dalam 15 menit', async () => {
    await seedFriends();
    await seedMessage('baru');
    await seedMessage('lama', Timestamp.fromMillis(Date.now() - 20 * 60_000));
    await assertSucceeds(updateDoc(doc(as('alice'), 'conversations', PAIR, 'messages', 'baru'), { text: 'edit', editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('alice'), 'conversations', PAIR, 'messages', 'lama'), { text: 'edit', editedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as('bob'), 'conversations', PAIR, 'messages', 'baru'), { text: 'edit', editedAt: serverTimestamp() }));
  });
  it('reaksi: hanya kunci sendiri dan emoji dari daftar; hapus pesan hanya pengirim', async () => {
    await seedFriends();
    await seedMessage('m1');
    const m = (uid: string) => doc(as(uid), 'conversations', PAIR, 'messages', 'm1');
    await assertSucceeds(updateDoc(m('bob'), { 'reactions.bob': '💜' }));
    await assertFails(updateDoc(m('bob'), { 'reactions.bob': '🍕' }));
    await assertFails(updateDoc(m('bob'), { 'reactions.alice': '💜' }));
    await assertFails(updateDoc(m('bob'), { deleted: true, text: '' }));
    await assertSucceeds(updateDoc(m('alice'), { deleted: true, text: '' }));
  });
  it('anggota yang keluar dari grup kehilangan akses ke chat lama', async () => {
    await seedGroup(['alice', 'bob']);
    await seedMessage('g1', Timestamp.now(), GROUP);
    await assertSucceeds(getDoc(doc(as('bob'), 'conversations', GROUP, 'messages', 'g1')));
    await seedGroup(['alice']); // bob keluar
    await assertFails(getDoc(doc(as('bob'), 'conversations', GROUP, 'messages', 'g1')));
    await assertFails(getDoc(doc(as('carol'), 'conversations', GROUP, 'messages', 'g1')));
  });
  it('pesan media hanya boleh merujuk media milik pengirim yang sudah tervalidasi server', async () => {
    await seedFriends();
    const meta = (status: string, owner = 'alice') => seed(async (db) => {
      await setDoc(doc(db, 'mediaMetadata', MEDIA), { ownerUid: owner, context: 'chat', conversationId: PAIR, kind: 'image', mime: 'image/jpeg', size: 10, width: 1, height: 1, durationSec: 0, caption: '', recipients: ['bob'], receivedBy: [], status, createdAt: Timestamp.now() });
    });
    await meta('uploading');
    await assertFails(send('alice', PAIR, MEDIA, { mediaId: MEDIA, text: '' }));
    await meta('available', 'bob');
    await assertFails(send('alice', PAIR, MEDIA, { mediaId: MEDIA, text: '' }));
    await meta('available');
    await assertSucceeds(send('alice', PAIR, MEDIA, { mediaId: MEDIA, text: '' }));
    await assertFails(send('alice', PAIR, 'm9', { text: '' })); // teks kosong tanpa media
  });
});

describe('media (potongan di Firestore)', () => {
  const base = { ownerUid: 'alice', context: 'story', conversationId: null, kind: 'image', mime: 'image/jpeg', size: 1000, chunks: 1, width: 100, height: 100, durationSec: 0, caption: '', recipients: ['bob'] as string[], receivedBy: [] as string[], status: 'uploading' };
  const create = (over: Record<string, unknown> = {}, uid = 'alice') => setDoc(doc(as(uid), 'mediaMetadata', MEDIA), { ...base, createdAt: serverTimestamp(), ...over });
  const part = (uid: string, n = 0) => setDoc(doc(as(uid), 'mediaBlobs', MEDIA, 'parts', String(n)), { n, data: Bytes.fromUint8Array(new Uint8Array([1, 2, 3])) });
  it('pemilik hanya bisa membuat dokumen "uploading" yang valid', async () => {
    await assertSucceeds(create());
    await env.clearFirestore();
    await assertFails(create({ status: 'available' }));
    await assertFails(create({ recipients: [] }));
    await assertFails(create({ recipients: ['alice'] }));
    await assertFails(create({ chunks: 5 })); // tidak cocok dengan ukuran
    await assertFails(create({ mime: 'image/svg+xml' }));
    await assertFails(create({ size: 11 * 1024 * 1024, chunks: 16 }));
    await assertFails(create({ kind: 'video', mime: 'video/mp4', durationSec: 31 }));
    await assertFails(create({ ownerUid: 'bob' }));
  });
  it('potongan hanya diunggah pemilik; baru "available" setelah potongan terakhir ada', async () => {
    await assertSucceeds(create());
    await assertFails(part('bob'));
    const exp = Timestamp.fromMillis(Date.now() + 3_600_000);
    await assertFails(updateDoc(doc(as('alice'), 'mediaMetadata', MEDIA), { status: 'available', expiresAt: exp, storyExpiresAt: exp })); // belum ada potongan
    await assertSucceeds(part('alice'));
    await assertSucceeds(updateDoc(doc(as('alice'), 'mediaMetadata', MEDIA), { status: 'available', expiresAt: exp, storyExpiresAt: exp }));
  });
  it('penerima membaca potongan hanya saat available; orang asing tidak; konfirmasi hanya untuk diri sendiri', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'mediaMetadata', MEDIA), { ...base, status: 'available', createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000), storyExpiresAt: Timestamp.fromMillis(Date.now() + 3_600_000) });
      await setDoc(doc(db, 'mediaBlobs', MEDIA, 'parts', '0'), { n: 0, data: Bytes.fromUint8Array(new Uint8Array([1])) });
    });
    await assertSucceeds(getDoc(doc(as('bob'), 'mediaMetadata', MEDIA)));
    await assertFails(getDoc(doc(as('carol'), 'mediaMetadata', MEDIA)));
    await assertSucceeds(getDocs(collection(as('bob'), 'mediaBlobs', MEDIA, 'parts')));
    await assertFails(getDocs(collection(as('carol'), 'mediaBlobs', MEDIA, 'parts')));
    await assertFails(updateDoc(doc(as('carol'), 'mediaMetadata', MEDIA), { receivedBy: arrayUnion('carol') }));
    await assertFails(updateDoc(doc(as('bob'), 'mediaMetadata', MEDIA), { receivedBy: arrayUnion('carol') }));
    await assertFails(deleteDoc(doc(as('bob'), 'mediaBlobs', MEDIA, 'parts', '0'))); // belum semua mengonfirmasi
    await assertSucceeds(updateDoc(doc(as('bob'), 'mediaMetadata', MEDIA), { receivedBy: arrayUnion('bob') }));
    await assertSucceeds(updateDoc(doc(as('bob'), 'mediaMetadata', MEDIA), { status: 'deleted', reason: 'delivered', deletedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(as('bob'), 'mediaBlobs', MEDIA, 'parts', '0')));
  });
});

describe('sesi lokasi', () => {
  const sess = (history: boolean) => seed(async (db) => {
    await setDoc(doc(db, 'locationSessions', 's1'), { ownerUid: 'alice', groupId: GROUP, groupName: 'Tim', viewerUids: ['bob'], status: 'active', historyEnabled: history, durationMin: 60, startedAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000), endedAt: null });
  });
  const newSession = (over: Record<string, unknown> = {}) => ({ ownerUid: 'alice', groupId: GROUP, groupName: 'Tim', viewerUids: ['bob'], status: 'active', historyEnabled: false, durationMin: 60, startedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000), endedAt: null, ...over });
  it('pengguna asing tidak bisa mengakses; penerima bisa membaca', async () => {
    await sess(false);
    await assertSucceeds(getDoc(doc(as('bob'), 'locationSessions', 's1')));
    await assertFails(getDoc(doc(as('carol'), 'locationSessions', 's1')));
    await assertSucceeds(getDocs(query(collection(as('bob'), 'locationSessions'), where('viewerUids', 'array-contains', 'bob'), where('status', '==', 'active'))));
    await assertFails(getDocs(collection(as('carol'), 'locationSessions')));
  });
  it('pemilik membuat sesi hanya untuk anggota grup dengan durasi/masa berlaku yang wajar', async () => {
    await seedGroup(['alice', 'bob']);
    await assertSucceeds(setDoc(doc(as('alice'), 'locationSessions', 's2'), newSession()));
    await assertFails(setDoc(doc(as('alice'), 'locationSessions', 's3'), newSession({ viewerUids: ['carol'] })));
    await assertFails(setDoc(doc(as('alice'), 'locationSessions', 's4'), newSession({ durationMin: 999 })));
    await assertFails(setDoc(doc(as('alice'), 'locationSessions', 's5'), newSession({ expiresAt: Timestamp.fromMillis(Date.now() + 48 * 3_600_000) })));
    await assertFails(setDoc(doc(as('carol'), 'locationSessions', 's6'), newSession({ ownerUid: 'carol' })));
  });
  it('hanya pemilik yang bisa menghentikan sesi aktif', async () => {
    await sess(false);
    await assertFails(updateDoc(doc(as('bob'), 'locationSessions', 's1'), { status: 'stopped', endedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as('alice'), 'locationSessions', 's1'), { status: 'stopped', endedAt: serverTimestamp() }));
  });
  it('riwayat rute hanya bila diaktifkan dan hanya terbaca pemilik', async () => {
    const pt = { lat: -6.2, lng: 106.8, acc: 10, speed: null, ts: serverTimestamp() };
    await sess(false);
    await assertFails(setDoc(doc(as('alice'), 'locationSessions', 's1', 'points', 'p1'), pt));
    await sess(true);
    await assertSucceeds(setDoc(doc(as('alice'), 'locationSessions', 's1', 'points', 'p1'), pt));
    await assertFails(setDoc(doc(as('bob'), 'locationSessions', 's1', 'points', 'p2'), pt));
    await assertFails(getDoc(doc(as('bob'), 'locationSessions', 's1', 'points', 'p1')));
    await assertSucceeds(getDoc(doc(as('alice'), 'locationSessions', 's1', 'points', 'p1')));
  });
});

describe('laporan', () => {
  it('laporan hanya bisa dibuat', async () => {
    const rep = { reporterUid: 'alice', reportedUid: 'bob', reason: 'spam', createdAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(as('alice'), 'reports', 'r1'), rep));
    await assertFails(getDoc(doc(as('alice'), 'reports', 'r1')));
    await assertFails(setDoc(doc(as('alice'), 'reports', 'r2'), { ...rep, reason: 'bebas' }));
  });
});
