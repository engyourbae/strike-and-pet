import { useEffect, useState, type FormEvent } from 'react';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/Skeleton';
import { getFirebase } from '@/lib/firebase/client';
import { useAction } from '@/hooks/useAction';
import { useLiveDoc } from '@/hooks/useLiveDoc';
import {
  ACTIONS, SPECIES_LIST, cooldownLeftMs, decayed, levelProgress, moodOf, parsePetState, type PetAction, type PetState, type Species,
} from '@/shared/petLogic';
import { ACHIEVEMENTS } from '@/shared/achievements';
import type { UserProfile } from '@/types/user';
import { PetCharacter, moodLabel, type Reaction } from './PetCharacter';
import { adoptPet, performPetAction, renamePet } from './pet.service';

function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.round(value);
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}><span className="field-hint">{label}</span><span className="field-hint">{v}%</span></div>
      <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} data-low={v < 30}><i style={{ width: `${v}%` }} /></div>
    </div>
  );
}

function AdoptPet() {
  const [species, setSpecies] = useState<Species>('mochi');
  const [name, setName] = useState('');
  const { busy, error, run } = useAction();
  return (
    <>
      <h1>Pilih Pet-mu</h1>
      <form className="card" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(() => adoptPet(species, name).then(() => undefined)); }}>
        <div className="seg" role="radiogroup" aria-label="Jenis Pet" style={{ marginBottom: 16 }}>
          {SPECIES_LIST.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={species === s.id} onClick={() => setSpecies(s.id)}>
              <div className="row"><PetCharacter species={s.id} mood="idle" reaction={null} size={56} /><span><strong>{s.label}</strong><div className="field-hint">{s.blurb}</div></span></div>
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="petname">Nama Pet</label>
          <input id="petname" className="input" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="btn btn--primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Mengadopsi…' : 'Adopsi'}</button>
        {error && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
      </form>
    </>
  );
}

function PetView({ uid, pet }: { uid: string; pet: PetState }) {
  const [now, setNow] = useState(() => Date.now());
  const [reaction, setReaction] = useState<Reaction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const act = useAction();
  const rename = useAction();

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (!reaction) return;
    const t = window.setTimeout(() => setReaction(null), 1600);
    return () => window.clearTimeout(t);
  }, [reaction]);

  const view = decayed(pet, now);
  const hour = new Date(now).getHours();
  const sleeping = hour >= 22 || hour < 6;
  const mood = sleeping && moodOf(view) !== 'hungry' ? 'sleep' : moodOf(view);
  const lv = levelProgress(pet.xp);

  async function doAction(action: PetAction) {
    setNotice(null);
    let result: Awaited<ReturnType<typeof performPetAction>> | undefined;
    const ok = await act.run(async () => { result = await performPetAction(action); });
    if (ok) {
      setReaction(action);
      setNow(Date.now());
      const r = result;
      const parts: string[] = [];
      if (r) {
        parts.push(r.xpGained > 0 ? `+${r.xpGained} XP` : 'Batas XP harian tercapai, perawatan tetap tercatat');
        if (r.leveledUp) parts.push('Naik level!');
        for (const id of r.newAchievements) parts.push(`Achievement: ${ACHIEVEMENTS.find((a) => a.id === id)?.title ?? id}`);
      }
      setNotice(parts.join(' · '));
    }
  }

  return (
    <>
      <h1>{pet.name}</h1>
      <div className="pet-stage"><PetCharacter species={pet.species} mood={mood} reaction={reaction} /></div>
      <p style={{ textAlign: 'center', marginTop: 8 }}>Suasana: {moodLabel(mood)} · Level {lv.level}</p>

      <section className="card" aria-label="Status Pet">
        <Meter label={`XP level ${lv.level}`} value={(lv.current / lv.needed) * 100} />
        <div className="stack" style={{ marginTop: 16 }}>
          <Meter label="Kenyang" value={view.fullness} />
          <Meter label="Senang" value={view.joy} />
          <Meter label="Bersih" value={view.cleanliness} />
        </div>
      </section>

      <section className="card" aria-label="Perawatan">
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(Object.keys(ACTIONS) as PetAction[]).map((a) => {
            const left = cooldownLeftMs(pet, a, now);
            return (
              <button key={a} className="btn btn--primary" disabled={act.busy || left > 0} onClick={() => void doAction(a)}>
                {ACTIONS[a].label}{left > 0 ? ` (${Math.ceil(left / 60_000)} mnt)` : ''}
              </button>
            );
          })}
        </div>
        {act.error && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{act.error}</p>}
        {notice && <p className="field-hint" role="status" style={{ marginTop: 12 }}>{notice}</p>}
        <p className="field-hint" style={{ marginTop: 12 }}>Statistik turun perlahan seiring waktu. Jeda dan XP dihitung di server.</p>
      </section>

      <form className="card" onSubmit={(e) => { e.preventDefault(); if (renaming !== null) void rename.run(() => renamePet(uid, renaming)).then((ok) => ok && setRenaming(null)); }}>
        <div className="field">
          <label htmlFor="rename-pet">Ganti nama</label>
          <input id="rename-pet" className="input" maxLength={20} value={renaming ?? pet.name} onChange={(e) => setRenaming(e.target.value)} />
        </div>
        <button className="btn btn--ghost" type="submit" disabled={rename.busy || renaming === null || renaming.trim() === pet.name}>Simpan nama</button>
        {rename.error && <p className="field-error" role="alert" style={{ marginTop: 12 }}>{rename.error}</p>}
      </form>
    </>
  );
}

export function PetPage({ me }: { me: UserProfile }) {
  const live = useLiveDoc(`pet:${me.uid}`, () => doc(getFirebase().db, 'petProfiles', me.uid), parsePetState);
  if (live.loading) return <div className="stack"><Skeleton height={220} /><Skeleton height={120} /></div>;
  if (live.error) return <p className="field-error" role="alert">{live.error}</p>;
  return live.data ? <PetView uid={me.uid} pet={live.data} /> : <AdoptPet />;
}
