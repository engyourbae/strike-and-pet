export type Species = 'mochi' | 'bolt' | 'luna';
export type PetAction = 'feed' | 'play' | 'clean';
export type Mood = 'happy' | 'idle' | 'hungry' | 'dirty' | 'sad';

export const SPECIES_LIST: readonly { id: Species; label: string; blurb: string }[] = [
  { id: 'mochi', label: 'Mochi', blurb: 'Bulat, lembut, dan pemalas yang manis.' },
  { id: 'bolt', label: 'Bolt', blurb: 'Lincah dengan telinga runcing penuh energi.' },
  { id: 'luna', label: 'Luna', blurb: 'Tenang, penyayang, dan suka malam hari.' },
];

export interface PetState {
  species: Species;
  name: string;
  xp: number;
  fullness: number; // 0-100, makin tinggi makin baik
  joy: number;
  cleanliness: number;
  statsAtMs: number; // waktu terakhir statistik dihitung
  lastAction: Record<PetAction, number>;
  xpDay: string; // tanggal (YYYY-MM-DD) untuk batas XP harian
  xpToday: number;
}

export const DECAY_PER_HOUR = { fullness: 4, joy: 3, cleanliness: 2 } as const;
export const DAILY_ACTION_XP_CAP = 60;
export const NAME_MAX = 20;

export const ACTIONS: Record<PetAction, { label: string; cooldownMs: number; xp: number; effect: Partial<Record<'fullness' | 'joy' | 'cleanliness', number>> }> = {
  feed: { label: 'Beri makan', cooldownMs: 30 * 60_000, xp: 5, effect: { fullness: 30 } },
  play: { label: 'Main', cooldownMs: 20 * 60_000, xp: 8, effect: { joy: 30, fullness: -5, cleanliness: -5 } },
  clean: { label: 'Bersihkan', cooldownMs: 60 * 60_000, xp: 5, effect: { cleanliness: 40 } },
};

export function isSpecies(v: unknown): v is Species {
  return v === 'mochi' || v === 'bolt' || v === 'luna';
}
export function isPetAction(v: unknown): v is PetAction {
  return v === 'feed' || v === 'play' || v === 'clean';
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));

export type NameCheck = { ok: true; value: string } | { ok: false; error: string };
export function validatePetName(raw: string): NameCheck {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < 1) return { ok: false, error: 'Nama Pet wajib diisi.' };
  if (value.length > NAME_MAX) return { ok: false, error: `Nama Pet maksimal ${NAME_MAX} karakter.` };
  return { ok: true, value };
}

export function newPet(species: Species, name: string, nowMs: number, today: string): PetState {
  return {
    species, name, xp: 0, fullness: 80, joy: 80, cleanliness: 80, statsAtMs: nowMs,
    lastAction: { feed: 0, play: 0, clean: 0 }, xpDay: today, xpToday: 0,
  };
}

/** Statistik setelah waktu berlalu (turun perlahan, tidak pernah di bawah 0). */
export function decayed(p: PetState, nowMs: number): PetState {
  const hours = Math.max(0, nowMs - p.statsAtMs) / 3_600_000;
  return {
    ...p,
    fullness: clamp(p.fullness - DECAY_PER_HOUR.fullness * hours),
    joy: clamp(p.joy - DECAY_PER_HOUR.joy * hours),
    cleanliness: clamp(p.cleanliness - DECAY_PER_HOUR.cleanliness * hours),
    statsAtMs: Math.max(p.statsAtMs, nowMs),
  };
}

export function xpForLevel(level: number): number {
  return 20 * (level - 1) * (level - 1);
}
export function levelForXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 20)) + 1;
}
export function levelProgress(xp: number): { level: number; current: number; needed: number } {
  const level = levelForXp(xp);
  return { level, current: xp - xpForLevel(level), needed: xpForLevel(level + 1) - xpForLevel(level) };
}

export function cooldownLeftMs(p: PetState, action: PetAction, nowMs: number): number {
  return Math.max(0, p.lastAction[action] + ACTIONS[action].cooldownMs - nowMs);
}

export type ActionResult =
  | { ok: true; state: PetState; xpGained: number; leveledUp: boolean }
  | { ok: false; reason: 'cooldown'; retryAfterMs: number };

/** Perawatan tidak pernah diblokir oleh batas XP harian; hanya XP-nya yang dibatasi. */
export function applyPetAction(pet: PetState, action: PetAction, nowMs: number, today: string): ActionResult {
  const wait = cooldownLeftMs(pet, action, nowMs);
  if (wait > 0) return { ok: false, reason: 'cooldown', retryAfterMs: wait };

  const base = decayed(pet, nowMs);
  const def = ACTIONS[action];
  const xpToday = base.xpDay === today ? base.xpToday : 0;
  const xpGained = Math.max(0, Math.min(def.xp, DAILY_ACTION_XP_CAP - xpToday));
  const next: PetState = {
    ...base,
    fullness: clamp(base.fullness + (def.effect.fullness ?? 0)),
    joy: clamp(base.joy + (def.effect.joy ?? 0)),
    cleanliness: clamp(base.cleanliness + (def.effect.cleanliness ?? 0)),
    xp: base.xp + xpGained,
    lastAction: { ...base.lastAction, [action]: nowMs },
    xpDay: today,
    xpToday: xpToday + xpGained,
  };
  return { ok: true, state: next, xpGained, leveledUp: levelForXp(next.xp) > levelForXp(base.xp) };
}

export function moodOf(p: PetState): Mood {
  if (p.fullness < 30) return 'hungry';
  if (p.cleanliness < 30) return 'dirty';
  if (p.joy < 30) return 'sad';
  return p.joy >= 70 ? 'happy' : 'idle';
}

export function parsePetState(d: unknown): PetState | null {
  if (typeof d !== 'object' || d === null) return null;
  const r = d as Record<string, unknown>;
  const n = (k: string): number => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k] as number) : 0);
  if (!isSpecies(r.species) || typeof r.name !== 'string') return null;
  const la = typeof r.lastAction === 'object' && r.lastAction !== null ? (r.lastAction as Record<string, unknown>) : {};
  const t = (k: string): number => (typeof la[k] === 'number' ? (la[k] as number) : 0);
  return {
    species: r.species, name: r.name, xp: n('xp'),
    fullness: n('fullness'), joy: n('joy'), cleanliness: n('cleanliness'),
    statsAtMs: n('statsAtMs'),
    lastAction: { feed: t('feed'), play: t('play'), clean: t('clean') },
    xpDay: typeof r.xpDay === 'string' ? r.xpDay : '', xpToday: n('xpToday'),
  };
}
