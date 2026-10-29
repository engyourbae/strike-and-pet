import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAction } from '@/hooks/useAction';
import { useProfiles } from '@/hooks/useProfiles';
import { directCid, REACTION_EMOJIS } from '@/features/chat/logic';
import { newMessageId, sendMessage } from '@/features/chat/chat.service';
import type { MediaMeta } from '@/types/media';
import type { UserProfile } from '@/types/user';
import { deleteRemoteMedia } from './media.service';
import { receiveMedia, type ReceiveResult } from './receive';
import { useLocalMedia, useObjectUrl } from './useLocalMedia';
import { useStories } from './useStories';

const IMAGE_MS = 6000;

function Slide({ me, meta, mine, onDone }: { me: UserProfile; meta: MediaMeta; mine: boolean; onDone: () => void }) {
  const local = useLocalMedia(me.uid, meta.id);
  const url = useObjectUrl(local?.blob);
  const [result, setResult] = useState<ReceiveResult | null>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const localId = local?.id;
  const localKind = local?.kind;

  // Penonton: unduh + simpan ke IndexedDB + acknowledge (= tercatat "dilihat").
  useEffect(() => {
    if (mine || local !== null) return;
    let cancelled = false;
    void receiveMedia(me.uid, meta).then((r) => { if (!cancelled) setResult(r); });
    return () => { cancelled = true; };
  }, [mine, local, me.uid, meta]);

  // Foto maju otomatis; video maju saat selesai diputar.
  useEffect(() => {
    if (!localId || localKind !== 'image') return;
    const t = window.setTimeout(() => doneRef.current(), IMAGE_MS);
    return () => window.clearTimeout(t);
  }, [localId, localKind]);

  if (local === undefined) return <p className="story-msg">Memuat…</p>;
  if (!local || !url) {
    return <p className="story-msg">{result && !result.ok ? result.error : mine ? 'Story tidak tersedia di perangkat ini.' : 'Mengunduh story…'}</p>;
  }
  return (
    <div className="story-media">
      {local.kind === 'image' ? <img src={url} alt={local.caption || 'Story'} /> : <video src={url} autoPlay playsInline controls={false} onEnded={onDone} />}
      {local.caption && <p className="story-caption">{local.caption}</p>}
    </div>
  );
}

export function StoryViewerPage({ me }: { me: UserProfile }) {
  const { ownerUid = '' } = useParams();
  const navigate = useNavigate();
  const { others, mine, loading } = useStories(me.uid);
  const isMine = ownerUid === me.uid;
  const list = isMine ? mine : others.filter((s) => s.ownerUid === ownerUid);
  const [idx, setIdx] = useState(0);
  const profiles = useProfiles([ownerUid]);
  const act = useAction();
  const [sent, setSent] = useState<string | null>(null);
  const current = list[Math.min(idx, Math.max(0, list.length - 1))];

  const close = () => navigate('/story');
  const next = () => (idx + 1 >= list.length ? close() : setIdx(idx + 1));
  const prev = () => setIdx(Math.max(0, idx - 1));

  if (loading && list.length === 0) return <div className="story-viewer"><p className="story-msg">Memuat…</p></div>;
  if (!current) {
    return (
      <div className="story-viewer">
        <p className="story-msg">Tidak ada story aktif.</p>
        <button className="btn btn--primary" onClick={close}>Kembali</button>
      </div>
    );
  }

  function react(emoji: string) {
    const cid = directCid(me.uid, ownerUid);
    void act.run(() => sendMessage({ cid, me, id: newMessageId(cid), text: emoji, replyToId: null })).then((ok) => ok && setSent(emoji));
  }

  return (
    <div className="story-viewer" role="dialog" aria-modal="true" aria-label="Penampil story">
      <div className="story-bars" aria-hidden="true">{list.map((s, i) => <i key={s.id} data-state={i < idx ? 'done' : i === idx ? 'now' : 'next'} />)}</div>
      <div className="story-head">
        <strong>{isMine ? 'Story-mu' : (profiles[ownerUid]?.displayName ?? '…')}</strong>
        <button className="btn btn--ghost btn--sm" onClick={close} aria-label="Tutup">✕</button>
      </div>
      <div className="story-stage">
        <button className="story-zone story-zone--l" aria-label="Sebelumnya" onClick={prev} />
        <Slide key={current.id} me={me} meta={current} mine={isMine} onDone={next} />
        <button className="story-zone story-zone--r" aria-label="Berikutnya" onClick={next} />
      </div>
      <div className="story-foot">
        {isMine ? (
          <>
            <span>Dilihat {current.receivedBy.length} dari {current.recipients.length}</span>
            <button className="btn btn--danger btn--sm" disabled={act.busy} onClick={() => window.confirm('Hapus story ini?') && void act.run(async () => { await deleteRemoteMedia(current.id); }).then((ok) => ok && next())}>Hapus</button>
          </>
        ) : (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {REACTION_EMOJIS.map((e) => <button key={e} className="chip" aria-label={`Reaksi ${e}`} disabled={act.busy} onClick={() => react(e)}>{e}</button>)}
          </div>
        )}
        {sent && <span role="status">Reaksi {sent} dikirim ke chat</span>}
        {act.error && <span role="alert">{act.error}</span>}
      </div>
    </div>
  );
}
