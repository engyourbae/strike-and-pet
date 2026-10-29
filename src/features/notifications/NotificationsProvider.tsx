import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { doc } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/client';
import { useSettings } from '@/app/SettingsProvider';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useNow } from '@/hooks/useNow';
import { useChat } from '@/features/chat/ChatProvider';
import { useLocationSessions } from '@/features/location/useLocationSessions';
import { useProfiles } from '@/hooks/useProfiles';
import { useInbox } from '@/features/social/InboxProvider';
import { localNotificationsEnabled, showLocalNotification } from '@/features/push/push.service';
import { dateKey } from '@/shared/dates';
import { decayed, moodOf, parsePetState } from '@/shared/petLogic';
import { effectiveStreak, parseStreakState, struckToday } from '@/shared/streakLogic';
import { deviceTimeZone } from '@/utils/tz';

export interface AppNotification {
  id: string;
  kind: 'friend' | 'invite' | 'message' | 'streak' | 'pet' | 'location';
  text: string;
  to: string;
}

interface Ctx {
  items: AppNotification[];
}

const NotificationsContext = createContext<Ctx>({ items: [] });

/**
 * Notifikasi dalam aplikasi, diturunkan realtime dari data yang sudah ada (tanpa server tambahan):
 * permintaan teman, undangan grup, pesan belum dibaca, pengingat streak, dan perawatan Pet.
 * Pengingat dan pesan bisa dimatikan di Pengaturan. Bila pengguna mengaktifkannya, item baru juga tampil sebagai
 * notifikasi sistem saat aplikasi di latar belakang (tanpa FCM; tidak berfungsi bila aplikasi ditutup).
 */
export function NotificationsProvider({ uid, children }: { uid: string; children: ReactNode }) {
  const { settings } = useSettings();
  const { requests, invitations } = useInbox();
  const { items: chats } = useChat();
  const now = useNow(60_000);
  const { othersActive } = useLocationSessions(uid);
  const sharers = useProfiles(othersActive.map((s) => s.ownerUid));
  const streak = useLiveDoc(`streak:${uid}`, () => doc(getFirebase().db, 'streaks', uid), parseStreakState);
  const pet = useLiveDoc(`pet:${uid}`, () => doc(getFirebase().db, 'petProfiles', uid), parsePetState);

  const items = useMemo<AppNotification[]>(() => {
    const out: AppNotification[] = [];
    for (const r of requests) out.push({ id: `req:${r.id}`, kind: 'friend', text: `@${r.fromUsername} ingin berteman denganmu`, to: '/teman' });
    for (const i of invitations) out.push({ id: `inv:${i.id}`, kind: 'invite', text: `@${i.fromUsername} mengundangmu ke ${i.groupName}`, to: '/grup' });
    if (settings.notifyMessages) {
      for (const c of chats.filter((x) => x.unread && !x.muted)) out.push({ id: `msg:${c.cid}`, kind: 'message', text: `Pesan baru di ${c.title}`, to: `/chat/${c.cid}` });
    }
    if (settings.notifyLocation) {
      for (const l of othersActive) out.push({ id: `loc:${l.id}`, kind: 'location', text: `${sharers[l.ownerUid]?.displayName ?? 'Temanmu'} sedang berbagi lokasi di ${l.groupName}`, to: `/lokasi/${l.id}` });
    }
    const s = streak.data;
    if (settings.remindStreak && s) {
      const today = dateKey(now, deviceTimeZone());
      const eff = effectiveStreak(s, today);
      if (eff > 0 && !struckToday(s, today)) out.push({ id: 'streak', kind: 'streak', text: `Streak ${eff} hari belum dicatat hari ini`, to: '/strike' });
    }
    if (settings.remindPet && pet.data) {
      const mood = moodOf(decayed(pet.data, now));
      const need = mood === 'hungry' ? 'lapar' : mood === 'dirty' ? 'perlu dibersihkan' : mood === 'sad' ? 'merasa sedih' : null;
      if (need) out.push({ id: 'pet', kind: 'pet', text: `${pet.data.name} ${need}`, to: '/pet' });
    }
    return out;
  }, [requests, invitations, chats, settings, streak.data, pet.data, now, othersActive, sharers]);

  // Notifikasi sistem untuk item baru (bukan pengingat streak/Pet). Item awal dan 10 detik pertama dianggap sudah dilihat.
  const seen = useRef<Set<string>>(new Set());
  const mountedAt = useRef(Date.now());
  useEffect(() => {
    const quiet = Date.now() - mountedAt.current < 10_000;
    for (const n of items) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      if (quiet || n.kind === 'streak' || n.kind === 'pet') continue;
      if (document.visibilityState === 'visible' || !localNotificationsEnabled()) continue;
      void showLocalNotification({ title: 'STRIKE & PET', body: n.text, tag: n.id, url: `#${n.to}` });
    }
  }, [items]);

  const value = useMemo(() => ({ items }), [items]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): Ctx {
  return useContext(NotificationsContext);
}
