/** 相棒育成：レベル・XP・トークン育成 */

export const BUDDY_MAX_LEVEL = 10;
export const BUDDY_XP_PER_STAMP = 1;
/** 親スタンプ由来XPの1日上限（カレンダーきょう） */
export const BUDDY_DAILY_XP_CAP = 6;
/** かぶりトークン → 1XP */
export const BUDDY_TRAIN_TOKEN_COST = 5;

/** 現在Lv → 次Lvに必要なXP（各レベル-2・合計62。Lv1→2は最速で1） */
export const XP_TO_NEXT_LEVEL: Readonly<Record<number, number>> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 6,
  6: 8,
  7: 10,
  8: 12,
  9: 16,
  10: 0,
};

export interface BuddyEntry {
  /** 1〜10 */
  level: number;
  /** 現在レベル内のXP（次レベルまでの進捗） */
  xp: number;
}

export type BuddyProgressMap = Record<string, BuddyEntry>;

export function xpToNextLevel(level: number): number {
  if (level < 1) return XP_TO_NEXT_LEVEL[1];
  if (level >= BUDDY_MAX_LEVEL) return 0;
  return XP_TO_NEXT_LEVEL[level] ?? 0;
}

export function normalizeBuddyEntry(raw?: Partial<BuddyEntry> | null): BuddyEntry {
  const level = Math.min(
    BUDDY_MAX_LEVEL,
    Math.max(1, Math.floor(raw?.level ?? 1)),
  );
  const need = xpToNextLevel(level);
  const xp = level >= BUDDY_MAX_LEVEL
    ? 0
    : Math.min(need, Math.max(0, Math.floor(raw?.xp ?? 0)));
  return { level, xp };
}

export function getBuddyEntry(progress: BuddyProgressMap | undefined, id: string): BuddyEntry {
  return normalizeBuddyEntry(progress?.[id]);
}

export function isBuddyMaxed(entry: BuddyEntry): boolean {
  return entry.level >= BUDDY_MAX_LEVEL;
}

export interface AddBuddyXpResult {
  progress: BuddyProgressMap;
  entry: BuddyEntry;
  leveledUp: boolean;
  levelsGained: number;
  newLevel: number;
  xpApplied: number;
}

export function addBuddyXp(
  progress: BuddyProgressMap | undefined,
  id: string,
  amount: number,
): AddBuddyXpResult {
  const map: BuddyProgressMap = { ...(progress ?? {}) };
  let entry = normalizeBuddyEntry(map[id]);
  let remaining = Math.max(0, Math.floor(amount));
  let levelsGained = 0;
  const xpApplied = remaining;

  while (remaining > 0 && entry.level < BUDDY_MAX_LEVEL) {
    const need = xpToNextLevel(entry.level);
    const into = entry.xp + remaining;
    if (into < need) {
      entry = { level: entry.level, xp: into };
      remaining = 0;
      break;
    }
    remaining = into - need;
    entry = { level: entry.level + 1, xp: 0 };
    levelsGained += 1;
  }

  if (entry.level >= BUDDY_MAX_LEVEL) {
    entry = { level: BUDDY_MAX_LEVEL, xp: 0 };
  }

  map[id] = entry;
  return {
    progress: map,
    entry,
    leveledUp: levelsGained > 0,
    levelsGained,
    newLevel: entry.level,
    xpApplied,
  };
}

export function canTrainWithTokens(entry: BuddyEntry, tokens: number): boolean {
  return !isBuddyMaxed(entry) && tokens >= BUDDY_TRAIN_TOKEN_COST;
}

/** きょうのスタンプXP付与が可能か（日付が変わっていたらリセット前提で呼び出し側が処理） */
export function canGrantStampXpToday(earnedToday: number): boolean {
  return earnedToday < BUDDY_DAILY_XP_CAP;
}
