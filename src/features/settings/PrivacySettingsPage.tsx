import { Link } from 'react-router-dom';
import { useSettings, type UserSettings } from '@/app/SettingsProvider';
import { useAction } from '@/hooks/useAction';
import { getRtdb } from '@/lib/firebase/rtdb';
import { PushSettingsCard } from '@/features/push/PushSettingsCard';
import { useAuth } from '@/app/AuthProvider';

const ROWS: { key: keyof UserSettings; label: string; hint: string }[] = [
  { key: 'readReceipts', label: 'Tanda sudah dibaca', hint: 'Teman di chat pribadi bisa melihat bahwa kamu sudah membaca pesannya. Jika dimatikan, kamu tidak mengirim tanda itu.' },
  { key: 'showOnline', label: 'Tampilkan status online & terakhir aktif', hint: 'Mati secara default. Jika dimatikan, statusmu tidak dipublikasikan sama sekali.' },
  { key: 'notifyMessages', label: 'Notifikasi pesan baru', hint: 'Tampil di halaman Notifikasi saat ada pesan belum dibaca (chat yang dibisukan tidak ikut).' },
  { key: 'notifyLocation', label: 'Notifikasi saat teman berbagi lokasi', hint: 'Satu notifikasi per sesi aktif, tanpa pembaruan berulang.' },
  { key: 'remindStreak', label: 'Pengingat streak', hint: 'Mengingatkan bila streak hari ini belum dicatat.' },
  { key: 'remindPet', label: 'Pengingat perawatan Pet', hint: 'Mengingatkan bila Pet lapar, kotor, atau sedih.' },
];

export function PrivacySettingsPage() {
  const { settings, update } = useSettings();
  const { busy, error, run } = useAction();
  const rtdbReady = getRtdb() !== null;
  const auth = useAuth();
  return (
    <>
      <h1>Privasi &amp; notifikasi</h1>
      <section className="card">
        <ul className="list">
          {ROWS.map((r) => (
            <li key={r.key}>
              <label className="switch-row" style={{ width: '100%' }}>
                <span className="grow"><strong>{r.label}</strong><span className="field-hint">{r.hint}</span></span>
                <input type="checkbox" role="switch" checked={settings[r.key]} disabled={busy} aria-label={r.label} onChange={(e) => void run(() => update({ [r.key]: e.target.checked }))} />
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="field-error" role="alert">{error}</p>}
        {!rtdbReady && <p className="field-hint">Status online dan indikator mengetik membutuhkan Realtime Database (isi VITE_FIREBASE_DATABASE_URL).</p>}
      </section>
      {auth.status === 'ready' && <PushSettingsCard />}
      <section className="card">
        <h2>Pengguna diblokir</h2>
        <p style={{ margin: 0 }}>Kelola di <Link to="/teman">tab Teman</Link>.</p>
      </section>
    </>
  );
}
