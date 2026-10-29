import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Timestamp, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useSettings } from '@/app/SettingsProvider';
import { useAction } from '@/hooks/useAction';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useNow } from '@/hooks/useNow';
import { usePresence } from '@/hooks/usePresence';
import { useProfiles } from '@/hooks/useProfiles';
import { describeSocialError } from '@/features/friends/friends.service';
import { REASONS } from '@/features/friends/ReportMenu';
import type { Message } from '@/types/chat';
import type { UserProfile } from '@/types/user';
import { useChat, type ChatItem } from './ChatProvider';
import { deleteMessage, editMessage, markRead, newMessageId, reportMessage, sendMessage, setMuted, setReaction } from './chat.service';
import {
  QUICK_EMOJIS, REACTION_EMOJIS, canEditMessage, deliveryStatus, filterMessages, previewText, summarizeReactions, validateMessageText,
} from './logic';
import { MediaBubble, UploadRow } from '@/features/media/MediaBubble';
import { MediaComposer } from '@/features/media/MediaComposer';
import { useMediaQueue } from '@/features/media/MediaQueueProvider';
import { deleteRemoteMedia } from '@/features/media/media.service';
import { useMessages } from './useMessages';
import { useTyping } from './useTyping';

interface Failed { id: string; text: string; replyToId: string | null; error: string }

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

function ReportMessage({ cid, msg, myUid }: { cid: string; msg: Message; myUid: string }) {
  const { busy, error, run } = useAction();
  const [sent, setSent] = useState(false);
  if (sent) return <span className="field-hint">Laporan terkirim.</span>;
  return (
    <details className="report">
      <summary>Laporkan</summary>
      <div className="row">
        {REASONS.map((r) => (
          <button key={r.value} className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void run(() => reportMessage(myUid, cid, msg, r.value)).then((ok) => ok && setSent(true))}>{r.label}</button>
        ))}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </details>
  );
}

