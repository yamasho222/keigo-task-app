import type { AdventureLocation, AdventureState } from './adventureState';
import { unlockedBattleSkills, validSkillUnlocks } from './battleSkillRules';
import type { DragonSkillKind } from './dragonSkillRules';

export type BattleLearning = {
  version: 1;
  learned: DragonSkillKind[];
  seen: Partial<Record<AdventureLocation, boolean>>;
  pending: { location: AdventureLocation; skills: DragonSkillKind[] } | null;
};
const LOCATIONS = ['fortress', 'warped_forest', 'the_end'] as const;
export const freshBattleLearning = (): BattleLearning => ({ version: 1, learned: ['repel'], seen: {}, pending: null });
export function validBattleLearning(raw: unknown): raw is BattleLearning {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as BattleLearning;
  if (s.version !== 1 || !validSkillUnlocks(s.learned) || !s.learned.includes('repel') || !s.seen || typeof s.seen !== 'object' || Array.isArray(s.seen)
    || Object.entries(s.seen).some(([key, value]) => !LOCATIONS.includes(key as AdventureLocation) || typeof value !== 'boolean')) return false;
  const p = s.pending;
  return p === null || !!p && LOCATIONS.includes(p.location) && !s.seen[p.location] && Array.isArray(p.skills)
    && p.skills.length <= 3 && new Set(p.skills).size === p.skills.length && p.skills.every(kind => s.learned.includes(kind));
}
/** Grandfather every formerly available skill, including pending casts; never relock old players. */
export function migrateBattleLearning(s: AdventureState, locations: readonly string[]): BattleLearning {
  if (s.learning) return s.learning;
  const learned = new Set<DragonSkillKind>(unlockedBattleSkills(locations));
  for (const run of [s.blaze, s.enderman, s.dragon]) {
    for (const kind of run?.unlockedSkills ?? []) learned.add(kind);
    const mode = run?.skills?.pending?.mode ?? run?.skills?.last;
    if (mode) learned.add(mode === 'trace' ? 'repel' : mode);
  }
  return { version: 1, learned: [...learned], seen: {}, pending: null };
}
export function learnOnEncounter(learning: BattleLearning, location: AdventureLocation): BattleLearning {
  if (learning.pending || learning.seen[location]) return learning;
  const milestone: DragonSkillKind[] = location === 'the_end' ? ['aim', 'burst', 'gauge'] : location === 'warped_forest' ? ['aim'] : [];
  const skills = milestone.filter(kind => !learning.learned.includes(kind));
  return { ...learning, learned: [...learning.learned, ...skills], pending: { location, skills } };
}
