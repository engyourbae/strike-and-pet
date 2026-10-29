export interface AchievementDef {
  id: string;
  title: string;
  description: string;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'first_strike', title: 'Langkah pertama', description: 'Catat strike pertamamu.' },
  { id: 'streak_3', title: 'Mulai konsisten', description: 'Streak 3 hari.' },
  { id: 'streak_7', title: 'Seminggu penuh', description: 'Streak 7 hari.' },
  { id: 'streak_30', title: 'Sebulan setia', description: 'Streak 30 hari.' },
  { id: 'pet_lvl_3', title: 'Pet bertumbuh', description: 'Pet mencapai level 3.' },
  { id: 'pet_lvl_5', title: 'Sahabat sejati', description: 'Pet mencapai level 5.' },
  { id: 'pet_lvl_10', title: 'Legenda kecil', description: 'Pet mencapai level 10.' },
  { id: 'group_streak_7', title: 'Kompak seminggu', description: 'Streak grup 7 hari.' },
];

export interface AchievementContext {
  totalDays: number;
  streakLongest: number;
  petLevel: number;
  groupLongest: number;
}

export function earnedAchievementIds(c: AchievementContext): string[] {
  const out: string[] = [];
  if (c.totalDays >= 1) out.push('first_strike');
  if (c.streakLongest >= 3) out.push('streak_3');
  if (c.streakLongest >= 7) out.push('streak_7');
  if (c.streakLongest >= 30) out.push('streak_30');
  if (c.petLevel >= 3) out.push('pet_lvl_3');
  if (c.petLevel >= 5) out.push('pet_lvl_5');
  if (c.petLevel >= 10) out.push('pet_lvl_10');
  if (c.groupLongest >= 7) out.push('group_streak_7');
  return out;
}
