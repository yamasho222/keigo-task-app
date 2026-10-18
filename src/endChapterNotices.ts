import type { MiningState } from './miningTypes';

export type EndChapterNotice = 'fortress' | 'crafting';
export type EndChapterNotices = Partial<Record<EndChapterNotice, boolean>>;

export function readEndChapterNotices(raw: unknown): EndChapterNotices {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return { fortress: value.fortress === true, crafting: value.crafting === true };
}

/** Both legacy owners and players who already spent their debris can catch up. */
export function pendingEndChapterNotice(mining: MiningState, tab: string, blocked: boolean): EndChapterNotice | null {
  if (blocked) return null;
  if (tab === 'craft' && !mining.endChapterNotices?.crafting) return 'crafting';
  if (tab === 'mine' && !mining.endChapterNotices?.fortress
    && ((mining.materials.ancient_debris ?? 0) > 0 || mining.endJourney?.debrisFound
      || mining.unlockedGachas.includes('fortress'))) return 'fortress';
  return null;
}

export function acknowledgeEndChapterNotice(mining: MiningState, kind: EndChapterNotice): MiningState {
  return { ...mining, endChapterNotices: { ...mining.endChapterNotices, [kind]: true } };
}

/** Only availability is decided here. Opening help never dispatches a battle action. */
export function recoveryAvailability(bread: number, foodToday: number, hp: number, maxHp: number) {
  if (foodToday >= 2) return 'daily-limit';
  if (bread <= 0) return 'needs-bread';
  if (hp >= maxHp) return 'full';
  return 'ready';
}
