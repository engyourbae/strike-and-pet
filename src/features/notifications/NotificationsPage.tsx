import { Link } from 'react-router-dom';
import { useNotifications } from './NotificationsProvider';

const ICON: Record<string, string> = { friend: '👋', invite: '💌', message: '💬', streak: '🔥', pet: '🐾', location: '📍' };

export function NotificationsPage() {
  const { items } = useNotifications();
  return (
    <>
      <h1>Notifikasi</h1>
      {items.length === 0 ? (
        <div className="card"><p style={{ margin: 0 }}>Tidak ada notifikasi baru.</p></div>
      ) : (
        <ul className="list">
          {items.map((n) => (
            <li key={n.id}>
              <Link className="card chat-row" to={n.to} style={{ margin: 0, width: '100%' }}>
                <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>{ICON[n.kind]}</span>
                <span className="grow"><strong>{n.text}</strong></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="field-hint">Notifikasi muncul saat aplikasi terbuka. Push notification belum tersedia. Atur pengingat di Privasi &amp; notifikasi.</p>
    </>
  );
}
