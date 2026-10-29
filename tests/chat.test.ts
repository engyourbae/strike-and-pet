import { describe, expect, it } from 'vitest';
import {
  EDIT_WINDOW_MS, canEditMessage, deliveryStatus, directCid, filterMessages, isDirectCid, isUnread, otherUid, previewText, summarizeReactions, validateMessageText,
} from '@/features/chat/logic';

describe('id percakapan', () => {
  it('direct terurut dan dapat dibedakan dari id grup', () => {
    expect(directCid('b', 'a')).toBe('a_b');
    expect(isDirectCid('a_b')).toBe(true);
    expect(isDirectCid('Abc123groupid1234567')).toBe(false);
  });
  it('otherUid hanya untuk peserta', () => {
    expect(otherUid('a_b', 'a')).toBe('b');
    expect(otherUid('a_b', 'z')).toBeNull();
    expect(otherUid('grup1', 'a')).toBeNull();
  });
});

describe('teks pesan', () => {
  it('menolak kosong dan terlalu panjang, merapikan baris baru', () => {
    expect(validateMessageText('   ').ok).toBe(false);
    expect(validateMessageText('x'.repeat(2001)).ok).toBe(false);
    expect(validateMessageText(' halo\r\ndunia ')).toEqual({ ok: true, value: 'halo\ndunia' });
  });
  it('pratinjau dipotong 120 karakter', () => {
    expect(previewText('a'.repeat(200))).toHaveLength(120);
    expect(previewText('a   b\n c')).toBe('a b c');
  });
});

describe('kebijakan edit dan status', () => {
  it('edit hanya dalam jendela 15 menit', () => {
    expect(canEditMessage(0, EDIT_WINDOW_MS - 1)).toBe(true);
    expect(canEditMessage(0, EDIT_WINDOW_MS)).toBe(false);
  });
  it('status pengiriman', () => {
    expect(deliveryStatus({ pending: true, createdAtMs: 5 }, null)).toBe('sending');
    expect(deliveryStatus({ pending: false, createdAtMs: 5 }, null)).toBe('sent');
    expect(deliveryStatus({ pending: false, createdAtMs: 5 }, 4)).toBe('sent');
    expect(deliveryStatus({ pending: false, createdAtMs: 5 }, 5)).toBe('read');
  });
});

describe('reaksi, belum dibaca, pencarian', () => {
  it('merangkum reaksi per emoji', () => {
    expect(summarizeReactions({ u1: '💜', u2: '👍', u3: '💜' })).toEqual([
      { emoji: '💜', count: 2, uids: ['u1', 'u3'] },
      { emoji: '👍', count: 1, uids: ['u2'] },
    ]);
  });
  it('belum dibaca: pesan sendiri tidak dihitung', () => {
    expect(isUnread(null, null, 'me')).toBe(false);
    expect(isUnread({ lastSenderUid: 'me', lastMessageAtMs: 9 }, null, 'me')).toBe(false);
    expect(isUnread({ lastSenderUid: 'x', lastMessageAtMs: 9 }, null, 'me')).toBe(true);
    expect(isUnread({ lastSenderUid: 'x', lastMessageAtMs: 9 }, 9, 'me')).toBe(false);
    expect(isUnread({ lastSenderUid: 'x', lastMessageAtMs: 10 }, 9, 'me')).toBe(true);
  });
  it('pencarian mengabaikan pesan terhapus', () => {
    const ms = [{ text: 'Halo Dunia', deleted: false }, { text: 'rahasia dunia', deleted: true }, { text: 'bye', deleted: false }];
    expect(filterMessages(ms, 'dunia')).toHaveLength(1);
    expect(filterMessages(ms, ' ')).toHaveLength(3);
  });
});
