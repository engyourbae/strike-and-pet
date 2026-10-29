import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useAction } from '@/hooks/useAction';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useFriends } from '@/features/friends/useFriends';
import { useInbox } from '@/features/social/InboxProvider';
import { MAX_SQUAD_MEMBERS, type GroupType } from '@/features/social/logic';
import { toGroup } from '@/features/social/mappers';
import type { UserProfile } from '@/types/user';
import { createGroup, respondToInvitation } from './groups.service';

export function GroupsPage({ me }: { me: UserProfile }) {
  const navigate = useNavigate();
  const { invitations } = useInbox();
  const { friends } = useFriends(me.uid);
  const groups = useLiveQuery(`groups:${me.uid}`, () => query(collection(getFirebase().db, 'groups'), where('memberUids', 'array-contains', me.uid)), toGroup);
  const action = useAction();
  const create = useAction();

  const [type, setType] = useState<GroupType>('duo');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  function changeType(t: GroupType) {
    setType(t);
    setSelected((s) => (t === 'duo' ? s.slice(0, 1) : s));
  }
  function toggle(uid: string) {
    setSelected((s) => {
      if (type === 'duo') return s.includes(uid) ? [] : [uid];
      if (s.includes(uid)) return s.filter((x) => x !== uid);
      return s.length >= MAX_SQUAD_MEMBERS - 1 ? s : [...s, uid];
    });
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    const holder: { value?: { id: string; failedInvites: number } } = {};
    const ok = await create.run(async () => {
      holder.value = await createGroup(me, type, name, selected);
    });
    const r = holder.value;
    if (ok && r) {
      if (r.failedInvites > 0) setNotice(`${r.failedInvites} undangan gagal terkirim. Kirim ulang dari halaman grup.`);
      navigate(`/grup/${r.id}`);
    }
  }

  return (
    <>
      <h1>Duo &amp; Squad</h1>

      {invitations.length > 0 && (
        <section className="card" aria-labelledby="h-inv">
          <h2 id="h-inv">Undangan masuk</h2>
          <ul className="list">
            {invitations.map((i) => (
              <li key={i.id}>
                <span className="grow">
                  <strong>{i.groupName}</strong>
                  <span className="field-hint">{i.groupType === 'duo' ? 'Dynamic Duo' : 'Squad'} dari @{i.fromUsername}</span>
                </span>
                <button className="btn btn--primary btn--sm" disabled={action.busy} onClick={() => void action.run(() => respondToInvitation(i, true))}>Terima</button>
                <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => void action.run(() => respondToInvitation(i, false))}>Tolak</button>
              </li>
            ))}
          </ul>
          {action.error && <p className="field-error" role="alert">{action.error}</p>}
        </section>
      )}

      <section className="card" aria-labelledby="h-groups">
        <h2 id="h-groups">Grupmu</h2>
        {groups.loading ? (
          <Skeleton height={48} />
        ) : groups.data.length === 0 ? (
          <p style={{ margin: 0 }}>Belum ada grup. Buat Duo atau Squad di bawah.</p>
        ) : (
          <ul className="list">
            {groups.data.map((g) => (
              <li key={g.id}>
                <Link className="grow link-card" to={`/grup/${g.id}`}>
                  <strong>{g.name}</strong>
                  <span className="field-hint">{g.type === 'duo' ? 'Dynamic Duo' : 'Squad'} · {g.memberUids.length}/{g.maxMembers} anggota</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card" onSubmit={(e) => void onCreate(e)} noValidate>
        <h2>Buat grup baru</h2>
        <div className="seg" role="radiogroup" aria-label="Jenis grup" style={{ marginBottom: 16 }}>
          <button type="button" role="radio" aria-checked={type === 'duo'} onClick={() => changeType('duo')}><strong>Dynamic Duo</strong><div className="field-hint">Berdua dengan 1 teman.</div></button>
          <button type="button" role="radio" aria-checked={type === 'squad'} onClick={() => changeType('squad')}><strong>Squad</strong><div className="field-hint">Hingga {MAX_SQUAD_MEMBERS} anggota.</div></button>
        </div>
        <div className="field">
          <label htmlFor="gname">Nama grup</label>
          <input id="gname" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </div>
        <fieldset className="checks">
          <legend>{type === 'duo' ? 'Pilih 1 teman' : 'Pilih teman untuk diundang'}</legend>
          {friends.length === 0 && <p className="field-hint">Kamu perlu berteman dulu. Buka tab Teman.</p>}
          {friends.map((f) => (
            <label key={f.uid}>
              <input type={type === 'duo' ? 'radio' : 'checkbox'} name="invitee" checked={selected.includes(f.uid)} onChange={() => toggle(f.uid)} />
              {f.profile ? `${f.profile.displayName} (@${f.profile.username})` : 'Memuat…'}
            </label>
          ))}
        </fieldset>
        <button className="btn btn--primary" type="submit" disabled={create.busy || selected.length === 0}>{create.busy ? 'Membuat…' : 'Buat dan undang'}</button>
        {create.error && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{create.error}</p>}
        {notice && <p className="field-hint" role="status" style={{ marginTop: 12 }}>{notice}</p>}
      </form>
    </>
  );
}
