import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { usePresencePublisher } from '@/hooks/usePresence';

export interface UserSettings {
  readReceipts: boolean;
  showOnline: boolean;
  remindStreak: boolean;
  remindPet: boolean;
  notifyMessages: boolean;
  notifyLocation: boolean;
}

// Privasi dulu: status online mati secara default; tanda dibaca menyala (bisa dimatikan).
export const DEFAULT_SETTINGS: UserSettings = { readReceipts: true, showOnline: false, remindStreak: true, remindPet: true, notifyMessages: true, notifyLocation: true };

export function parseSettings(d: unknown): UserSettings {
  const r = typeof d === 'object' && d !== null ? (d as Record<string, unknown>) : {};
  const b = (k: keyof UserSettings): boolean => (typeof r[k] === 'boolean' ? (r[k] as boolean) : DEFAULT_SETTINGS[k]);
  return { readReceipts: b('readReceipts'), showOnline: b('showOnline'), remindStreak: b('remindStreak'), remindPet: b('remindPet'), notifyMessages: b('notifyMessages'), notifyLocation: b('notifyLocation') };
}

interface Ctx {
  settings: UserSettings;
  update: (patch: Partial<UserSettings>) => Promise<void>;
}

const SettingsContext = createContext<Ctx>({ settings: DEFAULT_SETTINGS, update: async () => {} });

export function SettingsProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const live = useLiveDoc(`settings:${uid}`, () => doc(getFirebase().db, 'userSettings', uid), parseSettings);
  const settings = live.data ?? DEFAULT_SETTINGS;
  usePresencePublisher(settings.showOnline, uid);
  const update = useCallback(async (patch: Partial<UserSettings>) => {
    await setDoc(doc(getFirebase().db, 'userSettings', uid), patch, { merge: true });
  }, [uid]);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  return useContext(SettingsContext);
}
