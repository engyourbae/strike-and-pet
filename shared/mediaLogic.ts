// Logika murni media (dipakai klien dan dijadikan acuan Firestore Rules).

export type MediaKind = 'image' | 'video';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;

// Batas yang dapat dikonfigurasi. Batas ukuran/durasi dan ukuran potongan juga ada di firestore.rules.
export const MEDIA_LIMITS = {
  imageMaxBytes: 10 * 1024 * 1024,
  videoMaxBytes: 25 * 1024 * 1024,
  videoMaxSeconds: 30,
  captionMax: 200,
  imageMaxDim: 1600,
  imageQuality: 0.82,
  thumbDim: 320,
  chatTtlDays: 7, // media chat yang belum diterima kedaluwarsa di server setelah ini
  storyTtlHours: 24,
  autoDownloadMaxBytes: 5 * 1024 * 1024,
} as const;

/**
 * Tanpa Cloud Storage (butuh Blaze), isi berkas dititipkan sebagai potongan di Firestore.
 * Satu dokumen maks 1 MiB, jadi potongan dibatasi 700 KiB (harus sama dengan firestore.rules).
 */
export const MEDIA_CHUNK_BYTES = 716_800;

export function chunkCountFor(size: number): number {
  return Math.max(1, Math.ceil(size / MEDIA_CHUNK_BYTES));
}

export function kindOfMime(mime: string): MediaKind | null {
  if ((IMAGE_MIMES as readonly string[]).includes(mime)) return 'image';
  if ((VIDEO_MIMES as readonly string[]).includes(mime)) return 'video';
  return null;
}

function ascii(b: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...Array.from(b.slice(start, end)));
}

/** Mengenali tipe dari byte awal berkas (jangan percaya MIME dari klien). null = tidak dikenal. */
export function sniffMime(b: Uint8Array): string | null {
  const at = (i: number) => b[i] ?? -1;
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x89 && ascii(b, 1, 4) === 'PNG' && at(4) === 0x0d && at(5) === 0x0a && at(6) === 0x1a && at(7) === 0x0a) return 'image/png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(b, 4, 8) === 'ftyp') return ascii(b, 8, 12) === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  if (at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3) return 'video/webm';
  return null;
}

/** Pesan error (bahasa Indonesia) atau null bila metadata valid. */
export function validateMediaMeta(m: { mime: string; size: number; durationSec: number }): string | null {
  const kind = kindOfMime(m.mime);
  if (!kind) return 'Format tidak didukung. Gunakan JPEG, PNG, WebP, MP4, WebM, atau MOV.';
  if (!Number.isFinite(m.size) || m.size <= 0) return 'Berkas kosong.';
  if (kind === 'image' && m.size > MEDIA_LIMITS.imageMaxBytes) return 'Foto terlalu besar (maksimal 10 MB).';
  if (kind === 'video') {
    if (m.size > MEDIA_LIMITS.videoMaxBytes) return 'Video terlalu besar (maksimal 25 MB).';
    if (!(m.durationSec > 0)) return 'Durasi video tidak terbaca.';
    if (m.durationSec > MEDIA_LIMITS.videoMaxSeconds) return `Video terlalu panjang (maksimal ${MEDIA_LIMITS.videoMaxSeconds} detik).`;
  }
  return null;
}

/** Skala proporsional agar sisi terpanjang tidak melebihi `max` (tidak pernah memperbesar). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export function previewLabel(kind: MediaKind, caption: string): string {
  const c = caption.replace(/\s+/g, ' ').trim();
  if (c) return `${kind === 'image' ? '📷' : '🎬'} ${c}`.slice(0, 120);
  return kind === 'image' ? '📷 Foto' : '🎬 Video';
}
