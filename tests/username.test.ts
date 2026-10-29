import { describe, expect, it } from 'vitest';
import { normalizeUsername, validateUsername } from '@/features/profile/username';
import { resolveTheme } from '@/utils/theme';

describe('username', () => {
  it('menormalkan @ dan huruf besar', () => {
    expect(normalizeUsername('  @Budi_99 ')).toBe('budi_99');
  });
  it('menerima username valid', () => {
    expect(validateUsername('@budi_99')).toEqual({ ok: true, value: 'budi_99' });
  });
  it.each(['ab', '9budi', 'bu di', 'budi!', 'a'.repeat(21), '_budi'])('menolak %s', (v) => {
    expect(validateUsername(v).ok).toBe(false);
  });
  it('menolak username yang dicadangkan', () => {
    expect(validateUsername('admin').ok).toBe(false);
  });
});

describe('tema', () => {
  it('terang/gelap eksplisit tidak terpengaruh sistem', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('system mengikuti preferensi perangkat', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
