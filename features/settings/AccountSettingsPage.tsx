import { useState } from 'react';
import { signOutUser } from '@/features/auth/auth.service';
import { clearLocalMedia } from '@/features/media/mediaStore';
import { useAction } from '@/hooks/useAction';
import { deleteMyAccount, exportMyData } from './account.service';
import type { UserProfile } from '@/types/user';

export function AccountSettingsPage({ me }: { me: UserProfile }) {
  const exportAct = useAction();
  const deleteAct = useAction();
  const [confirm, setConfirm] = useState('');
  const [wipeLocal, setWipeLocal] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  async function exportData() {
    const res = await exportMyData();
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strike-pet-data-${res.exportedAt.slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Ekspor selesai. Berkas berisi datamu sendiri (profil, pengaturan, pertemanan, pesan yang kamu tulis, metadata media dan sesi lokasi). Media sendiri tidak ikut diekspor; simpan lewat Media lokal.');
  }

  async function deleteAccount() {
    const ok = await deleteAct.run(async () => {
      await deleteMyAccount(confirm);
      if (wipeLocal) await clearLocalMedia(me.uid);
    });
    if (ok) await signOutUser().catch(() => undefined);
  }

  return (
    <>
      <h1>Akun</h1>
      <section className="card">
        <h2>Ekspor data</h2>
        <p>Unduh salinan datamu dalam format JSON.</p>
        <button className="btn btn--ghost" disabled={exportAct.busy} onClick={() => void exportAct.run(exportData)}>{exportAct.busy ? 'Menyiapkan…' : 'Unduh data saya'}</button>
        {exportAct.error && <p className="field-error" role="alert">{exportAct.error}</p>}
        {notice && <p className="field-hint" role="status">{notice}</p>}
      </section>

      <section className="card" aria-labelledby="h-del">
        <h2 id="h-del">Hapus akun</h2>
        <p>Tindakan ini <strong>permanen</strong> dan tidak bisa dibatalkan.</p>
        <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
          <li>Profil, @username, Pet, streak, achievement, pengaturan, pertemanan, dan sesi lokasi dihapus.</li>
          <li>Grup yang kamu buat dihapus beserta chat-nya; dari grup lain kamu keluar.</li>
          <li>Pesan yang pernah kamu kirim di percakapan orang lain dikosongkan (tampil "Pesan dihapus").</li>
          <li>Media yang kamu kirim dihapus dari server. Salinan di perangkat penerima tidak terpengaruh.</li>
          <li>Kamu akan diminta login Google sekali lagi sebelum akun dihapus.</li>
        </ul>
        <label className="switch-row">
          <span className="grow"><strong>Hapus juga media lokal di perangkat ini</strong></span>
          <input type="checkbox" role="switch" checked={wipeLocal} onChange={(e) => setWipeLocal(e.target.checked)} aria-label="Hapus juga media lokal" />
        </label>
        <div className="field">
          <label htmlFor="confirm">Ketik HAPUS untuk mengonfirmasi</label>
          <input id="confirm" className="input" value={confirm} autoComplete="off" onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button className="btn btn--danger" disabled={deleteAct.busy || confirm !== 'HAPUS'} onClick={() => void deleteAccount()}>{deleteAct.busy ? 'Menghapus…' : 'Hapus akun saya'}</button>
        {deleteAct.error && <p className="field-error" role="alert">{deleteAct.error}</p>}
      </section>
      <button className="btn btn--ghost" onClick={() => void signOutUser()}>Keluar</button>
    </>
  );
}
