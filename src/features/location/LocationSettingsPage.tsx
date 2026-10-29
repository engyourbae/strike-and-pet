import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAction } from '@/hooks/useAction';
import { HISTORY_RETENTION_DAYS, SESSION_RETENTION_HOURS } from '@/shared/locationLogic';
import type { UserProfile } from '@/types/user';
import { deleteSessionHistory, stopLocationSession } from './location.service';
import { useLocationShare } from './LocationShareProvider';
import { useLocationSessions } from './useLocationSessions';

const PERM_LABEL: Record<string, string> = {
  granted: 'Diizinkan: browser boleh membaca lokasi saat kamu memulai berbagi.',
  prompt: 'Belum diputuskan: browser akan bertanya saat kamu pertama kali berbagi.',
  denied: 'Ditolak: berbagi lokasi tidak bisa berjalan. Ubah di pengaturan situs browser.',
};

export function LocationSettingsPage({ me }: { me: UserProfile }) {
  const [perm, setPerm] = useState<string | null>(null);
  const share = useLocationShare();
  const { mineActive, mineEnded } = useLocationSessions(me.uid);
  const act = useAction();

  useEffect(() => {
    let status: PermissionStatus | null = null;
    const onChange = () => setPerm(status?.state ?? null);
    void navigator.permissions?.query({ name: 'geolocation' }).then((s) => { status = s; setPerm(s.state); s.addEventListener('change', onChange); }).catch(() => setPerm(null));
    return () => status?.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <h1>Pengaturan lokasi</h1>
      <section className="card">
        <h2>Izin browser</h2>
        <p>{perm ? (PERM_LABEL[perm] ?? perm) : 'Status izin tidak dapat dibaca di browser ini.'}</p>
        <p className="field-hint">Untuk mencabut izin, buka pengaturan situs di browser/OS. Berbagi akan berhenti otomatis bila izin dicabut.</p>
      </section>
      <section className="card">
        <h2>Cara kerja &amp; batasan</h2>
        <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
          <li>Lokasi tidak pernah dibagikan otomatis setelah login; selalu dimulai olehmu dengan durasi yang dipilih.</li>
          <li>PWA di browser hanya mengirim lokasi saat aplikasi terbuka. Tab di latar belakang, browser ditutup, atau mode hemat baterai dapat menghentikannya; teman akan melihat statusmu "tidak tersedia".</li>
          <li>Pembaruan dikirim adaptif (lebih jarang saat diam) untuk menghemat baterai dan biaya.</li>
          <li>Sesi tanpa riwayat dihapus otomatis setelah {SESSION_RETENTION_HOURS} jam; riwayat rute (jika kamu aktifkan) setelah {HISTORY_RETENTION_DAYS} hari.</li>
          <li>Peta memakai OpenStreetMap; koordinatmu tidak dikirim ke layanan peta.</li>
        </ul>
      </section>
      <section className="card">
        <h2>Kendali</h2>
        <div className="stack">
          <button className="btn btn--danger" disabled={act.busy || (share.state.phase !== 'sharing' && mineActive.length === 0)} onClick={() => void act.run(async () => {
            if (share.state.phase === 'sharing') await share.stop();
            for (const s of mineActive) await stopLocationSession(s.id);
          })}>Hentikan semua sesi aktif</button>
          <button className="btn btn--ghost" disabled={act.busy || mineEnded.length === 0} onClick={() => window.confirm(`Hapus ${mineEnded.length} sesi lama beserta riwayat rutenya?`) && void act.run(async () => { for (const s of mineEnded) await deleteSessionHistory(s.id); })}>Hapus semua riwayat sesi</button>
        </div>
        {act.error && <p className="field-error" role="alert">{act.error}</p>}
        <p className="field-hint" style={{ marginTop: 12 }}>Notifikasi saat teman mulai berbagi dapat dimatikan di <Link to="/pengaturan/privasi">Privasi &amp; notifikasi</Link>.</p>
      </section>
    </>
  );
}
