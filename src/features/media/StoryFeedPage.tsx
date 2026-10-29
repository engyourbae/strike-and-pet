import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import { useProfiles } from '@/hooks/useProfiles';
import type { MediaMeta } from '@/types/media';
import type { UserProfile } from '@/types/user';
import { MediaComposer } from './MediaComposer';
import { useMediaQueue } from './MediaQueueProvider';
import { useStories } from './useStories';

function ago(ms: number): string {
  const min = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  return min < 60 ? `${min} mnt lalu` : `${Math.round(min / 60)} jam lalu`;
}

export function StoryFeedPage({ me }: { me: UserProfile }) {
  const { others, mine, loading, error } = useStories(me.uid);
  const queue = useMediaQueue();
  const [adding, setAdding] = useState(false);
  const groups = useMemo(() => {
    const map = new Map<string, MediaMeta[]>();
    for (const s of others) map.set(s.ownerUid, [...(map.get(s.ownerUid) ?? []), s]);
    return [...map.entries()].sort((a, b) => (b[1][b[1].length - 1]?.createdAtMs ?? 0) - (a[1][a[1].length - 1]?.createdAtMs ?? 0));
  }, [others]);
  const profiles = useProfiles(groups.map(([uid]) => uid));
  const pendingStories = queue.items.filter((i) => i.context === 'story');

  return (
    <>
      <h1>Story</h1>
      {adding && <MediaComposer context="story" cid={null} onClose={() => setAdding(false)} />}
      <section className="card">
        <div className="row">
          <Avatar name={me.displayName} src={me.photoURL} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>Story-mu</strong>
            <p style={{ margin: 0 }}>{mine.length > 0 ? `${mine.length} story aktif (hilang setelah 24 jam)` : 'Bagikan foto atau video ke teman selama 24 jam.'}</p>
          </div>
        </div>
        <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn--primary" onClick={() => setAdding(true)}>Tambah story</button>
          {mine.length > 0 && <Link className="btn btn--ghost" to={`/story/${me.uid}`}>Lihat story-mu</Link>}
        </div>
        {pendingStories.map((i) => (
          <p key={i.id} className={i.status === 'failed' ? 'field-error' : 'field-hint'} role="status">
            {i.status === 'failed' ? `Story gagal: ${i.error ?? ''}` : 'Mengunggah story…'}
            {i.status === 'failed' && <> <button className="btn btn--ghost btn--sm" onClick={() => queue.retry(i.id)}>Kirim ulang</button> <button className="btn btn--ghost btn--sm" onClick={() => void queue.discard(i.id)}>Buang</button></>}
          </p>
        ))}
      </section>

      <section className="card" aria-labelledby="h-fs">
        <h2 id="h-fs">Dari teman</h2>
        {loading ? <Skeleton height={56} /> : error ? <p className="field-error" role="alert">{error}</p> : groups.length === 0 ? (
          <p style={{ margin: 0 }}>Belum ada story dari teman.</p>
        ) : (
          <ul className="list">
            {groups.map(([uid, list]) => {
              const p = profiles[uid];
              const unseen = list.some((s) => !s.receivedBy.includes(me.uid) && s.status === 'available');
              return (
                <li key={uid}>
                  <Link className="row link-card" to={`/story/${uid}`} style={{ width: '100%' }}>
                    <span className={unseen ? 'story-ring story-ring--new' : 'story-ring'}><Avatar name={p?.displayName ?? '?'} src={p?.photoURL ?? null} size={52} /></span>
                    <span className="grow"><strong>{p?.displayName ?? '…'}</strong><span className="field-hint">{list.length} story · {ago(list[list.length - 1]?.createdAtMs ?? Date.now())}</span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
