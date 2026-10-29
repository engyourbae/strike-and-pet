import { Link } from 'react-router-dom';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { useInbox } from '@/features/social/InboxProvider';

export function MorePage() {
  const { items } = useNotifications();
  const { requests, invitations } = useInbox();
  const links: { to: string; label: string; badge?: number }[] = [
    { to: '/notifikasi', label: 'Notifikasi', badge: items.length },
    { to: '/lokasi', label: 'Live Location' },
    { to: '/story', label: 'Story' },
    { to: '/teman', label: 'Teman', badge: requests.length },
    { to: '/grup', label: 'Duo & Squad', badge: invitations.length },
    { to: '/media-lokal', label: 'Media lokal' },
    { to: '/pengaturan/penyimpanan', label: 'Penyimpanan' },
    { to: '/profil', label: 'Profil' },
    { to: '/pengaturan/privasi', label: 'Privasi & notifikasi' },
    { to: '/pengaturan/lokasi', label: 'Pengaturan lokasi' },
    { to: '/pengaturan/tema', label: 'Tema' },
    { to: '/pengaturan/akun', label: 'Akun (ekspor & hapus)' },
    { to: '/bantuan', label: 'Bantuan' },
    { to: '/kebijakan-privasi', label: 'Kebijakan Privasi' },
    { to: '/syarat', label: 'Syarat Penggunaan' },
    { to: '/offline', label: 'Mode offline' },
  ];
  return (
    <>
      <h1>Lainnya</h1>
      <ul className="list">
        {links.map((l) => (
          <li key={l.to}>
            <Link className="card chat-row" to={l.to} style={{ margin: 0, width: '100%' }}>
              <span className="grow"><strong>{l.label}</strong></span>
              {l.badge ? <span className="badge" style={{ position: 'static' }}>{l.badge}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
