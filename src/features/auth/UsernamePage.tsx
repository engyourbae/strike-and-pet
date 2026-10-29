import { useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { claimUsername, describeProfileError } from '@/features/profile/profile.service';
import { validateUsername } from '@/features/profile/username';
import { signOutUser } from './auth.service';

export function UsernamePage({ user }: { user: User }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const check = validateUsername(value);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await claimUsername(user, check.value); // AuthProvider otomatis pindah ke Beranda
    } catch (err) {
      setError(describeProfileError(err));
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <div className="center-card">
        <h1>Pilih username-mu</h1>
        <p>Temanmu akan mencarimu lewat @username. Username tidak bisa diganti sementara ini.</p>
        <form className="card" onSubmit={(e) => void onSubmit(e)} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <div className="input-prefix">
              <span aria-hidden="true">@</span>
              <input
                id="username" className="input" value={value} autoComplete="off" autoCapitalize="none" spellCheck={false}
                maxLength={21} aria-describedby="username-help" aria-invalid={Boolean(error)}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
              />
            </div>
            <p id="username-help" className="field-hint">3–20 karakter: huruf kecil, angka, garis bawah. Diawali huruf.</p>
            {error && <p className="field-error" role="alert">{error}</p>}
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Simpan username'}
          </button>
        </form>
        <button className="btn btn--ghost" onClick={() => void signOutUser()}>Ganti akun</button>
      </div>
    </div>
  );
}
