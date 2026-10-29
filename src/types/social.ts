import type { GroupType } from '@/features/social/logic';

export type RequestStatus = 'pending' | 'accepted' | 'declined';
export type ReportReason = 'spam' | 'pelecehan' | 'akun_palsu' | 'lainnya';

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  fromUsername: string;
  status: RequestStatus;
}

export interface Friendship {
  id: string;
  members: [string, string];
}

export interface BlockEntry {
  id: string;
  blockedUid: string;
  blockedUsername: string;
}

export interface Group {
  id: string;
  type: GroupType;
  name: string;
  ownerUid: string;
  memberUids: string[];
  maxMembers: number;
}

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  groupType: GroupType;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  status: RequestStatus;
}
