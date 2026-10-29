import { connectDatabaseEmulator, getDatabase, type Database } from 'firebase/database';
import { getFirebase } from './client';

let rtdb: Database | null | undefined;

/** Realtime Database untuk data sementara (mengetik, online). null bila VITE_FIREBASE_DATABASE_URL kosong. */
export function getRtdb(): Database | null {
  if (rtdb !== undefined) return rtdb;
  if (!import.meta.env.VITE_FIREBASE_DATABASE_URL) {
    rtdb = null;
    return rtdb;
  }
  const db = getDatabase(getFirebase().app);
  if (import.meta.env.VITE_USE_EMULATORS === 'true') connectDatabaseEmulator(db, '127.0.0.1', 9000);
  rtdb = db;
  return rtdb;
}
