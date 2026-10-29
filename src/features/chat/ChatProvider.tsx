import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useFriends } from '@/features/friends/useFriends';
import { toGroup } from '@/features/social/mappers';
import type { ConversationMeta } from '@/types/chat';
import type { Group } from '@/types/social';
import { directCid, isUnread } from './logic';
import { toChatState, toMeta } from './mappers';

export interface ChatItem {
  cid: string;
  kind: 'direct' | 'group';
  title: string;
  photoURL: string | null;
  otherUid: string | null;
  group: Group | null;
  meta: ConversationMeta | null;
  muted: boolean;
  unread: boolean;
}

interface ChatContextValue {
  items: ChatItem[];
  /** Jumlah percakapan belum dibaca (percakapan yang di-mute tidak dihitung). */
  unreadCount: number;
  loading: boolean;
}

const ChatContext = createContext<ChatContextValue>({ items: [], unreadCount: 0, loading: true });

function useConversationMetas(cids: string[]): Record<string, ConversationMeta | null> {
  const key = [...cids].sort().join(',');
  const [metas, setMetas] = useState<Record<string, ConversationMeta | null>>({});
  useEffect(() => {
    if (!key) return;
    const { db } = getFirebase();
    const unsubs = key.split(',').map((cid) =>
      onSnapshot(
        doc(db, 'conversations', cid),
        (snap) => setMetas((prev) => ({ ...prev, [cid]: snap.exists() ? toMeta(cid, snap.data()) : null })),
        () => setMetas((prev) => ({ ...prev, [cid]: null })),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);
  return metas;
}

/** Daftar percakapan = teman (chat pribadi) + grup Duo/Squad, dengan pratinjau dan status belum dibaca realtime. */
export function ChatProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const { friends, loading: friendsLoading } = useFriends(uid);
  const groups = useLiveQuery(`groups:${uid}`, () => query(collection(getFirebase().db, 'groups'), where('memberUids', 'array-contains', uid)), toGroup);
  const states = useLiveQuery(`cs:${uid}`, () => collection(getFirebase().db, 'users', uid, 'chatState'), toChatState);

  const cids = useMemo(() => [...friends.map((f) => directCid(uid, f.uid)), ...groups.data.map((g) => g.id)], [friends, groups.data, uid]);
  const metas = useConversationMetas(cids);

  const items = useMemo<ChatItem[]>(() => {
    const st = new Map(states.data.map((s) => [s.cid, s]));
    const build = (partial: Pick<ChatItem, 'cid' | 'kind' | 'title' | 'photoURL' | 'otherUid' | 'group'>): ChatItem => {
      const meta = metas[partial.cid] ?? null;
      const s = st.get(partial.cid);
      return { ...partial, meta, muted: s?.muted === true, unread: isUnread(meta, s?.lastReadAtMs, uid) };
    };
    const direct = friends.map((f) =>
      build({ cid: directCid(uid, f.uid), kind: 'direct', title: f.profile?.displayName ?? 'Memuat…', photoURL: f.profile?.photoURL ?? null, otherUid: f.uid, group: null }),
    );
    const grp = groups.data.map((g) => build({ cid: g.id, kind: 'group', title: g.name, photoURL: null, otherUid: null, group: g }));
    return [...direct, ...grp].sort((a, b) => (b.meta?.lastMessageAtMs ?? 0) - (a.meta?.lastMessageAtMs ?? 0) || a.title.localeCompare(b.title));
  }, [friends, groups.data, metas, states.data, uid]);

  const value = useMemo(
    () => ({ items, unreadCount: items.filter((i) => i.unread && !i.muted).length, loading: friendsLoading || groups.loading }),
    [items, friendsLoading, groups.loading],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  return useContext(ChatContext);
}
