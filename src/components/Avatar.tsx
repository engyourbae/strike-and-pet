export function Avatar({ name, src, size = 56 }: { name: string; src: string | null; size?: number }) {
  if (src) {
    return <img className="avatar" src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
