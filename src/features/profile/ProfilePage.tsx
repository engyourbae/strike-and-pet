import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { signOutUser } from '@/features/auth/auth.service';
import type { UserProfile } from '@/types/user';
import { describeProfileError, updateProfileText } from './profile.service';

export function ProfilePage({ profile }: { profile: UserProfile }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await updateProfileText(profile.uid, displayName, bio);
      setMsg({ kind: 'ok', text: 'Profil tersimpan.' });
    } catch (err) {
      setMsg({ kind: 'error', text: describeProfileError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Profil</h1>
      <form className="card" onSubmit={(e) => void onSave(e)}>
        <div className="row" style={{ marginBottom: 16 }}>
          <Avatar name={profile.displayName} src={profile.photoURL} size={64} />
          <strong>@{profile.username}</strong>
        </div>
        <div className="field">
          <label htmlFor="displayName">Nama tampilan</label>
          <input id="displayName" className="input" value={displayName} maxLength={50} required onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="bio">Bio</label>
          <textarea id="bio" className="input" value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} />
          <p className="field-hint">{bio.length}/160</p>
        </div>
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
        {msg && <p className={msg.kind === 'ok' ? 'field-hint' : 'field-error'} role="status" style={{ marginTop: 12 }}>{msg.text}</p>}
      </form>
      <button className="btn btn--ghost" onClick={() => void signOutUser()}><Icon name="logout" size={18} /> Keluar</button>
    </>
  );
}
