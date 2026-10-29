import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { collection, doc, limit, orderBy, query } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useNow } from '@/hooks/useNow';
import { useProfiles } from '@/hooks/useProfiles';
import { distanceOfPath, formatAge, formatSpeed, sessionStatus, type SessionStatus } from '@/shared/locationLogic';
import type { UserProfile } from '@/types/user';
import { LiveMap, type MapMarker } from './LiveMap';
import { useLocationShare } from './LocationShareProvider';
import { parseSession } from './mappers';
import { useSessionLive } from './useSessionLive';

const STATUS_LABEL: Record<SessionStatus, string> = {
  live: 'Aktif (real-time)',
  waiting: 'Menunggu lokasi pertama',
  unavailable: 'Tidak tersedia, menampilkan lokasi terakhir (bukan real-time)',
  stopped: 'Berhenti',
  expired: 'Kedaluwarsa',
};

interface Point { lat: number; lng: number; ts: number }

export function LocationSessionPage({ me }: { me: UserProfile }) {
  const { sid = '' } = useParams();
  const share = useLocationShare();
  const now = useNow(5000);
  const session = useLiveDoc(`ls:${sid}`, () => doc(getFirebase().db, 'locationSessions', sid), (d) => parseSession(sid, d));
  const s = session.data;
  const isOwner = s?.ownerUid === me.uid;
  const live = useSessionLive(s && s.status === 'active' ? sid : null);
  const owner = useProfiles(s ? [s.ownerUid] : [])[s?.ownerUid ?? ''];
  const points = useLiveQuery(
    isOwner && s?.historyEnabled ? `pts:${sid}` : null,
    () => query(collection(getFirebase().db, 'locationSessions', sid, 'points'), orderBy('ts', 'asc'), limit(500)),
    (_id, d): Point | null => (typeof d.lat === 'number' && typeof d.lng === 'number' ? { lat: d.lat, lng: d.lng, ts: d.ts instanceof Timestamp ? d.ts.toMillis() : 0 } : null),
  );

  const status: SessionStatus | null = s
    ? s.status !== 'active' ? s.status : sessionStatus({
        active: live.meta?.active ?? null,
        expiresAtMs: live.meta?.expiresAtMs ?? s.expiresAtMs,
        lastTsMs: live.pos?.tsMs ?? null,
        connOnline: live.conn?.online ?? null,
        nowMs: now,
      })
    : null;

  const pos = status === 'live' || status === 'unavailable' ? live.pos : null;
  const markers = useMemo<MapMarker[]>(
    () => (pos && s ? [{ id: s.ownerUid, lat: pos.lat, lng: pos.lng, accuracy: pos.acc, label: owner?.displayName ?? '?', photoURL: owner?.photoURL ?? null, stale: status !== 'live' }] : []),
    [pos, s, owner, status],
  );
  const track = useMemo<[number, number][]>(() => points.data.map((p) => [p.lat, p.lng]), [points.data]);

  if (session.loading) return <Skeleton height={320} />;
  if (!s || !status) {
    return (
      <>
        <h1>Sesi tidak ditemukan</h1>
        <p>Sesi ini tidak ada atau kamu tidak berhak melihatnya.</p>
        <Link className="btn btn--primary" to="/lokasi">Kembali</Link>
      </>
    );
  }

  const sharingThis = share.state.info?.sessionId === sid;
  const ended = status === 'stopped' || status === 'expired';
  const speedNote = pos?.speed == null ? 'Kecepatan tidak tersedia' : `${formatSpeed(pos.speed)} · ${pos.src === 'gps' ? 'dari GPS' : 'estimasi dari perubahan posisi'} · ${pos.trust ? 'dapat dipercaya' : 'kurang dapat dipercaya'}`;

  return (
    <>
      <p><Link to="/lokasi">← Live Location</Link></p>
      <h1>{isOwner ? 'Lokasimu' : (owner?.displayName ?? '…')}</h1>
      <p>{s.groupName} · {STATUS_LABEL[status]}</p>

      {ended ? (
        <div className="card"><p style={{ margin: 0 }}>{isOwner && s.historyEnabled ? 'Sesi sudah berakhir. Lokasi real-time tidak lagi tersedia; rute tersimpan ditampilkan di bawah.' : 'Sesi sudah berakhir. Lokasi tidak lagi dibagikan.'}</p></div>
      ) : live.available === false ? (
        <div className="card"><p style={{ margin: 0 }}>Realtime Database belum dikonfigurasi, sehingga lokasi tidak bisa ditampilkan.</p></div>
      ) : null}

      {(markers.length > 0 || track.length > 1) && <LiveMap markers={markers} track={track} />}
      {!ended && markers.length === 0 && live.loaded && <div className="card"><p style={{ margin: 0 }}>{status === 'waiting' ? 'Menunggu lokasi pertama dari pengirim…' : live.denied ? 'Lokasi tidak lagi dapat dibaca (sesi berakhir).' : 'Belum ada lokasi.'}</p></div>}

      {pos && (
        <section className="card" aria-label="Detail lokasi">
          {status === 'unavailable' && <p className="field-error" role="status">Lokasi ini <strong>bukan real-time</strong>: pengirim offline atau berhenti memperbarui.</p>}
          <ul className="list field-hint" style={{ display: 'block' }}>
            <li>Diperbarui: {formatAge(now - pos.tsMs)}</li>
            <li>Akurasi GPS: {pos.acc !== null ? `±${Math.round(pos.acc)} m` : 'tidak diketahui'}</li>
            <li>Kecepatan: {speedNote}</li>
            <li>Maksimum sesi: {formatSpeed(pos.max)} · rata-rata bacaan valid: {formatSpeed(pos.avg)}</li>
            <li>Koordinat: {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}</li>
          </ul>
          <p className="field-hint">Kecepatan adalah informasi situasional dan perkiraan, bukan alat ukur tersertifikasi. Jangan menggunakan ponsel saat mengemudi.</p>
        </section>
      )}

      {isOwner && s.historyEnabled && track.length > 1 && (
        <section className="card" aria-label="Riwayat rute">
          <h2>Riwayat rute</h2>
          <p style={{ margin: 0 }}>{points.data.length} titik · jarak sekitar {(distanceOfPath(points.data) / 1000).toFixed(2)} km</p>
        </section>
      )}

      {isOwner && !ended && (
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {sharingThis
            ? <button className="btn btn--danger" onClick={() => void share.stop()}>Hentikan berbagi</button>
            : <button className="btn btn--primary" onClick={() => share.resume(s)}>Lanjutkan berbagi</button>}
        </div>
      )}
      <p className="field-hint" style={{ marginTop: 16 }}>Peta © kontributor OpenStreetMap. Hanya ubin peta yang diminta dari openstreetmap.org; koordinat anggota tidak dikirim ke layanan peta.</p>
    </>
  );
}
