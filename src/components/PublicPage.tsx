import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';

/** Pembungkus halaman yang bisa dibuka tanpa login (bantuan, kebijakan, syarat). */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="main" style={{ paddingBottom: 48 }}>
      <p className="brand"><Logo size={32} /> STRIKE &amp; PET</p>
      {children}
      <p><Link to="/masuk">← Kembali ke halaman masuk</Link></p>
    </div>
  );
}
