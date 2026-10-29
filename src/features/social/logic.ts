export type GroupType = 'duo' | 'squad';

// Harus sama dengan batas di firestore.rules (squad maksimal 8).
export const MAX_SQUAD_MEMBERS = 8;
export const GROUP_NAME_MAX = 40;

export function pairId(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export function requestId(fromUid: string, toUid: string): string {
  return `${fromUid}_${toUid}`;
}

export function invitationId(groupId: string, toUid: string): string {
  return `${groupId}_${toUid}`;
}

export function maxMembersFor(type: GroupType): number {
  return type === 'duo' ? 2 : MAX_SQUAD_MEMBERS;
}

export type NameCheck = { ok: true; value: string } | { ok: false; error: string };

export function validateGroupName(raw: string): NameCheck {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < 1) return { ok: false, error: 'Nama grup wajib diisi.' };
  if (value.length > GROUP_NAME_MAX) return { ok: false, error: `Nama grup maksimal ${GROUP_NAME_MAX} karakter.` };
  return { ok: true, value };
}

/** Jumlah teman yang diundang saat membuat grup. Pesan error, atau null bila valid. */
export function validateInviteeCount(type: GroupType, count: number): string | null {
  if (type === 'duo') return count === 1 ? null : 'Dynamic Duo membutuhkan tepat 1 teman.';
  if (count < 1) return 'Pilih minimal 1 teman untuk Squad.';
  if (count > MAX_SQUAD_MEMBERS - 1) return `Squad maksimal ${MAX_SQUAD_MEMBERS} anggota termasuk kamu.`;
  return null;
}
