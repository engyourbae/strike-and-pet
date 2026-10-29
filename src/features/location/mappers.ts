import { Timestamp, type DocumentData } from 'firebase/firestore';
import { isValidCoord } from '@/shared/locationLogic';
import type { LiveConn, LiveMeta, LivePos, LocationSession } from '@/types/location';

const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null);

export function parseSession(id: string, d: DocumentData): LocationSession | null {
  const status = d.status === 'active' || d.status === 'stopped' || d.status === 'expired' ? d.status : null;
  const exp = ms(d.expiresAt);
  if (!status || exp === null || typeof d.ownerUid !== 'string') return null;
  return {
    id,
    ownerUid: d.ownerUid,
    groupId: typeof d.groupId === 'string' ? d.groupId : '',
    groupName: typeof d.groupName === 'string' ? d.groupName : '',
    viewerUids: Array.isArray(d.viewerUids) ? d.viewerUids.filter((x): x is string => typeof x === 'string') : [],
    status,
    historyEnabled: d.historyEnabled === true,
    durationMin: typeof d.durationMin === 'number' ? d.durationMin : 0,
    startedAtMs: ms(d.startedAt),
    expiresAtMs: exp,
    endedAtMs: ms(d.endedAt),
  };
}

export function parsePos(v: unknown): LivePos | null {
  const r = obj(v);
  if (!r || !isValidCoord(r.lat, r.lng) || typeof r.ts !== 'number') return null;
  return {
    lat: r.lat as number,
    lng: r.lng as number,
    acc: numOrNull(r.acc),
    speed: numOrNull(r.speed),
    src: r.src === 'gps' || r.src === 'estimated' ? r.src : null,
    trust: r.trust === true,
    max: numOrNull(r.max),
    avg: numOrNull(r.avg),
    tsMs: r.ts,
  };
}

export function parseMeta(v: unknown): LiveMeta | null {
  const r = obj(v);
  if (!r || typeof r.ownerUid !== 'string' || typeof r.expiresAt !== 'number') return null;
  return { ownerUid: r.ownerUid, expiresAtMs: r.expiresAt, active: r.active === true };
}

export function parseConn(v: unknown): LiveConn | null {
  const r = obj(v);
  if (!r || typeof r.online !== 'boolean') return null;
  return { online: r.online, tsMs: numOrNull(r.ts) };
}
