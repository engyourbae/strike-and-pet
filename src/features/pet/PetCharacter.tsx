import type { Mood, Species } from '@/shared/petLogic';

export type Reaction = 'feed' | 'play' | 'clean' | null;

const COLOR: Record<Species, string> = { mochi: 'var(--color-primary)', bolt: 'var(--color-accent)', luna: 'var(--color-secondary)' };

const MOOD_LABEL: Record<Mood | 'sleep', string> = {
  happy: 'senang', idle: 'santai', hungry: 'lapar', dirty: 'kotor', sad: 'sedih', sleep: 'tidur',
};

export function moodLabel(m: Mood | 'sleep'): string {
  return MOOD_LABEL[m];
}

/** Karakter Pet (SVG) dengan animasi ringan per suasana hati; animasi dimatikan oleh prefers-reduced-motion. */
export function PetCharacter({ species, mood, reaction, size = 200 }: { species: Species; mood: Mood | 'sleep'; reaction: Reaction; size?: number }) {
  const fill = COLOR[species];
  const anim = reaction ? `pet-anim--${reaction}` : `pet-anim--${mood}`;
  const sleeping = mood === 'sleep';
  return (
    <svg className={`pet ${anim}`} width={size} height={size} viewBox="0 0 200 200" role="img" aria-label={`Pet ${species}, suasana ${MOOD_LABEL[mood]}`}>
      <ellipse cx="100" cy="182" rx="52" ry="8" fill="var(--border)" />
      {species === 'mochi' && <g fill={fill}><circle cx="62" cy="60" r="16" /><circle cx="138" cy="60" r="16" /></g>}
      {species === 'bolt' && <g fill={fill}><path d="M58 70 66 18 96 62Z" /><path d="M142 70 134 18 104 62Z" /></g>}
      {species === 'luna' && <g fill={fill}><path d="M52 78 56 28 92 62Z" /><path d="M148 78 144 28 108 62Z" /></g>}
      <ellipse cx="100" cy="116" rx={species === 'mochi' ? 66 : 58} ry={species === 'mochi' ? 58 : 60} fill={fill} />
      <ellipse cx="100" cy="134" rx="34" ry="26" fill="#fff" opacity="0.28" />
      {sleeping ? (
        <g stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none"><path d="M70 106q10 8 20 0" /><path d="M110 106q10 8 20 0" /></g>
      ) : mood === 'happy' ? (
        <g stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none"><path d="M70 110q10-12 20 0" /><path d="M110 110q10-12 20 0" /></g>
      ) : (
        <g fill="#fff"><circle cx="80" cy="106" r={mood === 'sad' ? 6 : 8} /><circle cx="120" cy="106" r={mood === 'sad' ? 6 : 8} /><circle cx="82" cy="104" r="3" fill="#161a33" /><circle cx="122" cy="104" r="3" fill="#161a33" /></g>
      )}
      {mood === 'hungry' ? <ellipse cx="100" cy="136" rx="9" ry="11" fill="#161a33" opacity="0.8" /> : null}
      {mood === 'sad' ? <path d="M88 140q12-10 24 0" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" /> : null}
      {(mood === 'happy' || mood === 'idle' || sleeping) && <path d="M88 132q12 10 24 0" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />}
      {mood === 'dirty' && <g fill="#6b4f3a" opacity="0.55"><circle cx="70" cy="140" r="6" /><circle cx="134" cy="128" r="5" /><circle cx="116" cy="150" r="4" /></g>}
      {sleeping && <text x="150" y="60" fontSize="22" fontWeight="800" fill="var(--text-2)">z</text>}
    </svg>
  );
}
