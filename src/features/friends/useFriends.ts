import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useProfiles } from '@/hooks/useProfiles';
import { toFriendship } from '@/features/social/mappers';
import type { UserProfile } from '@/types/user';

export interface FriendEntry {
  uid: string;
  profile: UserProfile | null | undefined;
}

export function useFriends(myUid: string) {
  const live = useLiveQuery(
    `friends:${myUid}`,
    () => query(collection(getFirebase().db, 'friendships'), where('members', 'array-contains', myUid)),
    toFriendship,
  );
  const uids = useMemo(() => live.data.map((f) => (f.members[0] === myUid ? f.members[1] : f.members[0])), [live.data, myUid]);
  const profiles = useProfiles(uids);
  const friends: FriendEntry[] = uids.map((uid) => ({ uid, profile: profiles[uid] }));
  return { friends, uids, loading: live.loading, error: live.error };
}
