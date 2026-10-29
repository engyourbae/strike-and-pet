import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { invitationId, maxMembersFor, validateGroupName, validateInviteeCount, type GroupType } from '@/features/social/logic';
import type { Group, Invitation } from '@/types/social';
import type { UserProfile } from '@/types/user';

function invitationData(me: UserProfile, group: { id: string; name: string; type: GroupType }, toUid: string) {
  return {
    groupId: group.id,
    groupName: group.name,
    groupType: group.type,
    fromUid: me.uid,
    fromUsername: me.username,
    toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/** Membuat grup lalu mengirim undangan satu per satu (tiap undangan divalidasi rules terpisah). */
export async function createGroup(
  me: UserProfile,
  type: GroupType,
  rawName: string,
  inviteeUids: string[],
): Promise<{ id: string; failedInvites: number }> {
  const name = validateGroupName(rawName);
  if (!name.ok) throw new Error(name.error);
  const countError = validateInviteeCount(type, inviteeUids.length);
  if (countError) throw new Error(countError);

  const { db } = getFirebase();
  const groupRef = doc(collection(db, 'groups'));
  await setDoc(groupRef, {
    type,
    name: name.value,
    ownerUid: me.uid,
    memberUids: [me.uid],
    maxMembers: maxMembersFor(type),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const group = { id: groupRef.id, name: name.value, type };
  const results = await Promise.allSettled(
    inviteeUids.map((uid) => setDoc(doc(db, 'invitations', invitationId(group.id, uid)), invitationData(me, group, uid))),
  );
  return { id: group.id, failedInvites: results.filter((r) => r.status === 'rejected').length };
}

export async function inviteToGroup(me: UserProfile, group: Group, friendUid: string): Promise<void> {
  const { db } = getFirebase();
  const ref = doc(db, 'invitations', invitationId(group.id, friendUid));
  // Undangan lama (ditolak/diterima lalu keluar) dihapus dulu; delete aman bila dokumen tidak ada.
  await deleteDoc(ref);
  await setDoc(ref, invitationData(me, group, friendUid));
}

export async function cancelInvitation(id: string): Promise<void> {
  await deleteDoc(doc(getFirebase().db, 'invitations', id));
}

export async function respondToInvitation(inv: Invitation, accept: boolean): Promise<void> {
  const { db } = getFirebase();
  const invRef = doc(db, 'invitations', inv.id);
  if (!accept) {
    await updateDoc(invRef, { status: 'declined', updatedAt: serverTimestamp() });
    return;
  }
  const batch = writeBatch(db);
  batch.update(invRef, { status: 'accepted', updatedAt: serverTimestamp() });
  batch.update(doc(db, 'groups', inv.groupId), { memberUids: arrayUnion(inv.toUid), updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function renameGroup(groupId: string, rawName: string): Promise<void> {
  const name = validateGroupName(rawName);
  if (!name.ok) throw new Error(name.error);
  await updateDoc(doc(getFirebase().db, 'groups', groupId), { name: name.value, updatedAt: serverTimestamp() });
}

/** Keluar sendiri (anggota) atau mengeluarkan anggota (pemilik). */
export async function removeMember(groupId: string, memberUid: string): Promise<void> {
  await updateDoc(doc(getFirebase().db, 'groups', groupId), { memberUids: arrayRemove(memberUid), updatedAt: serverTimestamp() });
}

export async function deleteGroup(group: Group, myUid: string): Promise<void> {
  const { db } = getFirebase();
  const pending = await getDocs(query(collection(db, 'invitations'), where('fromUid', '==', myUid), where('groupId', '==', group.id)));
  const batch = writeBatch(db);
  pending.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, 'groups', group.id));
  await batch.commit();
}
