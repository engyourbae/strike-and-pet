import { doc, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { syncAchievements } from '@/features/streak/streak.service';
import { dateKey } from '@/shared/dates';
import { applyPetAction, isPetAction, isSpecies, newPet, parsePetState, validatePetName, type PetAction, type Species } from '@/shared/petLogic';
import { deviceTimeZone } from '@/utils/tz';

// Tanpa Cloud Functions (paket Spark): logika dijalankan di perangkat dalam transaksi Firestore dan dibatasi
// Security Rules (jeda aksi, batas XP harian, lompatan tanggal).

export interface PetActionResponse {
  xpGained: number;
  leveledUp: boolean;
  newAchievements: string[];
}

function requireUid(): string {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error('Login diperlukan.');
  return uid;
}

export async function adoptPet(species: Species, name: string): Promise<{ ok: true }> {
  const uid = requireUid();
  if (!isSpecies(species)) throw new Error('Jenis Pet tidak valid.');
  const check = validatePetName(name);
  if (!check.ok) throw new Error(check.error);
  const { db } = getFirebase();
  const ref = doc(db, 'petProfiles', uid);
  const now = Date.now();
  await runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) throw new Error('Kamu sudah punya Pet.');
    tx.set(ref, { ...newPet(species, check.value, now, dateKey(now, deviceTimeZone())), groupClaims: {}, createdAt: serverTimestamp() });
  });
  return { ok: true };
}

export async function performPetAction(action: PetAction): Promise<PetActionResponse> {
  const uid = requireUid();
  if (!isPetAction(action)) throw new Error('Aksi tidak valid.');
  const { db } = getFirebase();
  const ref = doc(db, 'petProfiles', uid);
  const now = Date.now();
  const today = dateKey(now, deviceTimeZone());

  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const pet = snap.exists() ? parsePetState(snap.data()) : null;
    if (!pet) throw new Error('Kamu belum punya Pet.');
    const r = applyPetAction(pet, action, now, today);
    if (!r.ok) throw new Error(`Pet butuh jeda ${Math.ceil(r.retryAfterMs / 60_000)} menit lagi.`);
    const { species: _s, name: _n, ...changing } = r.state;
    void _s; void _n;
    tx.update(ref, changing);
    return r;
  });
  const newAchievements = await syncAchievements(uid);
  return { xpGained: result.xpGained, leveledUp: result.leveledUp, newAchievements };
}

/** Mengganti nama langsung ke Firestore; Rules hanya mengizinkan field `name` (1–20 karakter). */
export async function renamePet(uid: string, raw: string): Promise<void> {
  const check = validatePetName(raw);
  if (!check.ok) throw new Error(check.error);
  await updateDoc(doc(getFirebase().db, 'petProfiles', uid), { name: check.value });
}

