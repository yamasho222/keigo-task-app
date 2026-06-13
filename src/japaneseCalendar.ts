import holiday_jp from "@holiday-jp/holiday_jp";

export type PhaseSessionId = "morning" | "daytime" | "home" | "evening";

const ALL_PHASE_SESSIONS: PhaseSessionId[] = ["morning", "daytime", "home", "evening"];
const WEEKDAY_PHASE_SESSIONS: PhaseSessionId[] = ["morning", "home", "evening"];

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

export function getActiveSessionIds(d = new Date()): PhaseSessionId[] {
  return isDaytimeSessionDay(d) ? ALL_PHASE_SESSIONS : WEEKDAY_PHASE_SESSIONS;
}

export function isSessionActiveOnDate(session: PhaseSessionId, d = new Date()): boolean {
  if (session === "daytime") return isDaytimeSessionDay(d);
  return true;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface DayFlags {
  morning: boolean;
  daytime: boolean;
  home: boolean;
  evening: boolean;
}

export function completedSessionCount(day: DayFlags | undefined, d: Date): number {
  if (!day) return 0;
  return getActiveSessionIds(d).filter((sid) => day[sid]).length;
}

export function requiredSessionCount(d: Date): number {
  return getActiveSessionIds(d).length;
}

export function isFullDayForDate(day: DayFlags | undefined, d: Date): boolean {
  if (!day) return false;
  return getActiveSessionIds(d).every((sid) => day[sid]);
}
