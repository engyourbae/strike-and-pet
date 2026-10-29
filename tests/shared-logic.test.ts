import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, earnedAchievementIds } from '@/shared/achievements';
import { addDays, dateKey, diffDays, isValidTimeZone } from '@/shared/dates';
import {
  ACTIONS, DAILY_ACTION_XP_CAP, applyPetAction, decayed, levelForXp, levelProgress, moodOf, newPet, parsePetState, xpForLevel,
} from '@/shared/petLogic';
import {
  FREEZE_EVERY, MAX_FREEZES, applyGroupStrike, applyStrike, effectiveGroupStreak, effectiveStreak, initialGroupStreak, initialStreak,
} from '@/shared/streakLogic';
import { buildMonthGrid } from '@/utils/calendar';

describe('tanggal & zona waktu', () => {
  it('pergantian hari mengikuti zona waktu', () => {
    const t = Date.UTC(2026, 9, 27, 17, 30);
    expect(dateKey(t, 'UTC')).toBe('2026-10-27');
    expect(dateKey(t, 'Asia/Jakarta')).toBe('2026-10-28');
  });
  it('addDays/diffDays melewati batas bulan', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(diffDays('2026-10-30', '2026-11-02')).toBe(3);
  });
  it('validasi zona waktu', () => {
    expect(isValidTimeZone('Asia/Jakarta')).toBe(true);
    expect(isValidTimeZone('Bukan/Zona')).toBe(false);
  });
  it('kalender Oktober 2026 mulai Kamis (offset 3), 31 hari', () => {
    const g = buildMonthGrid('2026-10-28');
    expect(g.cells.slice(0, 3)).toEqual([null, null, null]);
    expect(g.cells[3]).toBe('2026-10-01');
    expect(g.cells).toHaveLength(34);
  });
});

describe('streak pribadi', () => {
  it('strike pertama dan hari berurutan', () => {
    const a = applyStrike(initialStreak(), '2026-10-01');
    expect(a.outcome).toBe('counted');
    expect(a.state.current).toBe(1);
    expect(applyStrike(a.state, '2026-10-02').state.current).toBe(2);
  });
  it('strike di hari yang sama tidak menambah (anti klaim ganda)', () => {
    const a = applyStrike(initialStreak(), '2026-10-01');
    const b = applyStrike(a.state, '2026-10-01');
    expect(b.outcome).toBe('already_done');
    expect(b.state).toEqual(a.state);
  });
  it('terlewat 1 hari memakai hari istirahat', () => {
    const s = { ...initialStreak(), current: 5, longest: 5, totalDays: 5, lastDate: '2026-10-01', freezes: 1 };
    const r = applyStrike(s, '2026-10-03');
    expect(r.usedFreeze).toBe(true);
    expect(r.state.current).toBe(6);
    expect(r.state.freezes).toBe(0);
  });
  it('tanpa hari istirahat atau terlewat 2+ hari, streak mulai lagi tetapi rekor tersimpan', () => {
    const s = { ...initialStreak(), current: 5, longest: 5, totalDays: 5, lastDate: '2026-10-01', freezes: 0 };
    const r = applyStrike(s, '2026-10-03');
    expect(r.broke).toBe(true);
    expect(r.state.current).toBe(1);
    expect(r.state.longest).toBe(5);
    const s2 = { ...s, freezes: 2 };
    expect(applyStrike(s2, '2026-10-04').state.current).toBe(1);
  });
  it('hari ke-7 memberi hari istirahat, maksimal 2', () => {
    const s = { ...initialStreak(), current: FREEZE_EVERY - 1, longest: 6, totalDays: 6, lastDate: '2026-10-06', freezes: 0 };
    const r = applyStrike(s, '2026-10-07');
    expect(r.earnedFreeze).toBe(true);
    expect(r.state.freezes).toBe(1);
    const full = applyStrike({ ...s, freezes: MAX_FREEZES }, '2026-10-07');
    expect(full.state.freezes).toBe(MAX_FREEZES);
  });
  it('tanggal mundur ditolak', () => {
    const s = applyStrike(initialStreak(), '2026-10-10').state;
    expect(applyStrike(s, '2026-10-05').outcome).toBe('invalid_date');
  });
  it('streak tampil 0 bila sudah putus', () => {
    const s = { ...initialStreak(), current: 4, lastDate: '2026-10-01', freezes: 0 };
    expect(effectiveStreak(s, '2026-10-02')).toBe(4);
    expect(effectiveStreak(s, '2026-10-05')).toBe(0);
  });
});

