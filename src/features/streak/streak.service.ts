import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { earnedAchievementIds } from '@/shared/achievements';
import { dateKey } from '@/shared/dates';
import { levelForXp, parsePetState } from '@/shared/petLogic';
import {
  GROUP_COMPLETE_XP, STRIKE_XP, applyGroupStrike, applyStrike, initialGroupStreak, initialStreak,
  parseGroupStreak, parseStreakState, type GroupStreakState,
} from '@/shared/streakLogic';
import { deviceTimeZone } from '@/utils/tz';

// Tanpa Cloud Functions (paket Spark): logika dijalankan di perangkat dalam transaksi Firestore dan dibatasi
// Security Rules (lihat firestore.rules, bagian Fase 5).

export interface StrikeResponse {
  outcome: 'counted' | 'already_done';
  usedFreeze: boolean;
  earnedFreeze: boolean;
  broke: boolean;
  streak: { current: number; longest: number; freezes: number };
  groups: { id: string; current: number; justCompleted: boolean }[];
  xpGained: number;
  newAchievements: string[];
}

function requireUid(): string {
  const uid = getFirebase().auth.currentUser?.uid;
  if (!uid) throw new Error('Login diperlukan.');
  return uid;
}

async function myGroupIds(uid: string): Promise<string[]> {
  const snap = await getDocs(query(collection(getFirebase().db, 'groups'), where('memberUids', 'array-contains', uid)));
  return snap.docs.map((d) => d.id);
}

/** Membuka achievement baru berdasarkan data pengguna sendiri. Mengembalikan id yang baru terbuka. */
export async function syncAchievements(uid: string): Promise<string[]> {
  const { db } = getFirebase();
  const gids = await myGroupIds(uid);
  const [petSnap, streakSnap, achSnap, gSnaps] = await Promise.all([
    getDoc(doc(db, 'petProfiles', uid)),
    getDoc(doc(db, 'streaks', uid)),
    getDoc(doc(db, 'achievements', uid)),
    Promise.all(gids.map((id) => getDoc(doc(db, 'groupStreaks', id)).catch(() => null))),
  ]);
  const pet = petSnap.exists() ? parsePetState(petSnap.data()) : null;
  const streak = streakSnap.exists() ? parseStreakState(streakSnap.data()) : null;
  const groupLongest = gSnaps.reduce((max, s) => Math.max(max, (s?.exists() ? parseGroupStreak(s.data())?.longest : 0) ?? 0), 0);
  const earned = earnedAchievementIds({
    totalDays: streak?.totalDays ?? 0,
    streakLongest: streak?.longest ?? 0,
    petLevel: pet ? levelForXp(pet.xp) : 0,
    groupLongest,
  });
  const unlocked = (achSnap.data()?.unlocked ?? {}) as Record<string, unknown>;
  const fresh = earned.filter((id) => !(id in unlocked));
  if (fresh.length === 0) return [];
  try {
    await setDoc(doc(db, 'achievements', uid), { unlocked: Object.fromEntries(fresh.map((id) => [id, serverTimestamp()])) }, { merge: true });
  } catch {
    return []; // achievement tidak kritis; dicoba lagi pada aksi berikutnya
  }
  return fresh;
}

/**
 * Mengambil bonus XP grup (+20) untuk hari grup lengkap yang belum diklaim. Anggota yang strike lebih awal
 * baru mengetahuinya saat membuka aplikasi lagi, jadi klaim dilakukan oleh masing-masing anggota.
 */
