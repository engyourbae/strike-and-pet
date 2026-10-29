import type { DocumentData } from 'firebase/firestore';
import type { BlockEntry, FriendRequest, Friendship, Group, Invitation, RequestStatus } from '@/types/social';
import type { GroupType } from './logic';

function str(d: DocumentData, k: string): string | null {
  const v: unknown = d[k];
  return typeof v === 'string' && v ? v : null;
}
function isStatus(v: string | null): v is RequestStatus {
  return v === 'pending' || v === 'accepted' || v === 'declined';
}
function isGroupType(v: string | null): v is GroupType {
  return v === 'duo' || v === 'squad';
}

export function toFriendRequest(id: string, d: DocumentData): FriendRequest | null {
  const fromUid = str(d, 'fromUid'), toUid = str(d, 'toUid'), fromUsername = str(d, 'fromUsername'), status = str(d, 'status');
  if (!fromUid || !toUid || !fromUsername || !isStatus(status)) return null;
  return { id, fromUid, toUid, fromUsername, status };
}

export function toFriendship(id: string, d: DocumentData): Friendship | null {
  const m: unknown = d.members;
  if (!Array.isArray(m) || m.length !== 2 || typeof m[0] !== 'string' || typeof m[1] !== 'string') return null;
  return { id, members: [m[0], m[1]] };
}

export function toBlock(id: string, d: DocumentData): BlockEntry | null {
  const blockedUid = str(d, 'blockedUid'), blockedUsername = str(d, 'blockedUsername');
  return blockedUid && blockedUsername ? { id, blockedUid, blockedUsername } : null;
}

export function toGroup(id: string, d: DocumentData): Group | null {
  const type = str(d, 'type'), name = str(d, 'name'), ownerUid = str(d, 'ownerUid');
  const members: unknown = d.memberUids;
  const max: unknown = d.maxMembers;
  if (!isGroupType(type) || !name || !ownerUid || !Array.isArray(members) || typeof max !== 'number') return null;
  return { id, type, name, ownerUid, memberUids: members.filter((x): x is string => typeof x === 'string'), maxMembers: max };
}

export function toInvitation(id: string, d: DocumentData): Invitation | null {
  const groupId = str(d, 'groupId'), groupName = str(d, 'groupName'), groupType = str(d, 'groupType');
  const fromUid = str(d, 'fromUid'), fromUsername = str(d, 'fromUsername'), toUid = str(d, 'toUid'), status = str(d, 'status');
  if (!groupId || !groupName || !isGroupType(groupType) || !fromUid || !fromUsername || !toUid || !isStatus(status)) return null;
  return { id, groupId, groupName, groupType, fromUid, fromUsername, toUid, status };
}
