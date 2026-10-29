export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="STRIKE & PET">
      <defs>
        <linearGradient id="spg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5B3DF5" />
          <stop offset="1" stopColor="#8A5CFF" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#spg)" />
      <g fill="#fff">
        <circle cx="150" cy="205" r="42" />
        <circle cx="215" cy="150" r="44" />
        <circle cx="297" cy="150" r="44" />
        <circle cx="362" cy="205" r="42" />
        <ellipse cx="256" cy="330" rx="108" ry="92" />
      </g>
      <polygon points="278,262 220,338 254,338 236,402 304,312 268,312" fill="#FF7A59" />
    </svg>
  );
}