export async function claimGroupBonuses(uid: string): Promise<number> {
  const { db } = getFirebase();
  let xp = 0;
  for (const gid of await myGroupIds(uid)) {
    const gs = await getDoc(doc(db, 'groupStreaks', gid)).catch(() => null);
    const last = gs?.exists() ? parseGroupStreak(gs.data())?.lastCompleteDate : null;
    if (!last) continue;
    const petRef = doc(db, 'petProfiles', uid);
    try {
      const gained = await runTransaction(db, async (tx) => {
        const snap = await tx.get(petRef);
        const pet = snap.exists() ? parsePetState(snap.data()) : null;
        if (!pet) return 0;
        const claims = (snap.data()?.groupClaims ?? {}) as Record<string, string>;
        if (claims[gid] === last) return 0;
        tx.update(petRef, { xp: pet.xp + GROUP_COMPLETE_XP, groupClaims: { ...claims, [gid]: last }, claimGid: gid });
        return GROUP_COMPLETE_XP;
      });
      xp += gained;
    } catch {
      /* data grup berubah di tengah jalan; dicoba lagi pada strike berikutnya */
    }
  }
  return xp;
}

export async function dailyStrike(): Promise<StrikeResponse> {
  const uid = requireUid();
  const { db } = getFirebase();
  const tz = deviceTimeZone();
  const now = Date.now();
  const today = dateKey(now, tz);

  // Bonus dari hari grup lengkap sebelumnya diklaim lebih dulu (sebelum strike hari ini menimpa lastCompleteDate).
  let xpGained = await claimGroupBonuses(uid);

  const gids = await myGroupIds(uid);
  const streakRef = doc(db, 'streaks', uid);
  const petRef = doc(db, 'petProfiles', uid);

  const out = await runTransaction(db, async (tx) => {
    const [streakSnap, petSnap, groupSnaps, gsSnaps] = await Promise.all([
      tx.get(streakRef),
      tx.get(petRef),
      Promise.all(gids.map((id) => tx.get(doc(db, 'groups', id)))),
      Promise.all(gids.map((id) => tx.get(doc(db, 'groupStreaks', id)))),
    ]);
    const prev = (streakSnap.exists() ? parseStreakState(streakSnap.data()) : null) ?? initialStreak();
    const r = applyStrike(prev, today);
    if (r.outcome === 'invalid_date') {
      throw new Error('Tanggal perangkat lebih lama dari strike terakhir. Periksa zona waktu/jam perangkat.');
    }
    if (r.outcome === 'counted') {
      tx.set(streakRef, r.state);
      if (petSnap.exists()) tx.update(petRef, { xp: (parsePetState(petSnap.data())?.xp ?? 0) + STRIKE_XP });
    }
    const groups: { id: string; current: number; justCompleted: boolean }[] = [];
    groupSnaps.forEach((gd, i) => {
      const members = gd.data()?.memberUids;
      const memberUids = Array.isArray(members) ? members.filter((m): m is string => typeof m === 'string') : [];
      if (!gd.exists() || !memberUids.includes(uid)) return;
      const existing = gsSnaps[i];
      const gPrev: GroupStreakState = (existing?.exists() ? parseGroupStreak(existing.data()) : null) ?? initialGroupStreak(tz);
      const g = applyGroupStrike(gPrev, uid, memberUids, now); // idempoten: aman dipanggil ulang
      if (JSON.stringify(g.state) !== JSON.stringify(gPrev) || !existing?.exists()) tx.set(doc(db, 'groupStreaks', gd.id), g.state);
      groups.push({ id: gd.id, current: g.state.current, justCompleted: g.justCompleted });
    });
    return { r, groups };
  });

  if (out.r.outcome === 'counted') xpGained += STRIKE_XP;
  if (out.groups.some((g) => g.justCompleted)) xpGained += await claimGroupBonuses(uid);
  const newAchievements = await syncAchievements(uid);

  return {
    outcome: out.r.outcome === 'counted' ? 'counted' : 'already_done',
    usedFreeze: out.r.usedFreeze,
    earnedFreeze: out.r.earnedFreeze,
    broke: out.r.broke,
    streak: { current: out.r.state.current, longest: out.r.state.longest, freezes: out.r.state.freezes },
    groups: out.groups,
    xpGained,
    newAchievements,
  };
}
