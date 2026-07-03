import type { DayHistory } from "./RecordCalendar";
import {
  getFullDayStreak,
  isFullDay,
  isSevenDayMilestoneStreak,
  isThreeDayMilestoneStreak,
} from "./RecordCalendar";
import { parseDateKey } from "./japaneseCalendar";
import {
  isSharedTaskDone,
  isTaskVisibleToday,
  tasksForProgress,
  type AllSessionTasks,
  type SessionId,
  type Task,
} from "./sharedTasks";

export interface CatchUpDayState {
  morningDone: number[];
  daytimeDone: number[];
  eveningDone: number[];
  homeDone: number[];
  morningSkipped: number[];
  daytimeSkipped: number[];
  eveningSkipped: number[];
  homeSkipped: number[];
  morningApproved: boolean;
  daytimeApproved: boolean;
  eveningApproved: boolean;
  homeApproved: boolean;
  taskCompletedAt?: Record<string, string>;
}

const DONE_FIELDS: Record<SessionId, keyof CatchUpDayState> = {
  morning: "morningDone",
  daytime: "daytimeDone",
  home: "homeDone",
  evening: "eveningDone",
};

const SKIPPED_FIELDS: Record<SessionId, keyof CatchUpDayState> = {
  morning: "morningSkipped",
  daytime: "daytimeSkipped",
  home: "homeSkipped",
  evening: "eveningSkipped",
};

const APPROVED_FIELDS: Record<SessionId, keyof CatchUpDayState> = {
  morning: "morningApproved",
  daytime: "daytimeApproved",
  home: "homeApproved",
  evening: "eveningApproved",
};

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayDateKey(): string {
  return localDateKey(new Date());
}

export function emptyCatchUpDayState(): CatchUpDayState {
  return {
    morningDone: [],
    daytimeDone: [],
    eveningDone: [],
    homeDone: [],
    morningSkipped: [],
    daytimeSkipped: [],
    eveningSkipped: [],
    homeSkipped: [],
    morningApproved: false,
    daytimeApproved: false,
    eveningApproved: false,
    homeApproved: false,
    taskCompletedAt: {},
  };
}

export function catchUpDoneSet(day: CatchUpDayState, session: SessionId): Set<number> {
  return new Set(day[DONE_FIELDS[session]] as number[]);
}

export function catchUpSkippedSet(day: CatchUpDayState, session: SessionId): Set<number> {
  return new Set(day[SKIPPED_FIELDS[session]] as number[]);
}

export function catchUpApproved(day: CatchUpDayState, session: SessionId): boolean {
  return !!day[APPROVED_FIELDS[session]];
}

export function patchCatchUpSession(
  day: CatchUpDayState,
  session: SessionId,
  patch: Partial<{
    done: Set<number>;
    skipped: Set<number>;
    approved: boolean;
  }>,
): CatchUpDayState {
  switch (session) {
    case "morning":
      return {
        ...day,
        ...(patch.done ? { morningDone: [...patch.done] } : {}),
        ...(patch.skipped ? { morningSkipped: [...patch.skipped] } : {}),
        ...(patch.approved !== undefined ? { morningApproved: patch.approved } : {}),
      };
    case "daytime":
      return {
        ...day,
        ...(patch.done ? { daytimeDone: [...patch.done] } : {}),
        ...(patch.skipped ? { daytimeSkipped: [...patch.skipped] } : {}),
        ...(patch.approved !== undefined ? { daytimeApproved: patch.approved } : {}),
      };
    case "home":
      return {
        ...day,
        ...(patch.done ? { homeDone: [...patch.done] } : {}),
        ...(patch.skipped ? { homeSkipped: [...patch.skipped] } : {}),
        ...(patch.approved !== undefined ? { homeApproved: patch.approved } : {}),
      };
    case "evening":
      return {
        ...day,
        ...(patch.done ? { eveningDone: [...patch.done] } : {}),
        ...(patch.skipped ? { eveningSkipped: [...patch.skipped] } : {}),
        ...(patch.approved !== undefined ? { eveningApproved: patch.approved } : {}),
      };
  }
}

