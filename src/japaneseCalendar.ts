import holiday_jp from "@holiday-jp/holiday_jp";

export type PhaseSessionId = "morning" | "daytime" | "home" | "evening";

const ALL_PHASE_SESSIONS: PhaseSessionId[] = ["morning", "daytime", "evening"];
const WEEKDAY_PHASE_SESSIONS: PhaseSessionId[] = ["morning", "evening"];

export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export function isJapaneseHoliday(d: Date): boolean {
  return holiday_jp.isHoliday(d);
}

/** 昼フェーズが有効な日（土日または日本の祝日） */
export function isDaytimeSessionDay(d = new Date()): boolean {
  return isWeekend(d) || isJapaneseHoliday(d);
}

export function getActiveSessionIds(d = new Date(), legacyHome = false): PhaseSessionId[] {
  const active = [...(isDaytimeSessionDay(d) ? ALL_PHASE_SESSIONS : WEEKDAY_PHASE_SESSIONS)];
  if (legacyHome) active.splice(active.length - 1, 0, 'home');
  return active;
}

export function isSessionActiveOnDate(session: PhaseSessionId, d = new Date()): boolean {
  if (session === "daytime") return isDaytimeSessionDay(d);
  if (session === "home") return false;
  return true;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface DayFlags {
  homeRetired?: boolean;
  morning: boolean;
  daytime: boolean;
  home: boolean;
  evening: boolean;
}

export function completedSessionCount(day: DayFlags | undefined, d: Date): number {
  if (!day) return 0;
  return getActiveSessionIds(d, !day.homeRetired).filter((sid) => day[sid]).length;
}

export function requiredSessionCount(d: Date, day?: DayFlags): number {
  return getActiveSessionIds(d, !!day && !day.homeRetired).length;
}

export function isFullDayForDate(day: DayFlags | undefined, d: Date): boolean {
  if (!day) return false;
  return getActiveSessionIds(d, !day.homeRetired).every((sid) => day[sid]);
}

/** その日の有効フェーズに体調スキップが1つ以上ある */
export function dayHasActiveSickSkip(sick: DayFlags | undefined, d: Date = new Date()): boolean {
  if (!sick) return false;
  return getActiveSessionIds(d, !sick.homeRetired).some((sid) => !!sick[sid]);
}

/**
 * 橋渡し日: 必要フェーズがすべて埋まっていて、うち1つ以上が体調スキップ。
 * 連続には +1 しないが、途切れもしない。
 */
export function isDayBridged(
  day: DayFlags | undefined,
  sick: DayFlags | undefined,
  d: Date = new Date(),
): boolean {
  return isFullDayForDate(day, d) && dayHasActiveSickSkip(sick, d);
}

/** 本番の全部クリア（体調スキップなし） */
export function isTrueFullDay(
  day: DayFlags | undefined,
  sick: DayFlags | undefined,
  d: Date = new Date(),
): boolean {
  return isFullDayForDate(day, d) && !dayHasActiveSickSkip(sick, d);
}

/** history 上で体調スキップ以外の完了がある */
export function hasNonSickSession(
  day: DayFlags | undefined,
  sick: DayFlags | undefined,
): boolean {
  if (!day) return false;
  return (["morning", "daytime", "home", "evening"] as const).some(
    (sid) => (sid !== 'home' || !day.homeRetired) && !!day[sid] && !sick?.[sid],
  );
}
