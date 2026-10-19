import { editTaskPlacement } from './taskEditing';
import { isGameTask, SESSION_IDS, tasksForProgress, visibleTasksForSession, type AllSessionTasks, type SessionId, type Task } from './sharedTasks';
import { dayHasActiveSickSkip, parseDateKey } from './japaneseCalendar';
import type { DayHistory } from './RecordCalendar';
import type { CatchUpDayState } from './catchUp';

export interface HomeRetirement {
  version: 1;
  date: string;
  /** Recovery source; never discard the old rows or their original record keys. */
  originalTasks: Record<SessionId, Task[]>;
  originalProgress: Pick<HomeRetirementInput, 'morningDone' | 'daytimeDone' | 'homeDone' | 'eveningDone' | 'morningSkipped' | 'daytimeSkipped' | 'homeSkipped' | 'eveningSkipped' | 'homeApproved' | 'eveningApproved'>;
  originalToday?: DayHistory;
  originalSickToday?: DayHistory;
  originalCatchUpDays?: Record<string, CatchUpDayState>;
}
export interface HomeRetirementInput {
  date: string;
  morningTasks: Task[]; daytimeTasks: Task[]; homeTasks: Task[]; eveningTasks: Task[];
  morningDone: number[]; daytimeDone: number[]; homeDone: number[]; eveningDone: number[];
  morningSkipped: number[]; daytimeSkipped: number[]; homeSkipped: number[]; eveningSkipped: number[];
  homeApproved: boolean; eveningApproved: boolean;
  history: Record<string, DayHistory>;
  sessionSickSkip?: Record<string, DayHistory>;
  bestTimes?: Record<string, number>;
  taskCompletedAt?: Record<string, string>;
  homeRetirement?: HomeRetirement;
  catchUpDays?: Record<string, CatchUpDayState>;
  dailyTreatPending?: Record<string, boolean>;
  dailyTreatClaimed?: Record<string, boolean>;
}

function mergeHomeProgress(data: HomeRetirementInput, catchUp = false) {
  const originalTasks = { morning: data.morningTasks, daytime: data.daytimeTasks, home: data.homeTasks, evening: data.eveningTasks };
  let all = Object.fromEntries(SESSION_IDS.map(sid => [sid, {
    tasks: originalTasks[sid], done: new Set(data[`${sid}Done`]), skipped: new Set(data[`${sid}Skipped`]),
  }])) as AllSessionTasks;
  const bestTimes = { ...data.bestTimes }, taskCompletedAt = { ...data.taskCompletedAt };
  for (const task of data.homeTasks.filter(t => !isGameTask(t))) {
    const destinations = SESSION_IDS.filter(sid => sid !== 'home' && (sid === 'evening' || !!task.sharedKey && all[sid].tasks.some(t => t.sharedKey === task.sharedKey)));
    const move = editTaskPlacement(all, 'home', task.id, task, destinations, `retired-home-${task.id}`);
    if (!move) continue;
    // Moving a shared home row must not mark a morning/daytime row skipped/done.
    // Preserve all existing non-home placements, then transfer home status to night.
    for (const row of move.rows) {
      const previous = move.related.find(r => r.session === row.session);
      const destination = move.sessions[row.session];
      destination.done.delete(row.task.id); destination.skipped.delete(row.task.id);
      if (previous && all[row.session].done.has(previous.task.id)) destination.done.add(row.task.id);
      if (previous && all[row.session].skipped.has(previous.task.id)) destination.skipped.add(row.task.id);
    }
    const night = move.rows.find(r => r.session === 'evening')!;
    if (all.home.done.has(task.id)) { move.sessions.evening.done.add(night.task.id); move.sessions.evening.skipped.delete(night.task.id); }
    else if (all.home.skipped.has(task.id) && !move.sessions.evening.done.has(night.task.id)) move.sessions.evening.skipped.add(night.task.id);
    all = move.sessions;
    for (const to of move.newTimeKeys) {
      const times = [...move.oldTimeKeys, to].flatMap(key => bestTimes[key] === undefined ? [] : [bestTimes[key]]);
      if (times.length) bestTimes[to] = Math.min(...times);
      const stamps = [...move.oldTimeKeys, to].flatMap(key => taskCompletedAt[key] ? [taskCompletedAt[key]] : []);
      if (stamps.length) taskCompletedAt[to] = stamps.sort().at(-1)!;
    }
  }
  const eligible = (t: Task) => !catchUp || t.scope !== 'today' && t.scope !== 'special';
  const nightResolved = tasksForProgress(visibleTasksForSession('evening', all, parseDateKey(data.date))).filter(eligible).every(t => all.evening.done.has(t.id) || all.evening.skipped.has(t.id));
  const eveningApproved = data.eveningApproved && nightResolved && (data.homeApproved || !data.homeTasks.some(t => !isGameTask(t) && eligible(t)));
  return { morningTasks: all.morning.tasks, daytimeTasks: all.daytime.tasks, eveningTasks: all.evening.tasks, homeTasks: [] as Task[],
    morningDone: [...all.morning.done], daytimeDone: [...all.daytime.done], eveningDone: [...all.evening.done], homeDone: [] as number[],
    morningSkipped: [...all.morning.skipped], daytimeSkipped: [...all.daytime.skipped], eveningSkipped: [...all.evening.skipped], homeSkipped: [] as number[],
    homeApproved: false, eveningApproved, bestTimes, taskCompletedAt };
}