export function buildCatchUpAllSessionTasks(
  day: CatchUpDayState,
  sessionTasks: Record<SessionId, Task[]>,
): AllSessionTasks {
  const pick = (sid: SessionId) => ({
    tasks: sessionTasks[sid],
    done: catchUpDoneSet(day, sid),
    skipped: catchUpSkippedSet(day, sid),
  });
  return {
    morning: pick("morning"),
    daytime: pick("daytime"),
    home: pick("home"),
    evening: pick("evening"),
  };
}

/** やり直し対象: 今日より前かつ全部クリアしていない日 */
export function isCatchUpEligible(dateKey: string, history: Record<string, DayHistory>): boolean {
  if (dateKey >= todayDateKey()) return false;
  const date = parseDateKey(dateKey);
  return !isFullDay(history[dateKey], date);
}

export function formatCatchUpDateLabel(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const dow = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${dow}）`;
}

/** 過去日やり直し用: きょう限定・特別ミッションは除外 */
export function visibleCatchUpTasksForSession(
  session: SessionId,
  allSessions: AllSessionTasks,
  date: Date,
): Task[] {
  return allSessions[session].tasks.filter((t) => {
    if (t.scope === "today" || t.scope === "special") return false;
    if (!isTaskVisibleToday(t, date)) return false;
    if (!t.sharedKey) return true;
    if (!isSharedTaskDone(t.sharedKey, allSessions)) return true;
    const slice = allSessions[session];
    return slice.done.has(t.id) || slice.skipped.has(t.id);
  });
}

export function isCatchUpSessionResolved(
  session: SessionId,
  allSessions: AllSessionTasks,
  date: Date,
): boolean {
  const visible = tasksForProgress(visibleCatchUpTasksForSession(session, allSessions, date));
  const { tasks, done, skipped } = allSessions[session];
  if (visible.length === 0) return tasks.length > 0;
  return visible.every((t) => done.has(t.id) || skipped.has(t.id));
}

function normalizeStreakRewardBaseline(
  fullDayStreak: number,
  lastThreeDay: number,
  lastWeekly: number,
): { lastThreeDay: number; lastWeekly: number } {
  return {
    lastThreeDay: fullDayStreak < lastThreeDay ? 0 : lastThreeDay,
    lastWeekly: fullDayStreak < lastWeekly ? 0 : lastWeekly,
  };
}

export interface StreakMilestoneEvaluation {
  fullDayStreak: number;
  threeDayMilestone: boolean;
  weeklyMilestone: boolean;
  threeDayMilestoneStreak?: number;
  weeklyMilestoneStreak?: number;
  lastThreeDay: number;
  lastWeekly: number;
}

/** 今日が全部クリア済みのときだけ連続マイルストーンを判定 */
export function evaluateStreakMilestones(
  history: Record<string, DayHistory>,
  triggerDateKey: string,
  lastThreeDayRewardStreak: number,
  lastWeeklyRewardStreak: number,
  threeDayTreatPending: Record<string, number>,
  weeklyTreatPending: Record<string, number>,
): StreakMilestoneEvaluation | null {
  const today = todayDateKey();
  if (!isFullDay(history[today], new Date())) return null;

  const fullDayStreak = getFullDayStreak(history);
  const { lastThreeDay, lastWeekly } = normalizeStreakRewardBaseline(
    fullDayStreak,
    lastThreeDayRewardStreak,
    lastWeeklyRewardStreak,
  );

  const threeDayEligible = isThreeDayMilestoneStreak(fullDayStreak) && fullDayStreak > lastThreeDay;
  const weeklyEligible = isSevenDayMilestoneStreak(fullDayStreak) && fullDayStreak > lastWeekly;

  return {
    fullDayStreak,
    threeDayMilestone: threeDayEligible && threeDayTreatPending[triggerDateKey] === undefined,
    weeklyMilestone: weeklyEligible && weeklyTreatPending[triggerDateKey] === undefined,
    threeDayMilestoneStreak: threeDayEligible ? fullDayStreak : undefined,
    weeklyMilestoneStreak: weeklyEligible ? fullDayStreak : undefined,
    lastThreeDay,
    lastWeekly,
  };
}