describe('streak grup', () => {
  const t = (d: number) => Date.UTC(2026, 9, d, 12, 0);
  it('lengkap hanya bila semua anggota strike di hari yang sama', () => {
    const a = applyGroupStrike(initialGroupStreak('UTC'), 'u1', ['u1', 'u2'], t(1));
    expect(a.justCompleted).toBe(false);
    const b = applyGroupStrike(a.state, 'u2', ['u1', 'u2'], t(1));
    expect(b.justCompleted).toBe(true);
    expect(b.state.current).toBe(1);
  });
  it('idempoten: strike ulang tidak menggandakan hadiah', () => {
    const done = applyGroupStrike(applyGroupStrike(initialGroupStreak('UTC'), 'u1', ['u1', 'u2'], t(1)).state, 'u2', ['u1', 'u2'], t(1)).state;
    const again = applyGroupStrike(done, 'u2', ['u1', 'u2'], t(1));
    expect(again.justCompleted).toBe(false);
    expect(again.state.current).toBe(1);
  });
  it('hari berurutan menambah, terlewat mereset', () => {
    let s = initialGroupStreak('UTC');
    for (const day of [1, 2]) {
      s = applyGroupStrike(s, 'u1', ['u1'], t(day)).state;
    }
    expect(s.current).toBe(2);
    s = applyGroupStrike(s, 'u1', ['u1'], t(5)).state;
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
    expect(effectiveGroupStreak(s, '2026-10-08')).toBe(0);
  });
});

describe('pet', () => {
  const now = Date.UTC(2026, 9, 28, 10, 0);
  const pet = newPet('mochi', 'Momo', now, '2026-10-28');
  it('statistik turun seiring waktu dan tidak di bawah 0', () => {
    expect(decayed(pet, now + 5 * 3_600_000).fullness).toBe(60);
    expect(decayed(pet, now + 1000 * 3_600_000).fullness).toBe(0);
  });
  it('memberi makan menambah kenyang dan XP, lalu terkena jeda', () => {
    const r = applyPetAction(pet, 'feed', now, '2026-10-28');
    expect(r.ok && r.state.fullness).toBe(100);
    expect(r.ok && r.xpGained).toBe(ACTIONS.feed.xp);
    if (!r.ok) throw new Error('harus ok');
    const again = applyPetAction(r.state, 'feed', now + 10 * 60_000, '2026-10-28');
    expect(again.ok).toBe(false);
  });
  it('XP aksi dibatasi per hari tetapi perawatan tetap berjalan', () => {
    const capped = { ...pet, xpToday: DAILY_ACTION_XP_CAP - 2, xpDay: '2026-10-28' };
    const r = applyPetAction(capped, 'play', now, '2026-10-28');
    expect(r.ok && r.xpGained).toBe(2);
    const full = applyPetAction({ ...capped, xpToday: DAILY_ACTION_XP_CAP }, 'clean', now, '2026-10-28');
    expect(full.ok && full.xpGained).toBe(0);
  });
  it('batas XP harian di-reset pada hari baru', () => {
    const old = { ...pet, xpToday: DAILY_ACTION_XP_CAP, xpDay: '2026-10-27' };
    const r = applyPetAction(old, 'feed', now, '2026-10-28');
    expect(r.ok && r.xpGained).toBe(ACTIONS.feed.xp);
  });
  it('level dan suasana hati', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(3))).toBe(3);
    expect(levelProgress(25).level).toBe(2);
    expect(moodOf({ ...pet, fullness: 10 })).toBe('hungry');
    expect(moodOf(pet)).toBe('happy');
  });
  it('parsePetState menolak data rusak', () => {
    expect(parsePetState(null)).toBeNull();
    expect(parsePetState({ species: 'naga', name: 'x' })).toBeNull();
    expect(parsePetState({ ...pet })).toEqual(pet);
  });
});

describe('achievement', () => {
  it('terbuka sesuai ambang', () => {
    expect(earnedAchievementIds({ totalDays: 0, streakLongest: 0, petLevel: 1, groupLongest: 0 })).toEqual([]);
    const ids = earnedAchievementIds({ totalDays: 10, streakLongest: 7, petLevel: 3, groupLongest: 7 });
    expect(ids).toEqual(expect.arrayContaining(['first_strike', 'streak_3', 'streak_7', 'pet_lvl_3', 'group_streak_7']));
    expect(ids.every((id) => ACHIEVEMENTS.some((a) => a.id === id))).toBe(true);
  });
});
