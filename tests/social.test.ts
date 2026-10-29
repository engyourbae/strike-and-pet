import { describe, expect, it } from 'vitest';
import {
  MAX_SQUAD_MEMBERS, invitationId, maxMembersFor, pairId, requestId, validateGroupName, validateInviteeCount,
} from '@/features/social/logic';

describe('id dokumen sosial', () => {
  it('pairId tidak bergantung urutan argumen', () => {
    expect(pairId('b', 'a')).toBe('a_b');
    expect(pairId('a', 'b')).toBe(pairId('b', 'a'));
  });
  it('requestId searah, invitationId menyertakan grup', () => {
    expect(requestId('a', 'b')).toBe('a_b');
    expect(requestId('b', 'a')).not.toBe(requestId('a', 'b'));
    expect(invitationId('g1', 'u2')).toBe('g1_u2');
  });
});

describe('batas grup', () => {
  it('duo 2 anggota, squad sesuai batas', () => {
    expect(maxMembersFor('duo')).toBe(2);
    expect(maxMembersFor('squad')).toBe(MAX_SQUAD_MEMBERS);
  });
  it('duo wajib tepat 1 undangan', () => {
    expect(validateInviteeCount('duo', 1)).toBeNull();
    expect(validateInviteeCount('duo', 0)).not.toBeNull();
    expect(validateInviteeCount('duo', 2)).not.toBeNull();
  });
  it('squad 1 sampai batas-1 undangan', () => {
    expect(validateInviteeCount('squad', 0)).not.toBeNull();
    expect(validateInviteeCount('squad', MAX_SQUAD_MEMBERS - 1)).toBeNull();
    expect(validateInviteeCount('squad', MAX_SQUAD_MEMBERS)).not.toBeNull();
  });
});

describe('nama grup', () => {
  it('merapikan spasi', () => {
    expect(validateGroupName('  Tim   Hore ')).toEqual({ ok: true, value: 'Tim Hore' });
  });
  it('menolak kosong dan terlalu panjang', () => {
    expect(validateGroupName('   ').ok).toBe(false);
    expect(validateGroupName('x'.repeat(41)).ok).toBe(false);
  });
});
