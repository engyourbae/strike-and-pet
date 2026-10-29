import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, query, where } from 'firebase/firestore';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useAction } from '@/hooks/useAction';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useProfiles } from '@/hooks/useProfiles';
import { useFriends } from '@/features/friends/useFriends';
import { toGroup, toInvitation } from '@/features/social/mappers';
import type { UserProfile } from '@/types/user';
import { cancelInvitation, deleteGroup, inviteToGroup, removeMember, renameGroup } from './groups.service';

export function GroupDetailPage({ me }: { me: UserProfile }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const groups = useLiveQuery(`groups:${me.uid}`, () => query(collection(getFirebase().db, 'groups'), where('memberUids', 'array-contains', me.uid)), toGroup);
  const group = groups.data.find((g) => g.id === id);
  const sent = useLiveQuery(
    `ginv:${id}:${me.uid}`,
    () => query(collection(getFirebase().db, 'invitations'), where('fromUid', '==', me.uid), where('groupId', '==', id)),
    toInvitation,
  );
  const { friends } = useFriends(me.uid);
  const profiles = useProfiles(group?.memberUids ?? []);
  const action = useAction();
  const [newName, setNewName] = useState<string | null>(null);

  if (groups.loading) return <Skeleton height={120} />;
  if (!group) {
    return (
      <>
        <h1>Grup tidak ditemukan</h1>
        <p>Grup ini tidak ada, sudah dihapus, atau kamu bukan anggotanya.</p>
        <Link className="btn btn--primary" to="/grup">Kembali</Link>
      </>
    );
  }

  const isOwner = group.ownerUid === me.uid;
  const pendingIds = new Set(sent.data.filter((i) => i.status === 'pending').map((i) => i.toUid));
  const full = group.memberUids.length >= group.maxMembers;
  const invitable = friends.filter((f) => !group.memberUids.includes(f.uid) && !pendingIds.has(f.uid));
  const nameValue = newName ?? group.name;

  async function onRename(e: FormEvent) {
    e.preventDefault();
    if (await action.run(() => renameGroup(group!.id, nameValue))) setNewName(null);
  }

  return (
    <>
      <p><Link to="/grup">← Semua grup</Link></p>
      <h1>{group.name}</h1>
      <p>{group.type === 'duo' ? 'Dynamic Duo' : 'Squad'} · {group.memberUids.length}/{group.maxMembers} anggota</p>
      <p><Link className="btn btn--primary btn--sm" to={`/chat/${group.id}`}>Buka chat grup</Link></p>
      {action.error && <p className="field-error" role="alert">{action.error}</p>}

      <section className="card" aria-labelledby="h-members">
        <h2 id="h-members">Anggota</h2>
        <ul className="list">
          {group.memberUids.map((uid) => {
            const p = profiles[uid];
            return (
              <li key={uid}>
                <Avatar name={p?.displayName ?? '?'} src={p?.photoURL ?? null} size={44} />
                <span className="grow">
                  <strong>{p ? p.displayName : 'Memuat…'}</strong>
                  {p && <span className="field-hint">@{p.username}</span>}
                </span>
                {uid === group.ownerUid && <span className="pill">Pemilik</span>}
                {isOwner && uid !== me.uid && (
                  <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => window.confirm('Keluarkan anggota ini?') && void action.run(() => removeMember(group.id, uid))}>Keluarkan</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {isOwner && (
        <>
          <form className="card" onSubmit={(e) => void onRename(e)}>
            <div className="field">
              <label htmlFor="rename">Nama grup</label>
              <input id="rename" className="input" value={nameValue} maxLength={40} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <button className="btn btn--primary" type="submit" disabled={action.busy || nameValue.trim() === group.name}>Simpan nama</button>
          </form>

          <section className="card" aria-labelledby="h-invite">
            <h2 id="h-invite">Undang teman</h2>
            {full ? (
              <p style={{ margin: 0 }}>Grup sudah penuh.</p>
            ) : invitable.length === 0 ? (
              <p style={{ margin: 0 }}>Tidak ada teman lain yang bisa diundang.</p>
            ) : (
              <ul className="list">
                {invitable.map((f) => (
                  <li key={f.uid}>
                    <span className="grow"><strong>{f.profile ? f.profile.displayName : 'Memuat…'}</strong>{f.profile && <span className="field-hint">@{f.profile.username}</span>}</span>
                    <button className="btn btn--primary btn--sm" disabled={action.busy} onClick={() => void action.run(() => inviteToGroup(me, group, f.uid))}>Undang</button>
                  </li>
                ))}
              </ul>
            )}
            {sent.data.filter((i) => i.status === 'pending').length > 0 && (
              <>
                <h3 style={{ marginTop: 16 }}>Menunggu jawaban</h3>
                <ul className="list">
                  {sent.data.filter((i) => i.status === 'pending').map((i) => {
                    const p = friends.find((f) => f.uid === i.toUid)?.profile;
                    return (
                      <li key={i.id}>
                        <span className="grow">{p ? `@${p.username}` : 'Teman'}</span>
                        <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => void action.run(() => cancelInvitation(i.id))}>Batalkan</button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>

          <button className="btn btn--danger" disabled={action.busy} onClick={() => { if (window.confirm('Hapus grup ini untuk semua anggota?')) void action.run(() => deleteGroup(group, me.uid)).then((ok) => ok && navigate('/grup')); }}>Hapus grup</button>
        </>
      )}

      {!isOwner && (
        <button className="btn btn--danger" disabled={action.busy} onClick={() => { if (window.confirm('Keluar dari grup ini?')) void action.run(() => removeMember(group.id, me.uid)).then((ok) => ok && navigate('/grup')); }}>Keluar dari grup</button>
      )}
    </>
  );
}
