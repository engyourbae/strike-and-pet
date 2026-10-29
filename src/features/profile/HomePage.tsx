import { useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Link } from 'react-router-dom';
import type { UserProfile } from '@/types/user';

export function HomePage({ profile }: { profile: UserProfile }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`@${profile.username}`);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  }

  return (
    <>
      <h1>Halo, {profile.displayName}</h1>
      <div className="card">
        <div className="row">
          <Avatar name={profile.displayName} src={profile.photoURL} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>@{profile.username}</strong>
            <p style={{ margin: 0 }}>Bagikan username ini agar teman bisa menemukanmu.</p>
          </div>
        </div>
        <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => void copy()}>
          <Icon name="copy" size={18} /> Salin @{profile.username}
        </button>
        <p className="field-hint" role="status" style={{ marginTop: 8 }}>
          {copied === 'ok' && 'Tersalin.'}
          {copied === 'fail' && 'Tidak bisa menyalin otomatis. Salin secara manual.'}
        </p>
      </div>
      <div className="card">
        <h2>Pintasan</h2>
        <ul className="list">
          <li><Link to="/chat">Chat</Link></li>
          <li><Link to="/story">Story</Link></li>
          <li><Link to="/lokasi">Live Location</Link></li>
          <li><Link to="/pet">Rawat Pet</Link></li>
          <li><Link to="/strike">Catat strike hari ini</Link></li>
          <li><Link to="/profil">Profil</Link></li>
          <li><Link to="/pengaturan/tema">Tema tampilan</Link></li>
        </ul>
        <p className="field-hint" style={{ marginTop: 12 }}>Push notification belum tersedia di versi ini.</p>
      </div>
    </>
  );
}
