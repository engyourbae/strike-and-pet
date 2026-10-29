import { dateKey, diffDays, isDateKey } from './dates';

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7; // satu "hari istirahat" diperoleh tiap 7 hari berturut-turut
export const RECENT_DAYS_CAP = 120;
export const STRIKE_XP = 10;
export const GROUP_COMPLETE_XP = 20;

export interface StreakState {
  current: number;
  longest: number;
  totalDays: number;
  lastDate: string | null;
  freezes: number;
  recentDays: string[];
}

export function initialStreak(): StreakState {
  return { current: 0, longest: 0, totalDays: 0, lastDate: null, freezes: 0, recentDays: [] };
}

export type StrikeOutcome = 'counted' | 'already_done' | 'invalid_date';

export interface StrikeResult {
  outcome: StrikeOutcome;
  state: StreakState;
  usedFreeze: boolean;
  earnedFreeze: boolean;
  broke: boolean;
}

/**
 * Aturan streak pribadi:
 * - Satu strike per hari kalender (zona waktu perangkat saat strike).
 * - Hari berurutan menambah streak.
 * - Bila terlewat tepat 1 hari dan ada "hari istirahat", streak terjaga otomatis.
 * - Selain itu streak mulai lagi dari 1 (rekor terpanjang tetap tersimpan).
 */
export function applyStrike(state: StreakState, today: string): StrikeResult {
  if (state.lastDate === today) return { outcome: 'already_done', state, usedFreeze: false, earnedFreeze: false, broke: false };
  const gap = state.lastDate === null ? null : diffDays(state.lastDate, today);
  if (gap !== null && gap < 0) return { outcome: 'invalid_date', state, usedFreeze: false, earnedFreeze: false, broke: false };

  let current: number;
  let freezes = state.freezes;
  let usedFreeze = false;
  let broke = false;
  if (gap === null) current = 1;
  else if (gap === 1) current = state.current + 1;
  else if (gap === 2 && freezes > 0) {
    freezes -= 1;
    usedFreeze = true;
    current = state.current + 1;
  } else {
    broke = state.current > 1;
    current = 1;
  }

  let earnedFreeze = false;
  if (current % FREEZE_EVERY === 0 && freezes < MAX_FREEZES) {
    freezes += 1;
    earnedFreeze = true;
  }

  const recentDays = [...state.recentDays, today].slice(-RECENT_DAYS_CAP);
  return {
    outcome: 'counted',
    state: { current, longest: Math.max(state.longest, current), totalDays: state.totalDays + 1, lastDate: today, freezes, recentDays },
    usedFreeze,
    earnedFreeze,
    broke,
  };
}

/** Streak yang ditampilkan: 0 bila sudah putus dan tidak bisa diselamatkan hari istirahat. */
export function effectiveStreak(s: StreakState, today: string): number {
  if (!s.lastDate) return 0;
  const gap = diffDays(s.lastDate, today);
  if (gap <= 1) return s.current;
  if (gap === 2 && s.freezes > 0) return s.current;
  return 0;
}

export function struckToday(s: StreakState, today: string): boolean {
  return s.lastDate === today;
}

function asRecord(d: unknown): Record<string, unknown> | null {
  return typeof d === 'object' && d !== null ? (d as Record<string, unknown>) : null;
}
function num(r: Record<string, unknown>, k: string): number {
  const v = r[k];
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

export function parseStreakState(d: unknown): StreakState | null {
  const r = asRecord(d);
  if (!r) return null;
  const days = Array.isArray(r.recentDays) ? r.recentDays.filter(isDateKey) : [];
  return {
    current: num(r, 'current'),
    longest: num(r, 'longest'),
    totalDays: num(r, 'totalDays'),
    lastDate: isDateKey(r.lastDate) ? r.lastDate : null,
    freezes: num(r, 'freezes'),
    recentDays: days,
  };
}

// ---------- Streak grup (Duo/Squad) ----------

export interface GroupStreakState {
  tz: string; // zona waktu penentu pergantian hari grup (zona anggota pertama yang strike)
  current: number;
  longest: number;
  lastCompleteDate: string | null;
  dayDate: string | null;
  dayUids: string[];
}

export function initialGroupStreak(tz: string): GroupStreakState {
  return { tz, current: 0, longest: 0, lastCompleteDate: null, dayDate: null, dayUids: [] };
}

export interface GroupStrikeResult {
  state: GroupStreakState;
  justCompleted: boolean;
}

/** Hari grup dihitung lengkap bila SEMUA anggota saat ini sudah strike pada hari (zona waktu grup) yang sama. Idempoten. */
export function applyGroupStrike(state: GroupStreakState, uid: string, memberUids: string[], nowMs: number): GroupStrikeResult {
  const today = dateKey(nowMs, state.tz);
  let dayUids = state.dayDate === today ? state.dayUids : [];
  if (!dayUids.includes(uid)) dayUids = [...dayUids, uid];
  const complete = memberUids.length > 0 && memberUids.every((m) => dayUids.includes(m));

  let { current, longest, lastCompleteDate } = state;
  let justCompleted = false;
  if (complete && lastCompleteDate !== today) {
    current = lastCompleteDate !== null && diffDays(lastCompleteDate, today) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    lastCompleteDate = today;
    justCompleted = true;
  }
  return { state: { tz: state.tz, current, longest, lastCompleteDate, dayDate: today, dayUids }, justCompleted };
}

export function effectiveGroupStreak(g: GroupStreakState, today: string): number {
  if (!g.lastCompleteDate) return 0;
  return diffDays(g.lastCompleteDate, today) <= 1 ? g.current : 0;
}

export function parseGroupStreak(d: unknown): GroupStreakState | null {
  const r = asRecord(d);
  if (!r || typeof r.tz !== 'string') return null;
  return {
    tz: r.tz,
    current: num(r, 'current'),
    longest: num(r, 'longest'),
    lastCompleteDate: isDateKey(r.lastCompleteDate) ? r.lastCompleteDate : null,
    dayDate: isDateKey(r.dayDate) ? r.dayDate : null,
    dayUids: Array.isArray(r.dayUids) ? r.dayUids.filter((x): x is string => typeof x === 'string') : [],
  };
}
