import type { MediaKind } from '@/shared/mediaLogic';

export type MediaStatus = 'uploading' | 'available' | 'deleted' | 'expired' | 'rejected';

export interface MediaMeta {
  id: string;
  ownerUid: string;
  context: 'chat' | 'story';
  conversationId: string | null;
  kind: MediaKind;
  mime: string;
  size: number;
  durationSec: number;
  caption: string;
  recipients: string[];
  receivedBy: string[];
  status: MediaStatus;
  reason: string | null;
  createdAtMs: number;
  storyExpiresAtMs: number | null;
}
