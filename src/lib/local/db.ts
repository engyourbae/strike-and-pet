import Dexie, { type Table } from 'dexie';
import type { MediaKind } from '@/shared/mediaLogic';

/** Salinan media di perangkat. `accountUid` memisahkan akun yang memakai browser yang sama. */
export interface LocalMedia {
  id: string;
  accountUid: string;
  ownerUid: string;
  direction: 'sent' | 'received';
  context: 'chat' | 'story';
  cid: string | null;
  kind: MediaKind;
  mime: string;
  size: number;
  width: number;
  height: number;
  durationSec: number;
  caption: string;
  blob: Blob;
  thumb: Blob | null;
  savedAt: number;
}

/** Antrean unggah. Blob-nya disimpan di tabel `media` (direction 'sent'), bukan di sini. */
export interface OutboxItem {
  id: string;
  accountUid: string;
  context: 'chat' | 'story';
  cid: string | null;
  status: 'queued' | 'uploading' | 'failed';
  error: string | null;
  attempts: number;
  createdAt: number;
}

class LocalDb extends Dexie {
  media!: Table<LocalMedia, string>;
  outbox!: Table<OutboxItem, string>;

  constructor() {
    super('strike-and-pet-local');
    this.version(1).stores({
      media: 'id, accountUid, direction, savedAt',
      outbox: 'id, accountUid, status, createdAt',
    });
  }
}

export const localDb = new LocalDb();