function Room({ me, item }: { me: UserProfile; item: ChatItem }) {
  const cid = item.cid;
  const direct = item.kind === 'direct';
  const { settings } = useSettings();
  const now = useNow(30_000);
  const { messages, loading, error, hasMore, loadingMore, loadOlder } = useMessages(cid);
  const profiles = useProfiles(direct && item.otherUid ? [item.otherUid] : (item.group?.memberUids ?? []));
  const typing = useTyping(cid, me.uid);
  const presence = usePresence(direct ? item.otherUid : null);
  const otherRead = useLiveDoc(
    direct && item.otherUid ? `rd:${cid}` : null,
    () => doc(getFirebase().db, 'conversations', cid, 'reads', item.otherUid ?? 'x'),
    (d) => (d.lastReadAt instanceof Timestamp ? d.lastReadAt.toMillis() : null),
  );
  const act = useAction();
  const queue = useMediaQueue();

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [term, setTerm] = useState('');
  const [attaching, setAttaching] = useState(false);

  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const shown = searching ? filterMessages(messages, term) : messages;
  const lastMsg = messages[messages.length - 1];
  const latestIncoming = [...messages].reverse().find((m) => m.senderUid !== me.uid && !m.pending)?.id ?? null;
  const nameOf = (uid: string) => (uid === me.uid ? 'Kamu' : (profiles[uid]?.displayName ?? '…'));

  // Tandai dibaca saat halaman terlihat dan ada pesan masuk baru.
  useEffect(() => {
    if (!latestIncoming) return;
    const mark = () => { if (document.visibilityState === 'visible') void markRead(cid, me.uid, settings.readReceipts).catch(() => undefined); };
    mark();
    document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [cid, me.uid, latestIncoming, settings.readReceipts]);

  useEffect(() => {
    if (nearBottom.current || lastMsg?.senderUid === me.uid) bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastMsg?.id, lastMsg?.senderUid, me.uid, searching]);

  function submit() {
    setSendError(null);
    if (editing) {
      const target = editing;
      void act.run(() => editMessage(cid, target, draft, target.id === item.meta?.lastMessageId)).then((ok) => { if (ok) { setEditing(null); setDraft(''); } });
      return;
    }
    const check = validateMessageText(draft);
    if (!check.ok) { setSendError(check.error); return; }
    const id = newMessageId(cid);
    const replyToId = replyTo?.id ?? null;
    setDraft('');
    setReplyTo(null);
    typing.stop();
    void sendMessage({ cid, me, id, text: check.value, replyToId }).catch((e: unknown) =>
      setFailed((f) => [...f, { id, text: check.value, replyToId, error: describeSocialError(e) }]),
    );
  }

  function retry(f: Failed) {
    setFailed((list) => list.filter((x) => x.id !== f.id));
    void sendMessage({ cid, me, id: f.id, text: f.text, replyToId: f.replyToId }).catch((e: unknown) =>
      setFailed((list) => [...list, { ...f, error: describeSocialError(e) }]),
    );
  }

  const presenceLabel = direct && presence
    ? presence.online ? 'Online' : `Terakhir aktif ${fmtTime(presence.lastChanged)}`
    : '';
  const typingNames = typing.typers.map((u) => profiles[u]?.displayName ?? 'Seseorang');

  let prevDay = '';
  return (
    <div className="chat-room">
      {attaching && <MediaComposer context="chat" cid={cid} onClose={() => setAttaching(false)} />}
      <header className="chat-head">
        <Link to="/chat" aria-label="Kembali ke daftar chat">←</Link>
        <div className="grow" style={{ minWidth: 0 }}>
          <strong>{item.title}</strong>
          <span className="field-hint" style={{ display: 'block' }}>
            {presenceLabel || (item.group ? `${item.group.memberUids.length} anggota` : '')}
          </span>
        </div>
        <button className="btn btn--ghost btn--sm" aria-pressed={searching} onClick={() => { setSearching((s) => !s); setTerm(''); }}>Cari</button>
        <button className="btn btn--ghost btn--sm" aria-pressed={item.muted} onClick={() => void act.run(() => setMuted(me.uid, cid, !item.muted))}>{item.muted ? 'Suarakan' : 'Bisukan'}</button>
      </header>
      {searching && (
        <div className="chat-search">
          <input className="input" style={{ width: '100%' }} type="search" placeholder="Cari di pesan yang sudah dimuat" aria-label="Cari pesan" value={term} onChange={(e) => setTerm(e.target.value)} />
          <p className="field-hint">Hanya mencari di pesan yang sudah dimuat. Muat pesan lama untuk memperluas.</p>
        </div>
      )}

      <div className="chat-scroll" ref={scroller} onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; }}>
        {hasMore && <button className="btn btn--ghost btn--sm" style={{ alignSelf: 'center' }} disabled={loadingMore} onClick={() => void loadOlder()}>{loadingMore ? 'Memuat…' : 'Muat pesan lebih lama'}</button>}
        {loading && <div className="stack"><Skeleton height={44} width="60%" /><Skeleton height={44} width="45%" style={{ marginLeft: 'auto' }} /><Skeleton height={44} width="55%" /></div>}
        {error && <p className="field-error" role="alert">{error}</p>}
        {!loading && shown.length === 0 && <p className="field-hint" style={{ textAlign: 'center' }}>{searching ? 'Tidak ada pesan yang cocok.' : 'Belum ada pesan. Sapa duluan!'}</p>}
        {shown.map((m) => {
          const mine = m.senderUid === me.uid;
          const day = fmtDay(m.createdAtMs);
          const sep = day !== prevDay;
          prevDay = day;
          const status = deliveryStatus(m, otherRead.data);
          const replied = m.replyToId ? byId.get(m.replyToId) : undefined;
          const reactions = summarizeReactions(m.reactions);
          return (
            <div key={m.id} className="msg-wrap">
              {sep && <div className="day-sep">{day}</div>}
              <div className={`msg ${mine ? 'msg--me' : 'msg--them'}`}>
                {!mine && !direct && <strong className="msg-name">{nameOf(m.senderUid)}</strong>}
                {m.replyToId && (
                  <div className="msg-quote">
                    {replied ? `${nameOf(replied.senderUid)}: ${replied.deleted ? 'Pesan dihapus' : (replied.text ? previewText(replied.text) : 'Media')}` : 'Membalas pesan sebelumnya'}
                  </div>
                )}
                {m.deleted ? <em className="msg-deleted">Pesan dihapus</em> : m.mediaId ? <MediaBubble me={me} msg={m} /> : <span className="msg-text">{m.text}</span>}
                <span className="msg-meta">
                  {fmtTime(m.createdAtMs)}{m.editedAtMs && !m.deleted ? ' · diedit' : ''}
                  {mine && <> · {status === 'sending' ? 'Mengirim…' : status === 'read' && direct ? 'Dibaca' : 'Terkirim'}</>}
                </span>
                {reactions.length > 0 && (
                  <span className="msg-reacts">
                    {reactions.map((r) => (
                      <button key={r.emoji} className="chip" aria-pressed={r.uids.includes(me.uid)} onClick={() => void act.run(() => setReaction(cid, m.id, me.uid, r.uids.includes(me.uid) ? null : r.emoji))}>{r.emoji} {r.count}</button>
                    ))}
                  </span>
                )}
                {!m.pending && !m.deleted && (
                  <details className="msg-menu">
                    <summary aria-label="Aksi pesan">⋯</summary>
                    <div className="msg-actions">
                      <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                        {REACTION_EMOJIS.map((e) => <button key={e} className="chip" aria-label={`Reaksi ${e}`} onClick={() => void act.run(() => setReaction(cid, m.id, me.uid, m.reactions[me.uid] === e ? null : e))}>{e}</button>)}
                      </div>
                      <button className="btn btn--ghost btn--sm" onClick={() => { setReplyTo(m); setEditing(null); }}>Balas</button>
                      {mine && !m.mediaId && canEditMessage(m.createdAtMs, now) && <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(m); setReplyTo(null); setDraft(m.text); }}>Edit</button>}
                      {mine && <button className="btn btn--danger btn--sm" onClick={() => window.confirm('Hapus pesan ini untuk semua orang?') && void act.run(async () => { await deleteMessage(cid, m, m.id === item.meta?.lastMessageId); if (m.mediaId) await deleteRemoteMedia(m.mediaId).catch(() => undefined); })}>Hapus</button>}
                      {!mine && <ReportMessage cid={cid} msg={m} myUid={me.uid} />}
                    </div>
                  </details>
                )}
              </div>
            </div>
          );
        })}
        {failed.map((f) => (
          <div key={f.id} className="msg msg--me msg--failed" role="alert">
            <span className="msg-text">{f.text}</span>
            <span className="msg-meta">Gagal terkirim: {f.error}</span>
            <span className="row" style={{ gap: 8 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => retry(f)}>Kirim ulang</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setFailed((l) => l.filter((x) => x.id !== f.id))}>Buang</button>
            </span>
          </div>
        ))}
        {queue.items.filter((i) => i.cid === cid && i.context === 'chat').map((i) => (
          <UploadRow key={i.id} item={i} progress={queue.progress[i.id]} onRetry={() => queue.retry(i.id)} onDiscard={() => void queue.discard(i.id)} />
        ))}
        <div ref={bottom} />
      </div>

      <div className="chat-foot">
        <p className="field-hint typing" aria-live="polite">{typingNames.length > 0 ? `${typingNames.join(', ')} sedang mengetik…` : '\u00a0'}</p>
        {replyTo && <div className="chat-banner">Membalas {nameOf(replyTo.senderUid)}: {previewText(replyTo.text)} <button className="btn btn--ghost btn--sm" onClick={() => setReplyTo(null)}>Batal</button></div>}
        {editing && <div className="chat-banner">Mengedit pesan <button className="btn btn--ghost btn--sm" onClick={() => { setEditing(null); setDraft(''); }}>Batal</button></div>}
        {(sendError || act.error) && <p className="field-error" role="alert">{sendError ?? act.error}</p>}
        <div className="composer">
          <button type="button" className="btn btn--ghost" aria-label="Lampirkan foto atau video" onClick={() => setAttaching(true)}>📎</button>
          <details className="emoji-pick">
            <summary aria-label="Emoji">😊</summary>
            <div className="emoji-grid">{QUICK_EMOJIS.map((e) => <button key={e} type="button" className="chip" onClick={() => setDraft((d) => d + e)}>{e}</button>)}</div>
          </details>
          <textarea
            className="input" rows={1} value={draft} maxLength={2000} aria-label="Tulis pesan" placeholder="Tulis pesan"
            onChange={(e) => { setDraft(e.target.value); if (!editing) typing.notify(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); submit(); } }}
          />
          <button className="btn btn--primary" onClick={submit} disabled={act.busy || !draft.trim()}>{editing ? 'Simpan' : 'Kirim'}</button>
        </div>
      </div>
    </div>
  );
}

export function ChatRoomPage({ me }: { me: UserProfile }) {
  const { cid = '' } = useParams();
  const { items, loading } = useChat();
  const item = items.find((i) => i.cid === cid);
  if (loading && !item) return <Skeleton height={300} />;
  if (!item) {
    return (
      <>
        <h1>Percakapan tidak ditemukan</h1>
        <p>Percakapan ini tidak ada atau kamu tidak punya akses (mis. sudah tidak berteman atau keluar dari grup).</p>
        <Link className="btn btn--primary" to="/chat">Kembali</Link>
      </>
    );
  }
  return <Room key={cid} me={me} item={item} />;
}
