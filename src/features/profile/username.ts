// Aturan ini HARUS sama dengan validUsername() di firestore.rules.
export const USERNAME_REGEX = /^[a-z][a-z0-9_]{2,19}$/;

const RESERVED = new Set([
  'admin', 'administrator', 'support', 'help', 'system', 'root', 'null',
  'strike', 'pet', 'strikepet', 'moderator', 'official',
]);

export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export type UsernameCheck = { ok: true; value: string } | { ok: false; error: string };

export function validateUsername(input: string): UsernameCheck {
  const value = normalizeUsername(input);
  if (value.length < 3) return { ok: false, error: 'Username minimal 3 karakter.' };
  if (value.length > 20) return { ok: false, error: 'Username maksimal 20 karakter.' };
  if (!/^[a-z]/.test(value)) return { ok: false, error: 'Username harus diawali huruf.' };
  if (!USERNAME_REGEX.test(value)) {
    return { ok: false, error: 'Gunakan huruf kecil, angka, dan garis bawah saja.' };
  }
  if (RESERVED.has(value)) return { ok: false, error: 'Username ini tidak tersedia.' };
  return { ok: true, value };
}
