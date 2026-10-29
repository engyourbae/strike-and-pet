import { useNow } from '@/hooks/useNow';
import { useLocationShare } from './LocationShareProvider';

/** Indikator jelas selama lokasi dibagikan; tampil di semua halaman aplikasi. */
export function ShareIndicator() {
  const { state, stop } = useLocationShare();
  const now = useNow(30_000);
  if (state.phase !== 'sharing' || !state.info) return null;
  const left = Math.max(0, Math.round((state.info.expiresAtMs - now) / 60_000));
  return (
    <div className="share-bar" role="status" aria-live="polite">
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>📍 Kamu sedang berbagi lokasi</strong>
        <span className="share-sub">{state.info.groupName} · berakhir dalam {left} menit{!state.connected ? ' · offline' : ''}</span>
        {state.warning && <span className="share-sub">{state.warning}</span>}
        <span className="share-sub">Jangan menggunakan ponsel saat mengemudi.</span>
      </div>
      <button className="btn btn--sm share-stop" onClick={() => void stop()}>Hentikan</button>
    </div>
  );
}
