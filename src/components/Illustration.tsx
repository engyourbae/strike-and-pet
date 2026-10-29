export type IllustrationKind = 'pet' | 'friends' | 'places';

export function Illustration({ kind }: { kind: IllustrationKind }) {
  return (
    <svg viewBox="0 0 240 160" width="100%" style={{ maxWidth: 280 }} role="img" aria-hidden="true">
      <rect x="10" y="10" width="220" height="140" rx="32" fill="var(--surface-2)" />
      {kind === 'pet' && (
        <g>
          <ellipse cx="120" cy="100" rx="42" ry="34" fill="var(--color-primary)" />
          <circle cx="120" cy="64" r="26" fill="var(--color-primary)" />
          <circle cx="110" cy="62" r="4" fill="#fff" />
          <circle cx="130" cy="62" r="4" fill="#fff" />
          <path d="M112 74q8 7 16 0" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M100 42l6 12M140 42l-6 12" stroke="var(--color-accent)" strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
      {kind === 'friends' && (
        <g>
          <circle cx="98" cy="80" r="32" fill="var(--color-primary)" />
          <circle cx="142" cy="80" r="32" fill="var(--color-secondary)" opacity="0.9" />
          <path d="M120 66l4 9 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1z" fill="#fff" />
        </g>
      )}
      {kind === 'places' && (
        <g>
          <path d="M120 38c-20 0-34 15-34 33 0 24 34 52 34 52s34-28 34-52c0-18-14-33-34-33Z" fill="var(--color-accent)" />
          <circle cx="120" cy="71" r="12" fill="#fff" />
          <path d="M60 128h120" stroke="var(--border)" strokeWidth="6" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
