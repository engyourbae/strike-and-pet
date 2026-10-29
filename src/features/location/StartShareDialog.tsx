import { useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useProfiles } from '@/hooks/useProfiles';
import { toGroup } from '@/features/social/mappers';
import { DURATION_OPTIONS, HISTORY_RETENTION_DAYS } from '@/shared/locationLogic';
import type { Group } from '@/types/social';
import type { UserProfile } from '@/types/user';
import { useLocationShare } from './LocationShareProvider';

/** Persetujuan eksplisit sebelum berbagi: pilih grup, siapa yang melihat, durasi, dan riwayat (default mati). */
export function StartShareDialog({ me, onClose }: { me: UserProfile; onClose: () => void }) {
  const share = useLocationShare();
  const groups = useLiveQuery(`groups:${me.uid}`, () => query(collection(getFirebase().db, 'groups'), where('memberUids', 'array-contains', me.uid)), toGroup);
  const [groupId, setGroupId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState(60);
  const [history, setHistory] = useState(false);
  const [consent, setConsent] = useState(false);
  const group = groups.data.find((g) => g.id === groupId);
  const members = group ? group.memberUids.filter((u) => u !== me.uid) : [];
  const profiles = useProfiles(members);
  const busy = share.state.phase === 'starting';

  function pickGroup(g: Group) {
    setGroupId(g.id);
    setSelected(g.memberUids.filter((u) => u !== me.uid));
  }

  async function submit() {
    if (!group) return;
    const ok = await share.start({ groupId: group.id, groupName: group.name, viewerUids: selected, durationMin: duration, historyEnabled: history });
    if (ok) onClose();
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Mulai berbagi lokasi">
      <div className="overlay-card">
        <h2>Mulai berbagi lokasi</h2>
        <div className="seg" role="radiogroup" aria-label="Grup" style={{ marginBottom: 12 }}>
          {groups.data.length === 0 && <p className="field-hint">Kamu perlu punya Duo atau Squad dulu (tab Grup).</p>}
          {groups.data.filter((g) => g.memberUids.length > 1).map((g) => (
            <button key={g.id} type="button" role="radio" aria-checked={groupId === g.id} onClick={() => pickGroup(g)}>
              <strong>{g.name}</strong><div className="field-hint">{g.type === 'duo' ? 'Dynamic Duo' : 'Squad'} · {g.memberUids.length} anggota</div>
            </button>
          ))}
        </div>
        {group && (
          <fieldset className="checks">
            <legend>Siapa yang boleh melihat lokasimu</legend>
            {members.map((u) => (
              <label key={u}>
                <input type="checkbox" checked={selected.includes(u)} onChange={() => setSelected((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u]))} />
                {profiles[u] ? `${profiles[u]?.displayName} (@${profiles[u]?.username})` : 'Memuat…'}
              </label>
            ))}
          </fieldset>
        )}
        <div className="field">
          <label htmlFor="dur">Durasi</label>
          <select id="dur" className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATION_OPTIONS.map((d) => <option key={d.min} value={d.min}>{d.label}</option>)}
          </select>
          <p className="field-hint">Berhenti otomatis saat durasi habis. Kamu bisa menghentikannya kapan saja.</p>
        </div>
        <label className="switch-row">
          <span className="grow"><strong>Simpan riwayat rute sesi ini</strong><span className="field-hint">Opsional, mati secara default. Disimpan hanya untukmu dan dihapus otomatis setelah {HISTORY_RETENTION_DAYS} hari.</span></span>
          <input type="checkbox" role="switch" checked={history} onChange={(e) => setHistory(e.target.checked)} aria-label="Simpan riwayat rute" />
        </label>
        <label className="switch-row">
          <span className="grow"><strong>Saya setuju membagikan lokasi</strong><span className="field-hint">Lokasi dan kecepatan perkiraanmu akan terlihat oleh orang yang dipilih selama sesi aktif.</span></span>
          <input type="checkbox" role="switch" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-label="Saya setuju membagikan lokasi" />
        </label>
        <p className="field-hint">Berbagi hanya berjalan saat aplikasi terbuka; browser dapat menghentikannya di latar belakang atau saat baterai hemat. Jangan menggunakan ponsel saat mengemudi.</p>
        {share.state.error && <p className="field-error" role="alert">{share.state.error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn--ghost" onClick={onClose}>Batal</button>
          <button className="btn btn--primary" disabled={busy || !group || selected.length === 0 || !consent} onClick={() => void submit()}>{busy ? 'Memulai…' : 'Mulai berbagi'}</button>
        </div>
      </div>
    </div>
  );
}
