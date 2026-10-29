import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/Skeleton';
import { useAction } from '@/hooks/useAction';
import { useNow } from '@/hooks/useNow';
import { useProfiles } from '@/hooks/useProfiles';
import { getRtdb } from '@/lib/firebase/rtdb';
import { formatAge, formatSpeed } from '@/shared/locationLogic';
import type { UserProfile } from '@/types/user';
import { deleteSessionHistory, stopLocationSession } from './location.service';
import { useLocationShare } from './LocationShareProvider';
import { StartShareDialog } from './StartShareDialog';
import { useLocationSessions } from './useLocationSessions';

const fmtDate = (ms: number | null) => (ms ? new Date(ms).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export function LocationPage({ me }: { me: UserProfile }) {
  const share = useLocationShare();
  const { othersActive, mineActive, mineEnded, loading, error } = useLocationSessions(me.uid);
  const owners = useProfiles(othersActive.map((s) => s.ownerUid));
  const act = useAction();
  const now = useNow(5000);
  const [starting, setStarting] = useState(false);
  const { state } = share;
  const rtdbReady = getRtdb() !== null;
  const sharingHere = state.phase === 'sharing' ? state.info : null;
  const orphan = mineActive.find((s) => s.id !== sharingHere?.sessionId); // aktif di server tetapi tidak berjalan di perangkat ini

  return (
    <>
      <h1>Live Location</h1>
      {starting && <StartShareDialog me={me} onClose={() => setStarting(false)} />}
      {!rtdbReady && (
        <div className="card"><p style={{ margin: 0 }}>Fitur ini membutuhkan Realtime Database. Isi <code>VITE_FIREBASE_DATABASE_URL</code> (lihat README).</p></div>
      )}

      <section className="card" aria-labelledby="h-share">
        <h2 id="h-share">Berbagi lokasimu</h2>
        {sharingHere ? (
          <>
            <p><strong>Sedang berbagi</strong> ke {sharingHere.groupName}. Berakhir {fmtDate(sharingHere.expiresAtMs)}.</p>
            <p className="field-hint">
              Akurasi {state.accuracy !== null ? `±${Math.round(state.accuracy)} m` : '—'} · kecepatan {formatSpeed(state.reading?.mps)}
              {state.reading?.source === 'estimated' ? ' (estimasi)' : ''} · maks {formatSpeed(state.maxMps)} · rata-rata {formatSpeed(state.avgMps)}
              {state.lastPublishMs ? ` · terkirim ${formatAge(now - state.lastPublishMs)}` : ''}
            </p>
            {state.warning && <p className="field-hint" role="status">{state.warning}</p>}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Link className="btn btn--ghost" to={`/lokasi/${sharingHere.sessionId}`}>Lihat peta</Link>
              <button className="btn btn--danger" onClick={() => void share.stop()}>Hentikan berbagi</button>
            </div>
          </>
        ) : orphan ? (
          <>
            <p>Sesi ke {orphan.groupName} masih aktif di server, tetapi tidak berjalan di perangkat ini. Teman melihat lokasimu <strong>tidak tersedia</strong> sampai kamu melanjutkan.</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn--primary" onClick={() => share.resume(orphan)}>Lanjutkan berbagi</button>
              <button className="btn btn--danger" disabled={act.busy} onClick={() => void act.run(async () => { await stopLocationSession(orphan.id); })}>Hentikan sesi</button>
            </div>
            {act.error && <p className="field-error" role="alert">{act.error}</p>}
          </>
        ) : (
          <>
            <p>Lokasimu tidak dibagikan. Berbagi hanya dimulai atas tindakanmu, dengan durasi yang kamu pilih.</p>
            <button className="btn btn--primary" disabled={!rtdbReady || !share.supported} onClick={() => setStarting(true)}>Mulai berbagi lokasi</button>
          </>
        )}
        {state.error && !sharingHere && <p className="field-error" role="alert">{state.error}</p>}
      </section>

      <section className="card" aria-labelledby="h-others">
        <h2 id="h-others">Sedang berbagi denganmu</h2>
        {loading ? <Skeleton height={56} /> : error ? <p className="field-error" role="alert">{error}</p> : othersActive.length === 0 ? (
          <p style={{ margin: 0 }}>Tidak ada teman yang sedang berbagi lokasi.</p>
        ) : (
          <ul className="list">
            {othersActive.map((s) => (
              <li key={s.id}>
                <Link className="card chat-row" to={`/lokasi/${s.id}`} style={{ margin: 0, width: '100%' }}>
                  <span aria-hidden="true">📍</span>
                  <span className="grow"><strong>{owners[s.ownerUid]?.displayName ?? '…'}</strong><span className="field-hint">{s.groupName} · berakhir {fmtDate(s.expiresAtMs)}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="h-hist">
        <h2 id="h-hist">Sesi sebelumnya</h2>
        {mineEnded.length === 0 ? <p style={{ margin: 0 }}>Belum ada sesi yang berakhir.</p> : (
          <ul className="list">
            {mineEnded.map((s) => (
              <li key={s.id}>
                <span className="grow"><strong>{s.groupName}</strong><span className="field-hint">{fmtDate(s.startedAtMs)} · {s.status === 'expired' ? 'kedaluwarsa' : 'dihentikan'} · {s.historyEnabled ? 'riwayat rute disimpan' : 'tanpa riwayat'}</span></span>
                {s.historyEnabled && <Link className="btn btn--ghost btn--sm" to={`/lokasi/${s.id}`}>Lihat rute</Link>}
                <button className="btn btn--danger btn--sm" disabled={act.busy} onClick={() => window.confirm('Hapus sesi ini beserta riwayat rutenya?') && void act.run(() => deleteSessionHistory(s.id))}>Hapus</button>
              </li>
            ))}
          </ul>
        )}
        <p className="field-hint">Sesi tanpa riwayat dihapus otomatis setelah 24 jam; riwayat rute setelah 7 hari. <Link to="/pengaturan/lokasi">Pengaturan lokasi</Link></p>
        {act.error && <p className="field-error" role="alert">{act.error}</p>}
      </section>
    </>
  );
}
