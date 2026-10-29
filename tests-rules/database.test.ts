import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, remove, serverTimestamp, set } from 'firebase/database';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { createEnv } from './env';

let env: RulesTestEnvironment;
const db = (uid: string) => env.authenticatedContext(uid).database();
const seedMeta = (over: Record<string, unknown> = {}) => env.withSecurityRulesDisabled(async (ctx) => {
  await set(ref(ctx.database(), 'locations/s1/meta'), { ownerUid: 'alice', viewers: { bob: true }, expiresAt: Date.now() + 3_600_000, active: true, ...over });
});
const pos = (over: Record<string, unknown> = {}) => ({ lat: -6.2, lng: 106.8, acc: 10, trust: false, ts: serverTimestamp(), ...over });

beforeAll(async () => { env = await createEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearDatabase(); });

describe('Realtime Database: lokasi', () => {
  it('pemilik menulis; penerima membaca; orang asing tidak bisa membaca', async () => {
    await seedMeta();
    await assertSucceeds(set(ref(db('alice'), 'locations/s1/pos'), pos()));
    await assertSucceeds(get(ref(db('bob'), 'locations/s1/pos')));
    await assertFails(get(ref(db('carol'), 'locations/s1/pos')));
    await assertFails(get(ref(env.unauthenticatedContext().database(), 'locations/s1/pos')));
  });
  it('penerima tidak bisa menulis posisi; koordinat/field tidak valid ditolak', async () => {
    await seedMeta();
    await assertFails(set(ref(db('bob'), 'locations/s1/pos'), pos()));
    await assertFails(set(ref(db('alice'), 'locations/s1/pos'), pos({ lat: 100 })));
    await assertFails(set(ref(db('alice'), 'locations/s1/pos'), pos({ extra: 1 })));
    await assertFails(set(ref(db('alice'), 'locations/s1/pos'), pos({ speed: 500 })));
  });
  it('sesi berhenti atau kedaluwarsa: tidak bisa lagi dibaca maupun ditulis', async () => {
    await seedMeta({ active: false });
    await assertFails(get(ref(db('bob'), 'locations/s1/pos')));
    await assertFails(set(ref(db('alice'), 'locations/s1/pos'), pos()));
    await env.clearDatabase();
    await seedMeta({ expiresAt: Date.now() - 1000 });
    await assertFails(set(ref(db('alice'), 'locations/s1/pos'), pos()));
    await assertFails(get(ref(db('bob'), 'locations/s1/pos')));
  });
  it('pembatasan frekuensi: tulis ulang < 2 detik ditolak', async () => {
    await seedMeta();
    await assertSucceeds(set(ref(db('alice'), 'locations/s1/pos'), pos()));
    await assertFails(set(ref(db('alice'), 'locations/s1/pos'), pos()));
  });
  it('pemilik membuat meta sesinya sendiri sekali; tidak bisa diubah/ditulis orang lain; hanya boleh mematikan active', async () => {
    const meta = (over: Record<string, unknown> = {}) => ({ ownerUid: 'alice', viewers: { bob: true }, expiresAt: Date.now() + 3_600_000, active: true, ...over });
    await assertFails(set(ref(db('bob'), 'locations/s1/meta'), meta())); // bukan pemilik
    await assertFails(set(ref(db('alice'), 'locations/s1/meta'), meta({ expiresAt: Date.now() + 48 * 3_600_000 })));
    await assertSucceeds(set(ref(db('alice'), 'locations/s1/meta'), meta()));
    await assertFails(set(ref(db('alice'), 'locations/s1/meta'), meta({ viewers: { carol: true } }))); // tidak bisa ditimpa
    await assertFails(set(ref(db('alice'), 'locations/s1/meta/viewers/carol'), true));
    await assertFails(set(ref(db('bob'), 'locations/s1/meta/active'), false));
    await assertFails(set(ref(db('alice'), 'locations/s1/meta/active'), true));
    await assertSucceeds(set(ref(db('alice'), 'locations/s1/meta/active'), false));
  });
  it('hanya pemilik yang bisa menghapus node sesi', async () => {
    await seedMeta();
    await assertFails(remove(ref(db('bob'), 'locations/s1')));
    await assertSucceeds(remove(ref(db('alice'), 'locations/s1')));
  });
});

describe('Realtime Database: mengetik dan online', () => {
  it('hanya boleh menulis node milik sendiri', async () => {
    await assertSucceeds(set(ref(db('alice'), 'typing/c1/alice'), serverTimestamp()));
    await assertFails(set(ref(db('alice'), 'typing/c1/bob'), serverTimestamp()));
    await assertSucceeds(set(ref(db('alice'), 'presence/alice'), { online: true, lastChanged: serverTimestamp() }));
    await assertFails(set(ref(db('bob'), 'presence/alice'), { online: true, lastChanged: serverTimestamp() }));
    await assertFails(set(ref(db('alice'), 'presence/alice'), { online: true, lastChanged: serverTimestamp(), extra: 1 }));
  });
});
