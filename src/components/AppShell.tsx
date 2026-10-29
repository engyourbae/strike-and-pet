import { NavLink, Outlet } from 'react-router-dom';
import { useChat } from '@/features/chat/ChatProvider';
import { useNotifications } from '@/features/notifications/NotificationsProvider';
import { useInbox } from '@/features/social/InboxProvider';
import { ShareIndicator } from '@/features/location/ShareIndicator';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';

interface Item { to: string; label: string; icon: IconName; end?: boolean; badge?: number; show?: 'desktop' | 'mobile' }

function Links({ items }: { items: Item[] }) {
  return (
    <>
      {items.map((i) => (
    <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => `navlink${isActive ? ' active' : ''}`}>
      <Icon name={i.icon} />
      <span>{i.label}</span>
      {i.badge ? <span className="badge" aria-label={`${i.badge} baru`}>{i.badge}</span> : null}
    </NavLink>
      ))}
    </>
  );
}

export function AppShell() {
  const { requests, invitations } = useInbox();
  const { unreadCount } = useChat();
  const { items: notifs } = useNotifications();
  const moreBadge = notifs.filter((n) => n.kind !== 'message').length;
  const items: Item[] = [
    { to: '/', label: 'Beranda', icon: 'home', end: true },
    { to: '/chat', label: 'Chat', icon: 'chat', badge: unreadCount },
    { to: '/pet', label: 'Pet', icon: 'paw' },
    { to: '/strike', label: 'Strike', icon: 'bolt' },
    { to: '/lokasi', label: 'Lokasi', icon: 'pin', show: 'desktop' },
    { to: '/story', label: 'Story', icon: 'image', show: 'desktop' },
    { to: '/teman', label: 'Teman', icon: 'users', badge: requests.length, show: 'desktop' },
    { to: '/grup', label: 'Grup', icon: 'squad', badge: invitations.length, show: 'desktop' },
    { to: '/notifikasi', label: 'Notifikasi', icon: 'bell', badge: notifs.length, show: 'desktop' },
    { to: '/profil', label: 'Profil', icon: 'user', show: 'desktop' },
    { to: '/media-lokal', label: 'Media lokal', icon: 'image', show: 'desktop' },
    { to: '/pengaturan/penyimpanan', label: 'Penyimpanan', icon: 'shield', show: 'desktop' },
    { to: '/pengaturan/privasi', label: 'Privasi', icon: 'shield', show: 'desktop' },
    { to: '/pengaturan/tema', label: 'Tema', icon: 'palette', show: 'desktop' },
    { to: '/pengaturan/akun', label: 'Akun', icon: 'user', show: 'desktop' },
    { to: '/bantuan', label: 'Bantuan', icon: 'help', show: 'desktop' },
    { to: '/lainnya', label: 'Lainnya', icon: 'more', badge: moreBadge, show: 'mobile' },
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><Logo size={36} /> STRIKE &amp; PET</div>
        <nav aria-label="Navigasi utama" style={{ display: 'grid', gap: 4 }}><Links items={items.filter((i) => i.show !== 'mobile')} /></nav>
      </aside>
      <main className="main"><ShareIndicator /><Outlet /></main>
      <nav className="bottom-nav" aria-label="Navigasi utama"><Links items={items.filter((i) => i.show !== 'desktop')} /></nav>
    </div>
  );
}
