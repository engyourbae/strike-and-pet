import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { directCid } from '@/features/chat/logic';
import { collection, query, where } from 'firebase/firestore';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useAction } from '@/hooks/useAction';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useInbox } from '@/features/social/InboxProvider';
import { toBlock, toFriendRequest } from '@/features/social/mappers';
import type { UserProfile } from '@/types/user';
import {
  blockUser, cancelRequest, findUserByUsername, removeFriend, respondToRequest, sendFriendRequest, unblockUser,
} from './friends.service';
import { ReportMenu } from './ReportMenu';
import { useFriends } from './useFriends';

type SearchState = { kind: 'idle' } | { kind: 'none' } | { kind: 'found'; profile: UserProfile };

export function FriendsPage({ me }: { me: UserProfile }) {
  const { requests } = useInbox();
  const { friends, uids: friendUids, loading: friendsLoading } = useFriends(me.uid);
  const outgoing = useLiveQuery(`out:${me.uid}`, () => query(collection(getFirebase().db, 'friendRequests'), where('fromUid', '==', me.uid)), toFriendRequest);
  const blocks = useLiveQuery(`bl:${me.uid}`, () => query(collection(getFirebase().db, 'blocks'), where('blockerUid', '==', me.uid)), toBlock);
  const pendingOut = outgoing.data.filter((r) => r.status === 'pending');
  const action = useAction();

  const [input, setInput] = useState('');
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const profile = await findUserByUsername(input);
      setSearch(profile ? { kind: 'found', profile } : { kind: 'none' });
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Pencarian gagal.');
    } finally {
      setSearching(false);
    }
  }

  function renderSearchActions(p: UserProfile) {
    if (p.uid === me.uid) return <span className="pill">Ini kamu</span>;
    if (blocks.data.some((b) => b.blockedUid === p.uid)) {
      return <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => void action.run(() => unblockUser(me.uid, p.uid))}>Buka blokir</button>;
    }
    if (friendUids.includes(p.uid)) return <span className="pill">Teman</span>;
    const incoming = requests.find((r) => r.fromUid === p.uid);
    if (incoming) {
      return <button className="btn btn--primary btn--sm" disabled={action.busy} onClick={() => void action.run(() => respondToRequest(incoming, true))}>Terima</button>;
    }
    if (pendingOut.some((r) => r.toUid === p.uid)) return <span className="pill">Menunggu</span>;
    return <button className="btn btn--primary btn--sm" disabled={action.busy} onClick={() => void action.run(() => sendFriendRequest(me, p))}>Tambahkan teman</button>;
  }

  return (
    <>
      <h1>Teman</h1>
      <form className="card" onSubmit={(e) => void onSearch(e)} noValidate>
        <div className="field">
          <label htmlFor="search">Cari @username</label>
          <div className="input-prefix">
            <span aria-hidden="true">@</span>
            <input id="search" className="input" value={input} autoCapitalize="none" autoComplete="off" spellCheck={false} onChange={(e) => setInput(e.target.value)} />
          </div>
        </div>
        <button className="btn btn--primary" type="submit" disabled={searching || !input.trim()}>{searching ? 'Mencari…' : 'Cari'}</button>
        {searchError && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{searchError}</p>}
        {search.kind === 'none' && <p className="field-hint" role="status" style={{ marginTop: 12 }}>Pengguna tidak ditemukan.</p>}
        {search.kind === 'found' && (
          <div className="stack" style={{ marginTop: 16 }}>
            <div className="row">
              <Avatar name={search.profile.displayName} src={search.profile.photoURL} />
              <div className="grow" style={{ flex: 1, minWidth: 0 }}>
                <strong>{search.profile.displayName}</strong>
                <span className="field-hint">@{search.profile.username}</span>
                {search.profile.bio && <p style={{ margin: '4px 0 0' }}>{search.profile.bio}</p>}
              </div>
            </div>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              {renderSearchActions(search.profile)}
              {search.profile.uid !== me.uid && !blocks.data.some((b) => b.blockedUid === search.profile.uid) && (
                <button type="button" className="btn btn--danger btn--sm" disabled={action.busy} onClick={() => void action.run(() => blockUser(me, { uid: search.profile.uid, username: search.profile.username }))}>Blokir</button>
              )}
            </div>
            {search.profile.uid !== me.uid && <ReportMenu myUid={me.uid} targetUid={search.profile.uid} />}
          </div>
        )}
      </form>
      {action.error && <p className="field-error" role="alert">{action.error}</p>}

      {requests.length > 0 && (
        <section className="card" aria-labelledby="h-in">
          <h2 id="h-in">Permintaan masuk</h2>
          <ul className="list">
            {requests.map((r) => (
              <li key={r.id}>
                <span className="grow"><strong>@{r.fromUsername}</strong></span>
                <button className="btn btn--primary btn--sm" disabled={action.busy} onClick={() => void action.run(() => respondToRequest(r, true))}>Terima</button>
                <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => void action.run(() => respondToRequest(r, false))}>Tolak</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingOut.length > 0 && (
        <section className="card" aria-labelledby="h-out">
          <h2 id="h-out">Permintaan terkirim</h2>
          <ul className="list">
            {pendingOut.map((r) => (
              <li key={r.id}>
                <span className="grow"><span className="field-hint">Menunggu persetujuan</span></span>
                <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => void action.run(() => cancelRequest(r.id))}>Batalkan</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="h-friends">
        <h2 id="h-friends">Daftar teman</h2>
        {friendsLoading ? (
          <div className="stack"><Skeleton height={48} /><Skeleton height={48} /></div>
        ) : friends.length === 0 ? (
          <p style={{ margin: 0 }}>Belum ada teman. Cari @username temanmu di atas.</p>
        ) : (
          <ul className="list">
            {friends.map((f) => (
              <li key={f.uid}>
                <Avatar name={f.profile?.displayName ?? '?'} src={f.profile?.photoURL ?? null} size={44} />
                <span className="grow">
                  <strong>{f.profile ? f.profile.displayName : f.profile === null ? 'Pengguna tidak ditemukan' : 'Memuat…'}</strong>
                  {f.profile && <span className="field-hint">@{f.profile.username}</span>}
                </span>
                <Link className="btn btn--primary btn--sm" to={`/chat/${directCid(me.uid, f.uid)}`}>Chat</Link>
                <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => window.confirm('Hapus teman ini?') && void action.run(() => removeFriend(me.uid, f.uid))}>Hapus</button>
                {f.profile && (
                  <button className="btn btn--danger btn--sm" disabled={action.busy} onClick={() => { const p = f.profile; if (p && window.confirm(`Blokir @${p.username}?`)) void action.run(() => blockUser(me, { uid: p.uid, username: p.username })); }}>Blokir</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {blocks.data.length > 0 && (
        <section className="card" aria-labelledby="h-blocks">
          <h2 id="h-blocks">Diblokir</h2>
          <ul className="list">
            {blocks.data.map((b) => (
              <li key={b.id}>
                <span className="grow"><strong>@{b.blockedUsername}</strong></span>
                <button className="btn btn--ghost btn--sm" disabled={action.busy} onClick={() => void action.run(() => unblockUser(me.uid, b.blockedUid))}>Buka blokir</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
