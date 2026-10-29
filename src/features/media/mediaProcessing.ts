import { MEDIA_LIMITS, fitWithin, kindOfMime, sniffMime, validateMediaMeta, type MediaKind } from '@/shared/mediaLogic';

export interface PreparedMedia {
  kind: MediaKind;
  mime: string;
  blob: Blob;
  thumb: Blob | null;
  width: number;
  height: number;
  durationSec: number;
}
export type PrepareResult = { ok: true; media: PreparedMedia } | { ok: false; error: string };

const MAX_INPUT_BYTES = 60 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function sniff(file: Blob): Promise<string | null> {
  return sniffMime(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
}

async function imageThumb(bitmap: ImageBitmap): Promise<Blob | null> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MEDIA_LIMITS.thumbDim);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  c.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  return toBlob(c, 'image/jpeg', 0.7);
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('video'));
    v.src = url;
  });
}

async function videoThumb(video: HTMLVideoElement): Promise<Blob | null> {
  try {
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('timeout')), 3000);
      video.onseeked = () => { window.clearTimeout(t); resolve(); };
      video.currentTime = Math.min(0.1, (video.duration || 0.2) / 2);
    });
    const { width, height } = fitWithin(video.videoWidth, video.videoHeight, MEDIA_LIMITS.thumbDim);
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d')?.drawImage(video, 0, 0, width, height);
    return await toBlob(c, 'image/jpeg', 0.7);
  } catch {
    return null; // thumbnail opsional
  }
}

async function prepareImage(file: File): Promise<PrepareResult> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // juga menerapkan orientasi EXIF
  } catch {
    return { ok: false, error: 'Gambar tidak bisa dibaca di perangkat ini.' };
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MEDIA_LIMITS.imageMaxDim);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ok: false, error: 'Browser tidak mendukung pemrosesan gambar.' };
    ctx.fillStyle = '#fff'; // PNG transparan -> latar putih saat dikompres ke JPEG
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    // Re-encode menghapus metadata EXIF (termasuk lokasi GPS foto).
    let blob = await toBlob(canvas, 'image/jpeg', MEDIA_LIMITS.imageQuality);
    if (blob && blob.size > MEDIA_LIMITS.imageMaxBytes) blob = await toBlob(canvas, 'image/jpeg', 0.6);
    if (!blob) return { ok: false, error: 'Gagal memproses gambar.' };
    const invalid = validateMediaMeta({ mime: 'image/jpeg', size: blob.size, durationSec: 0 });
    if (invalid) return { ok: false, error: invalid };
    return { ok: true, media: { kind: 'image', mime: 'image/jpeg', blob, thumb: await imageThumb(bitmap), width, height, durationSec: 0 } };
  } finally {
    bitmap.close();
  }
}

async function prepareVideo(file: File, mime: string): Promise<PrepareResult> {
  const url = URL.createObjectURL(file);
  try {
    let video: HTMLVideoElement;
    try {
      video = await loadVideo(url);
    } catch {
      return { ok: false, error: 'Format video ini tidak didukung browser kamu.' };
    }
    const durationSec = Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : 0;
    const invalid = validateMediaMeta({ mime, size: file.size, durationSec });
    if (invalid) return { ok: false, error: invalid };
    const thumb = await videoThumb(video);
    const blob = file.type === mime ? file : new Blob([file], { type: mime });
    return { ok: true, media: { kind: 'video', mime, blob, thumb, width: video.videoWidth || 0, height: video.videoHeight || 0, durationSec } };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Memvalidasi (isi berkas, bukan hanya ekstensi/MIME), mengompres foto, dan membuat thumbnail. */
export async function prepareFile(file: File): Promise<PrepareResult> {
  if (file.size <= 0) return { ok: false, error: 'Berkas kosong.' };
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: 'Berkas terlalu besar.' };
  const mime = await sniff(file);
  const kind = mime ? kindOfMime(mime) : null;
  if (!mime || !kind) return { ok: false, error: 'Format tidak didukung. Gunakan JPEG, PNG, WebP, MP4, WebM, atau MOV.' };
  return kind === 'image' ? prepareImage(file) : prepareVideo(file, mime);
}

/** Thumbnail untuk media yang baru diterima (best effort). */
export async function makeThumbnailFromBlob(blob: Blob, kind: MediaKind): Promise<Blob | null> {
  try {
    if (kind === 'image') {
      const bmp = await createImageBitmap(blob);
      try { return await imageThumb(bmp); } finally { bmp.close(); }
    }
    const url = URL.createObjectURL(blob);
    try { return await videoThumb(await loadVideo(url)); } finally { URL.revokeObjectURL(url); }
  } catch {
    return null;
  }
}
