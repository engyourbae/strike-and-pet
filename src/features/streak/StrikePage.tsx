import { useMemo, useState } from 'react';
import { collection, doc, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useAction } from '@/hooks/useAction';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { useProfiles } from '@/hooks/useProfiles';
import { toGroup } from '@/features/social/mappers';
import { ACHIEVEMENTS } from '@/shared/achievements';
import { dateKey } from '@/shared/dates';
import {
  MAX_FREEZES, effectiveGroupStreak, effectiveStreak, initialStreak, parseGroupStreak, parseStreakState, struckToday,
} from '@/shared/streakLogic';
import type { Group } from '@/types/social';
import type { UserProfile } from '@/types/user';
import { buildMonthGrid } from '@/utils/calendar';
import { deviceTimeZone } from '@/utils/tz';
import { dailyStrike } from './streak.service';

function GroupStreakRow({ group, now }: { group: Group; now: number }) {
  const live = useLiveDoc(`gs:${group.id}`, () => doc(getFirebase().db, 'groupStreaks', group.id), parseGroupStreak);
  const profiles = useProfiles(group.memberUids);
  const g = live.data;
  const today = g ? dateKey(now, g.tz) : '';
  const doneToday = g && g.dayDate === today ? g.dayUids : [];
  return (
    <li>
      <span className="grow">
        <strong>{group.name}</strong>
        <span className="field-hint">
          {g ? `Streak ${effectiveGroupStreak(g, today)} hari · rekor ${g.longest}` : 'Belum ada strike grup'}
        </span>
        <span className="field-hint">
          Hari ini: {group.memberUids.map((uid) => `${profiles[uid]?.displayName ?? '…'} ${doneToday.includes(uid) ? '✓' : '○'}`).join(' · ')}
        </span>
      </span>
    </li>
  );
}

export function StrikePage({ me }: { me: UserProfile }) {
  const tz = deviceTimeZone();
  const now = Date.now();
  const today = dateKey(now, tz);
  const streakLive = useLiveDoc(`streak:${me.uid}`, () => doc(getFirebase().db, 'streaks', me.uid), parseStreakState);
  const achLive = useLiveDoc(
    `ach:${me.uid}`,
    () => doc(getFirebase().db, 'achievements', me.uid),
    (d) => {
      const u: unknown = d.unlocked;
      return typeof u === 'object' && u !== null ? Object.keys(u) : [];
    },
  );
  const groups = useLiveQuery(`groups:${me.uid}`, () => query(collection(getFirebase().db, 'groups'), where('memberUids', 'array-contains', me.uid)), toGroup);
  const action = useAction();
  const [notice, setNotice] = useState<string | null>(null);

  const streak = streakLive.data ?? initialStreak();
  const done = struckToday(streak, today);
  const grid = useMemo(() => buildMonthGrid(today), [today]);
  const marked = new Set(streak.recentDays);
  const unlocked = new Set(achLive.data ?? []);

  async function onStrike() {
    setNotice(null);
    const holder: { value?: Awaited<ReturnType<typeof dailyStrike>> } = {};
    const ok = await action.run(async () => { holder.value = await dailyStrike(); });
    const r = holder.value;
    if (ok && r) {
      const parts = [r.outcome === 'counted' ? `Strike tercatat! Streak ${r.streak.current} hari (+${r.xpGained} XP)` : 'Strike hari ini sudah tercatat.'];
      if (r.usedFreeze) parts.push('Hari istirahat dipakai untuk menjaga streak');
      if (r.earnedFreeze) parts.push('Kamu mendapat 1 hari istirahat');
      if (r.broke) parts.push('Streak sebelumnya putus, mulai lagi dari 1');
      for (const g of r.groups.filter((x) => x.justCompleted)) parts.push(`Hari grup lengkap! Streak grup ${g.current}`);
      for (const id of r.newAchievements) parts.push(`Achievement: ${ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id}`);
      setNotice(parts.join(' · '));
    }
  }

  if (streakLive.loading) return <div className="stack"><Skeleton height={160} /><Skeleton height={200} /></div>;

  return (
    <>
      <h1>Strike</h1>
      <section className="card">
        <p style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{effectiveStreak(streak, today)} hari</p>
        <p className="field-hint">Rekor {streak.longest} hari · total {streak.totalDays} hari · hari istirahat {streak.freezes}/{MAX_FREEZES}</p>
        <button className="btn btn--primary btn--block" disabled={action.busy || done} onClick={() => void onStrike()}>
          {done ? 'Strike hari ini sudah tercatat ✓' : action.busy ? 'Mencatat…' : 'Catat strike hari ini'}
        </button>
        {action.error && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{action.error}</p>}
        {notice && <p className="field-hint" role="status" style={{ marginTop: 12 }}>{notice}</p>}
      </section>

      <section className="card" aria-labelledby="h-cal">
        <h2 id="h-cal">{grid.label}</h2>
        <div className="cal" role="grid" aria-label="Kalender aktivitas">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => <span key={d} className="dow">{d}</span>)}
          {grid.cells.map((c, i) => c === null
            ? <span key={`e${i}`} />
            : <span key={c} className={`${marked.has(c) ? 'on' : ''} ${c === today ? 'today' : ''}`} aria-label={`${c}${marked.has(c) ? ', strike tercatat' : ''}`}>{Number(c.slice(8))}</span>)}
        </div>
      </section>

      <section className="card" aria-labelledby="h-gs">
        <h2 id="h-gs">Streak grup</h2>
        {groups.data.length === 0
          ? <p style={{ margin: 0 }}>Gabung atau buat Duo/Squad di tab <Link to="/grup">Grup</Link>. Hari grup lengkap bila semua anggota strike di hari yang sama.</p>
          : <ul className="list">{groups.data.map((g) => <GroupStreakRow key={g.id} group={g} now={now} />)}</ul>}
      </section>

      <section className="card" aria-labelledby="h-ach">
        <h2 id="h-ach">Achievement</h2>
        <ul className="list">
          {ACHIEVEMENTS.map((a) => (
            <li key={a.id} style={{ opacity: unlocked.has(a.id) ? 1 : 0.5 }}>
              <span aria-hidden="true">{unlocked.has(a.id) ? '★' : '☆'}</span>
              <span className="grow"><strong>{a.title}</strong><span className="field-hint">{a.description}{unlocked.has(a.id) ? '' : ' (terkunci)'}</span></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="h-rule">
        <h2 id="h-rule">Aturan streak</h2>
        <ul className="list field-hint" style={{ display: 'block', paddingLeft: 18, listStyle: 'disc' }}>
          <li>Satu strike per hari kalender, mengikuti zona waktu perangkat ({tz}).</li>
          <li>Terlewat 1 hari? Hari istirahat otomatis menjaga streak. Kamu mendapat 1 setiap 7 hari berturut-turut (maks {MAX_FREEZES}).</li>
          <li>Streak grup dihitung di zona waktu grup; hari lengkap jika semua anggota saat ini sudah strike.</li>
          <li>XP dan achievement dihitung di server dan tidak bisa diklaim ulang.</li>
        </ul>
      </section>
    </>
  );
}