/** A legacy missing home approval still requires the merged night to be checked. */
export function approveRetiredCatchUpHistory(day: DayHistory, session: SessionId): DayHistory {
  return { ...day, homeRetired: true, evening: !day.homeRetired && !day.home && session !== 'evening' ? false : day.evening, [session]: true };
}

/** One pure migration per child. No tickets are issued by opening/migrating a save. */
export function retireHomeSession<T extends HomeRetirementInput>(data: T, today: string): T {
  if (data.homeRetirement?.version === 1) return data;
  const merged = mergeHomeProgress(data);
  const originalTasks = { morning: data.morningTasks, daytime: data.daytimeTasks, home: data.homeTasks, evening: data.eveningTasks };
  const history = { ...data.history };
  if (history[today]) history[today] = { ...history[today], homeRetired: true, evening: data.date === today ? merged.eveningApproved && history[today].evening : history[today].evening };
  const sessionSickSkip = { ...data.sessionSickSkip };
  if (sessionSickSkip[today]) sessionSickSkip[today] = { ...sessionSickSkip[today], homeRetired: true, evening: sessionSickSkip[today].evening || sessionSickSkip[today].home, home: false };
  const catchUpDays = Object.fromEntries(Object.entries(data.catchUpDays ?? {}).map(([date, day]) => {
    const moved = mergeHomeProgress({ ...data, ...day, date, taskCompletedAt: day.taskCompletedAt ?? {} }, true);
    return [date, { ...day, morningDone: moved.morningDone, daytimeDone: moved.daytimeDone, homeDone: [], eveningDone: moved.eveningDone,
      morningSkipped: moved.morningSkipped, daytimeSkipped: moved.daytimeSkipped, homeSkipped: [], eveningSkipped: moved.eveningSkipped,
      homeApproved: false, eveningApproved: moved.eveningApproved, taskCompletedAt: moved.taskCompletedAt }];
  }));
  const dailyTreatPending = { ...data.dailyTreatPending };
  if (data.date === today && !dayHasActiveSickSkip(data.sessionSickSkip?.[today], parseDateKey(today))) for (const session of ['home', 'evening'] as const) {
    const key = `${today}:${session}`;
    if (data[`${session}Approved`] && !data.sessionSickSkip?.[today]?.[session] && !data.dailyTreatClaimed?.[key] && !data.dailyTreatClaimed?.[today]) dailyTreatPending[key] = true;
  }
  return {
    ...data, ...merged, homeRetirement: { version: 1, date: today, originalTasks,
      originalProgress: { morningDone: data.morningDone, daytimeDone: data.daytimeDone, homeDone: data.homeDone, eveningDone: data.eveningDone,
        morningSkipped: data.morningSkipped, daytimeSkipped: data.daytimeSkipped, homeSkipped: data.homeSkipped, eveningSkipped: data.eveningSkipped, homeApproved: data.homeApproved, eveningApproved: data.eveningApproved },
      originalToday: data.history[today], originalSickToday: data.sessionSickSkip?.[today], originalCatchUpDays: data.catchUpDays },
    history, sessionSickSkip, catchUpDays, dailyTreatPending,
  };
}
