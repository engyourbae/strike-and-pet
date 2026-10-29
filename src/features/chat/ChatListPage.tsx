import { Link } from 'react-router-dom';
import { Avatar } from '@/components/Avatar';
import { Skeleton } from '@/components/Skeleton';
import type { UserProfile } from '@/types/user';
import { useChat } from './ChatProvider';

function fmt(ms: number): string {
  const d = new Date(ms);
  const same = d.toDateString() === new Date().toDateString();
  return same ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function ChatListPage({ me }: { me: UserProfile }) {
  const { items, loading } = useChat();
  return (
    <>
      <h1>Chat</h1>
      {loading ? (
        <div className="stack"><Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} /></div>
      ) : items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>Belum ada percakapan. Tambah teman di tab <Link to="/teman">Teman</Link> atau buat grup di <Link to="/grup">Grup</Link>.</p>
        </div>
      ) : (
        <ul className="list">
          {items.map((i) => (
            <li key={i.cid}>
              <Link className="card chat-row" to={`/chat/${i.cid}`} style={{ margin: 0, width: '100%' }}>
                {i.kind === 'direct' ? <Avatar name={i.title} src={i.photoURL} size={48} /> : <span className="avatar" style={{ width: 48, height: 48 }} aria-hidden="true">{i.group?.type === 'duo' ? '2' : String(i.group?.memberUids.length ?? '')}</span>}
                <span className="grow">
                  <strong>{i.title}{i.muted ? ' 🔕' : ''}</strong>
                  <span className="field-hint chat-preview">
                    {i.meta ? `${i.meta.lastSenderUid === me.uid ? 'Kamu: ' : ''}${i.meta.lastText || 'Pesan dihapus'}` : 'Mulai percakapan'}
                  </span>
                </span>
                <span className="chat-meta">
                  {i.meta && <span className="field-hint">{fmt(i.meta.lastMessageAtMs)}</span>}
                  {i.unread && !i.muted && <span className="badge" aria-label="belum dibaca">●</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
