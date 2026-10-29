import { pairId } from '../social/logic';

export const MESSAGE_MAX = 2000;
export const PREVIEW_MAX = 120;
export const PAGE_SIZE = 30;
export const EDIT_WINDOW_MS = 15 * 60_000; // harus sama dengan duration.value(15,'m') di firestore.rules
// Harus sama dengan daftar di firestore.rules (semua satu titik kode agar tidak ada selisih).
export const REACTION_EMOJIS = ['👍', '💜', '😂', '😮', '😢', '🔥'] as const;
export const QUICK_EMOJIS = ['😀', '😍', '🥰', '😘', '🤗', '😅', '🙏', '🎉'] as const;

export function directCid(a: string, b: string): string {
  return pairId(a, b);
}
export function isDirectCid(cid: string): boolean {
  return /^[A-Za-z0-9]+_[A-Za-z0-9]+$/.test(cid);
}
export function otherUid(cid: string, me: string): string | null {
  if (!isDirectCid(cid)) return null;
  const [a, b] = cid.split('_');
  if (a === me) return b ?? null;
  return b === me ? (a ?? null) : null;
}

export type TextCheck = { ok: true; value: string } | { ok: false; error: string };
export function validateMessageText(raw: string): TextCheck {
  const value = raw.replace(/\r\n/g, '\n').trim();
  if (value.length < 1) return { ok: false, error: 'Pesan kosong.' };
  if (value.length > MESSAGE_MAX) return { ok: false, error: `Pesan maksimal ${MESSAGE_MAX} karakter.` };
  return { ok: true, value };
}

export function previewText(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > PREVIEW_MAX ? `${t.slice(0, PREVIEW_MAX - 1)}…` : t;
}

export function canEditMessage(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs < EDIT_WINDOW_MS;
}

export type DeliveryStatus = 'sending' | 'sent' | 'read';
/** "Dibaca" hanya untuk chat pribadi dan hanya bila lawan bicara mengaktifkan read receipt. */
export function deliveryStatus(m: { pending: boolean; createdAtMs: number }, otherLastReadMs: number | null): DeliveryStatus {
  if (m.pending) return 'sending';
  return otherLastReadMs !== null && otherLastReadMs >= m.createdAtMs ? 'read' : 'sent';
}

export function summarizeReactions(reactions: Record<string, string>): { emoji: string; count: number; uids: string[] }[] {
  const by = new Map<string, string[]>();
  for (const [uid, emoji] of Object.entries(reactions)) by.set(emoji, [...(by.get(emoji) ?? []), uid]);
  return [...by.entries()].map(([emoji, uids]) => ({ emoji, count: uids.length, uids })).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
}

export function isUnread(meta: { lastSenderUid: string; lastMessageAtMs: number } | null | undefined, lastReadMs: number | null | undefined, me: string): boolean {
  if (!meta || meta.lastSenderUid === me) return false;
  return lastReadMs == null || meta.lastMessageAtMs > lastReadMs;
}

/** Pencarian di pesan yang sudah dimuat (Firestore tidak punya pencarian teks). Pesan terhapus tidak ikut. */
export function filterMessages<T extends { text: string; deleted: boolean }>(msgs: T[], term: string): T[] {
  const q = term.trim().toLowerCase();
  if (!q) return msgs;
  return msgs.filter((m) => !m.deleted && m.text.toLowerCase().includes(q));
}
