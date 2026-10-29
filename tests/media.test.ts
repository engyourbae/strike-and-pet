import { describe, expect, it } from 'vitest';
import { MEDIA_CHUNK_BYTES, MEDIA_LIMITS, chunkCountFor, fitWithin, kindOfMime, previewLabel, sniffMime, validateMediaMeta } from '@/shared/mediaLogic';

const bytes = (...n: number[]) => new Uint8Array(n);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('sniffMime (isi berkas, bukan MIME klien)', () => {
  it('mengenali format yang didukung', () => {
    expect(sniffMime(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffMime(Uint8Array.from([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')]))).toBe('image/webp');
    expect(sniffMime(Uint8Array.from([0, 0, 0, 24, ...ascii('ftypisom')]))).toBe('video/mp4');
    expect(sniffMime(Uint8Array.from([0, 0, 0, 20, ...ascii('ftypqt  ')]))).toBe('video/quicktime');
    expect(sniffMime(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm');
  });
  it('menolak HTML/skrip, GIF, dan berkas acak yang menyamar sebagai gambar', () => {
    expect(sniffMime(Uint8Array.from(ascii('<html><script>alert(1)')))).toBeNull();
    expect(sniffMime(Uint8Array.from(ascii('GIF89a......')))).toBeNull();
    expect(sniffMime(new Uint8Array(0))).toBeNull();
  });
});

describe('validasi metadata media', () => {
  it('tipe', () => {
    expect(kindOfMime('image/png')).toBe('image');
    expect(kindOfMime('video/webm')).toBe('video');
    expect(kindOfMime('image/svg+xml')).toBeNull();
    expect(kindOfMime('application/pdf')).toBeNull();
  });
  it('ukuran dan durasi', () => {
    expect(validateMediaMeta({ mime: 'image/jpeg', size: 1000, durationSec: 0 })).toBeNull();
    expect(validateMediaMeta({ mime: 'image/jpeg', size: MEDIA_LIMITS.imageMaxBytes + 1, durationSec: 0 })).not.toBeNull();
    expect(validateMediaMeta({ mime: 'video/mp4', size: 1e6, durationSec: MEDIA_LIMITS.videoMaxSeconds })).toBeNull();
    expect(validateMediaMeta({ mime: 'video/mp4', size: 1e6, durationSec: MEDIA_LIMITS.videoMaxSeconds + 1 })).not.toBeNull();
    expect(validateMediaMeta({ mime: 'video/mp4', size: 1e6, durationSec: 0 })).not.toBeNull();
    expect(validateMediaMeta({ mime: 'video/mp4', size: MEDIA_LIMITS.videoMaxBytes + 1, durationSec: 5 })).not.toBeNull();
    expect(validateMediaMeta({ mime: 'image/png', size: 0, durationSec: 0 })).not.toBeNull();
  });
  it('fitWithin tidak memperbesar dan menjaga proporsi', () => {
    expect(fitWithin(4000, 2000, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1, 5000, 1600)).toEqual({ width: 1, height: 1600 });
  });
  it('pratinjau pesan media', () => {
    expect(previewLabel('image', '')).toBe('📷 Foto');
    expect(previewLabel('video', '  liburan  seru ')).toBe('🎬 liburan seru');
  });
});

describe('potongan media (Firestore, tanpa Storage)', () => {
  it('jumlah potongan sesuai ukuran dan batas Rules (maks 40, 700 KiB per potongan)', () => {
    expect(MEDIA_CHUNK_BYTES).toBe(700 * 1024);
    expect(chunkCountFor(1)).toBe(1);
    expect(chunkCountFor(MEDIA_CHUNK_BYTES)).toBe(1);
    expect(chunkCountFor(MEDIA_CHUNK_BYTES + 1)).toBe(2);
    expect(chunkCountFor(MEDIA_LIMITS.videoMaxBytes)).toBeLessThanOrEqual(40);
    expect(chunkCountFor(MEDIA_LIMITS.videoMaxBytes) * MEDIA_CHUNK_BYTES).toBeGreaterThanOrEqual(MEDIA_LIMITS.videoMaxBytes);
  });
});
