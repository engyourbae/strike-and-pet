import { Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { ChatState, ConversationMeta, Message } from '@/types/chat';

function ms(v: unknown): number | null {
  return v instanceof Timestamp ? v.toMillis() : null;
}

export function toMessage(snap: QueryDocumentSnapshot): Message | null {
  const d = snap.data({ serverTimestamps: 'estimate' });
  if (typeof d.senderUid !== 'string' || typeof d.text !== 'string') return null;
  const reactions: Record<string, string> = {};
  if (typeof d.reactions === 'object' && d.reactions !== null) {
    for (const [k, v] of Object.entries(d.reactions as Record<string, unknown>)) if (typeof v === 'string') reactions[k] = v;
  }
  return {
    id: snap.id,
    senderUid: d.senderUid,
    text: d.text,
    createdAtMs: ms(d.createdAt) ?? Date.now(),
    editedAtMs: ms(d.editedAt),
    deleted: d.deleted === true,
    reactions,
    replyToId: typeof d.replyToId === 'string' ? d.replyToId : null,
    mediaId: typeof d.mediaId === 'string' ? d.mediaId : null,
    pending: snap.metadata.hasPendingWrites,
  };
}

export function toMeta(cid: string, d: DocumentData): ConversationMeta | null {
  const at = ms(d.lastMessageAt);
  if (typeof d.lastSenderUid !== 'string' || typeof d.lastMessageId !== 'string' || at === null) return null;
  return { cid, lastText: typeof d.lastText === 'string' ? d.lastText : '', lastSenderUid: d.lastSenderUid, lastMessageAtMs: at, lastMessageId: d.lastMessageId };
}

export function toChatState(cid: string, d: DocumentData): ChatState {
  return { cid, lastReadAtMs: ms(d.lastReadAt), muted: d.muted === true };
}
