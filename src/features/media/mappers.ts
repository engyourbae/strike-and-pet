import { Timestamp, type DocumentData } from 'firebase/firestore';
import type { MediaMeta, MediaStatus } from '@/types/media';

const STATUSES: MediaStatus[] = ['uploading', 'available', 'deleted', 'expired', 'rejected'];
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);

export function parseMediaMeta(id: string, d: DocumentData): MediaMeta | null {
  const kind = d.kind === 'image' || d.kind === 'video' ? d.kind : null;
  const context = d.context === 'chat' || d.context === 'story' ? d.context : null;
  const status = STATUSES.find((s) => s === d.status);
  if (!kind || !context || !status || typeof d.ownerUid !== 'string' || typeof d.mime !== 'string' || typeof d.size !== 'number') return null;
  return {
    id,
    ownerUid: d.ownerUid,
    context,
    conversationId: typeof d.conversationId === 'string' ? d.conversationId : null,
    kind,
    mime: d.mime,
    size: d.size,
    durationSec: typeof d.durationSec === 'number' ? d.durationSec : 0,
    caption: typeof d.caption === 'string' ? d.caption : '',
    recipients: strs(d.recipients),
    receivedBy: strs(d.receivedBy),
    status,
    reason: typeof d.reason === 'string' ? d.reason : null,
    createdAtMs: ms(d.createdAt) ?? Date.now(),
    storyExpiresAtMs: ms(d.storyExpiresAt),
  };
}
