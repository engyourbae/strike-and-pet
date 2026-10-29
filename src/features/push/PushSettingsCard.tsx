import { useState } from 'react';
import { useAction } from '@/hooks/useAction';
import { disablePush, enablePush, pushStatus, type PushStatus } from './push.service';

const TEXT: Record<PushStatus, string> = {
  unsupported: 'Browser atau perangkat ini tidak mendukung notifikasi. Di iPhone/iPad, pasang aplikasi ke layar utama (iOS 16.4+).',
  denied: 'Izin notifikasi ditolak di browser. Ubah di pengaturan situs untuk mengaktifkannya.',
  enabled: 'Notifikasi aktif di perangkat ini.',
  disabled: 'Notifikasi belum aktif di perangkat ini.',
};

/** Menjelaskan manfaat dulu; izin baru diminta setelah tombol ditekan. */
export function PushSettingsCard() {
  const [status, setStatus] = useState<PushStatus>(() => pushStatus());
  const { busy, error, run } = useAction();

  return (
    <section className="card" aria-labelledby="h-push">
      <h2 id="h-push">Notifikasi perangkat</h2>
      <p>Tampilkan pemberitahuan pesan baru, permintaan teman, undangan grup, dan teman yang mulai berbagi lokasi saat aplikasi berjalan di latar belakang. Isi pesan tidak ditampilkan di notifikasi.</p>
      <p className="field-hint">{TEXT[status]}</p>
      {status === 'disabled' && <button className="btn btn--primary" disabled={busy} onClick={() => void run(async () => { await enablePush(); setStatus(pushStatus()); })}>Aktifkan di perangkat ini</button>}
      {status === 'enabled' && <button className="btn btn--ghost" disabled={busy} onClick={() => { disablePush(); setStatus(pushStatus()); }}>Matikan di perangkat ini</button>}
      {error && <p className="field-error" role="alert">{error}</p>}
      <p className="field-hint" style={{ marginTop: 12 }}>Aplikasi ini memakai paket Firebase gratis, jadi tidak ada push dari server: notifikasi TIDAK muncul bila aplikasi/browser sudah ditutup sepenuhnya, dan bergantung pada browser, OS, serta mode hemat baterai. Pengingat streak dan Pet hanya tampil di dalam aplikasi.</p>
    </section>
  );
}
