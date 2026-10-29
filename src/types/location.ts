export interface LocationSession {
  id: string;
  ownerUid: string;
  groupId: string;
  groupName: string;
  viewerUids: string[];
  status: 'active' | 'stopped' | 'expired';
  historyEnabled: boolean;
  durationMin: number;
  startedAtMs: number | null;
  expiresAtMs: number;
  endedAtMs: number | null;
}

export interface LivePos {
  lat: number;
  lng: number;
  acc: number | null;
  speed: number | null;
  src: 'gps' | 'estimated' | null;
  trust: boolean;
  max: number | null;
  avg: number | null;
  tsMs: number;
}
export interface LiveMeta {
  ownerUid: string;
  expiresAtMs: number;
  active: boolean;
}
export interface LiveConn {
  online: boolean;
  tsMs: number | null;
}
