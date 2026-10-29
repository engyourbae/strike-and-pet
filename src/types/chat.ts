export interface Message {
  id: string;
  senderUid: string;
  text: string;
  createdAtMs: number;
  editedAtMs: number | null;
  deleted: boolean;
  reactions: Record<string, string>;
  replyToId: string | null;
  mediaId: string | null;
  pending: boolean;
}

export interface ConversationMeta {
  cid: string;
  lastText: string;
  lastSenderUid: string;
  lastMessageAtMs: number;
  lastMessageId: string;
}

export interface ChatState {
  cid: string;
  lastReadAtMs: number | null;
  muted: boolean;
}
