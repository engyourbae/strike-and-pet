import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { OfflineFallback } from '@/components/OfflineFallback';
import { describeAuthError, signInWithGoogle } from './auth.service';

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-page">
      <div className="center-card">
        <Logo size={72} />
        <h1 style={{ marginTop: 16 }}>Masuk ke STRIKE &amp; PET</h1>
        <p>Gunakan akun Google. Kami hanya menyimpan nama, foto, dan username profilmu.</p>
        <button className="btn btn--primary btn--block" onClick={() => void onLogin()} disabled={busy}>
          {busy ? 'Membuka Google…' : 'Lanjutkan dengan Google'}
        </button>
        {error && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <div style={{ marginTop: 12 }}><OfflineFallback what="Login" /></div>
        <p className="field-hint" style={{ marginTop: 12 }}>Dengan masuk, kamu menyetujui <Link to="/syarat">Syarat Penggunaan</Link> dan <Link to="/kebijakan-privasi">Kebijakan Privasi</Link>. <Link to="/bantuan">Bantuan</Link></p>
      </div>
    </div>
  );
}
