import { addDoc, collection, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import type { Message } from '@/types/chat';
import type { ReportReason } from '@/types/social';
import type { UserProfile } from '@/types/user';
import type { MediaKind } from '@/shared/mediaLogic';
import { previewLabel } from '@/shared/mediaLogic';
import { isDirectCid, previewText, validateMessageText } from './logic';

export function newMessageId(cid: string): string {
  return doc(collection(getFirebase().db, 'conversations', cid, 'messages')).id;
}

/**
 * Mengirim pesan + memperbarui pratinjau percakapan dalam satu batch.
 * Saat offline, Firestore menyimpan tulisan di antrean lokal dan mengirimnya ulang ketika online;
 * id yang dibuat klien membuat pengiriman ulang aman (tidak menggandakan pesan).
 */
export async function sendMessage(p: { cid: string; me: UserProfile; id: string; text: string; replyToId: string | null }): Promise<void> {
  const check = validateMessageText(p.text);
  if (!check.ok) throw new Error(check.error);
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(doc(db, 'conversations', p.cid, 'messages', p.id), {
    senderUid: p.me.uid,
    text: check.value,
    createdAt: serverTimestamp(),
    replyToId: p.replyToId,
    editedAt: null,
    deleted: false,
    reactions: {},
  });
  batch.set(doc(db, 'conversations', p.cid), {
    type: isDirectCid(p.cid) ? 'direct' : 'group',
    lastText: previewText(check.value),
    lastSenderUid: p.me.uid,
    lastMessageAt: serverTimestamp(),
    lastMessageId: p.id,
  });
  await batch.commit();
}

/** Edit hanya oleh pengirim dalam 15 menit pertama (dipaksa Rules). */
export async function editMessage(cid: string, msg: Message, rawText: string, isLast: boolean): Promise<void> {
  const check = validateMessageText(rawText);
  if (!check.ok) throw new Error(check.error);
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.update(doc(db, 'conversations', cid, 'messages', msg.id), { text: check.value, editedAt: serverTimestamp() });
  if (isLast) batch.update(doc(db, 'conversations', cid), { lastText: previewText(check.value) });
  await batch.commit();
}

/** Hapus = tandai terhapus dan kosongkan isi (jejak "pesan dihapus" tetap ada). Hanya pengirim. */
export async function deleteMessage(cid: string, msg: Message, isLast: boolean): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.update(doc(db, 'conversations', cid, 'messages', msg.id), { deleted: true, text: '' });
  if (isLast) batch.update(doc(db, 'conversations', cid), { lastText: '' });
  await batch.commit();
}

export async function setReaction(cid: string, messageId: string, uid: string, emoji: string | null): Promise<void> {
  await updateDoc(doc(getFirebase().db, 'conversations', cid, 'messages', messageId), {
    [`reactions.${uid}`]: emoji === null ? deleteField() : emoji,
  });
}

export async function markRead(cid: string, uid: string, sendReceipt: boolean): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'chatState', cid), { lastReadAt: serverTimestamp() }, { merge: true });
  if (sendReceipt && isDirectCid(cid)) batch.set(doc(db, 'conversations', cid, 'reads', uid), { lastReadAt: serverTimestamp() });
  await batch.commit();
}

export async function setMuted(uid: string, cid: string, muted: boolean): Promise<void> {
  await setDoc(doc(getFirebase().db, 'users', uid, 'chatState', cid), { muted }, { merge: true });
}

export async function reportMessage(myUid: string, cid: string, msg: Message, reason: ReportReason): Promise<void> {
  await addDoc(collection(getFirebase().db, 'reports'), {
    reporterUid: myUid,
    reportedUid: msg.senderUid,
    reason,
    conversationId: cid,
    messageId: msg.id,
    createdAt: serverTimestamp(),
  });
}

export async function messageExists(cid: string, id: string): Promise<boolean> {
  return (await getDoc(doc(getFirebase().db, 'conversations', cid, 'messages', id))).exists();
}

/** Pesan media: id pesan = id media (pengiriman ulang idempoten). Rules memastikan media milik pengirim dan sudah tervalidasi server. */
export async function sendMediaMessage(p: { cid: string; me: UserProfile; mediaId: string; kind: MediaKind; caption: string }): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);
  batch.set(doc(db, 'conversations', p.cid, 'messages', p.mediaId), {
    senderUid: p.me.uid,
    text: p.caption,
    createdAt: serverTimestamp(),
    replyToId: null,
    editedAt: null,
    deleted: false,
    reactions: {},
    mediaId: p.mediaId,
  });
  batch.set(doc(db, 'conversations', p.cid), {
    type: isDirectCid(p.cid) ? 'direct' : 'group',
    lastText: previewLabel(p.kind, p.caption),
    lastSenderUid: p.me.uid,
    lastMessageAt: serverTimestamp(),
    lastMessageId: p.mediaId,
  });
  await batch.commit();
}
