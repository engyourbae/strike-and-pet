import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import type { FriendRequest, Invitation } from '@/types/social';
import { toFriendRequest, toInvitation } from './mappers';

interface Inbox {
  requests: FriendRequest[];
  invitations: Invitation[];
}

const InboxContext = createContext<Inbox>({ requests: [], invitations: [] });

/** Permintaan teman dan undangan grup yang masuk (realtime), dipakai halaman dan lencana navigasi. */
export function InboxProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const requests = useLiveQuery(
    `req:${uid}`,
    () => query(collection(getFirebase().db, 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending')),
    toFriendRequest,
  );
  const invitations = useLiveQuery(
    `inv:${uid}`,
    () => query(collection(getFirebase().db, 'invitations'), where('toUid', '==', uid), where('status', '==', 'pending')),
    toInvitation,
  );
  const value = useMemo(() => ({ requests: requests.data, invitations: invitations.data }), [requests.data, invitations.data]);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): Inbox {
  return useContext(InboxContext);
}
