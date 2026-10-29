const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5c0-3.6 3.1-6 7-6s7 2.4 7 6',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3 2.7-5 6-5s6 2 6 5M16 4.5a3.5 3.5 0 0 1 0 6.5M18 15c2 .6 3 2.2 3 4.5',
  squad: 'M12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 20c0-3 3-5 7-5s7 2 7 5M4.5 11a2.5 2.5 0 1 0 0-5M19.5 11a2.5 2.5 0 1 0 0-5',
  paw: 'M7 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm4 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-2 3c-3 0-5.5 3-5.5 5.5 0 1.8 1.4 2.5 3 2.5 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.6 0 3-.7 3-2.5C17.5 14 15 11 12 11Z',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
  chat: 'M4 5h16v11H9l-5 4V5Z',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 21h4',
  shield: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .8-1 1.7M12 17h.01',
  palette: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.3-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4C21 6.8 17 3 12 3ZM7.5 11.5h.01M10 7.5h.01M14.5 7.5h.01',
  logout: 'M10 4H5.5v16H10M15 8l4 4-4 4M19 12H9',
  copy: 'M9 9h10v11H9zM5 15V4h10',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
