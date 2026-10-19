import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { approveRetiredCatchUpHistory, retireHomeSession, type HomeRetirementInput } from './homeSessionRetirement';
import { emptyCatchUpDayState } from './catchUp';
import { emptyMiningState, normalizeMiningState } from './miningTypes';
import { grantFullDayTickets } from './fullDayTickets';
import { completedSessionCount, getActiveSessionIds, isFullDayForDate, isSessionActiveOnDate, isTrueFullDay, requiredSessionCount } from './japaneseCalendar';
import { createGameTask, oneOffSpecialClaimKey, type Task } from './sharedTasks';

const today = '2026-10-19', monday = new Date(2026, 9, 19), sunday = new Date(2026, 9, 18);
const task = (id: number, title = `task${id}`, extra: Partial<Task> = {}): Task => ({ id, title, emoji: '⭐', ...extra });
function fixture(): HomeRetirementInput {
  return { date: today, morningTasks: [task(1)], daytimeTasks: [task(1)], homeTasks: [task(1, 'water'), task(2, 'laundry'), createGameTask()], eveningTasks: [task(1, 'brush'), createGameTask()],
    morningDone: [], daytimeDone: [], homeDone: [1], eveningDone: [], morningSkipped: [], daytimeSkipped: [], homeSkipped: [2], eveningSkipped: [], homeApproved: false, eveningApproved: true,
    history: { '2026-10-18': { morning: true, daytime: true, home: false, evening: true }, [today]: { morning: true, daytime: false, home: false, evening: true } },
    bestTimes: { 'home-1': 0, 'evening-1': 30 }, taskCompletedAt: { 'home-1': '2026-10-19T07:00:00Z' } };
}
describe('retiring the home task session without deleting children’s progress', () => {
  it('moves rows through ID collisions, preserving status, order, timings and recovery data', () => {
    const before = fixture(), snapshot = structuredClone(before), next = retireHomeSession(before, today);
    const water = next.eveningTasks.find(t => t.title === 'water')!, laundry = next.eveningTasks.find(t => t.title === 'laundry')!;
    expect(water.id).not.toBe(1); expect(next.homeTasks).toEqual([]); expect(next.homeDone).toEqual([]);
    expect(next.eveningTasks.filter(t => t.id !== 9001).map(t => t.title)).toEqual(['brush', 'water', 'laundry']);
    expect(next.eveningDone).toContain(water.id); expect(next.eveningSkipped).toContain(laundry.id);
    expect(next.bestTimes?.[`evening-${water.id}`]).toBe(0); expect(next.bestTimes?.['evening-1']).toBe(30);
    expect(next.bestTimes?.['home-1']).toBe(0); expect(next.taskCompletedAt?.[`evening-${water.id}`]).toBe(before.taskCompletedAt?.['home-1']);
    expect(next.homeRetirement?.originalTasks.home).toEqual(before.homeTasks); expect(before).toEqual(snapshot);
    expect(next.eveningApproved).toBe(false); expect(next.history[today].evening).toBe(false);
  });
  it('deduplicates shared homework, retaining completion and its shared timing identity', () => {
    const s = fixture(), shared = { sharedKey: 'homework', sharedSessions: ['home', 'evening'] as ('home' | 'evening')[] };
    s.homeTasks = [task(2, 'homework', shared)]; s.eveningTasks = [task(7, 'homework', shared)]; s.homeDone = [2]; s.homeSkipped = [];
    s.bestTimes = { 'shared-homework': 15 };
    const next = retireHomeSession(s, today);
    expect(next.eveningTasks).toHaveLength(1); expect(next.eveningTasks[0].id).toBe(7); expect(next.eveningTasks[0].sharedSessions).toEqual(['evening']);
    expect(next.eveningDone).toContain(7); expect(next.bestTimes?.['shared-homework']).toBe(15);
  });
  it('keeps one-off reward identity through an ID collision and never touches inventory or old claims', () => {
    const s = { ...fixture(), mining: { ...emptyMiningState(), tickets: 7 }, oneOffSpecialClaimed: { 'task-1': true }, dailyTreatPending: { '2026-10-18:home': true } };
    s.homeTasks = [task(1, 'special', { scope: 'special', specialRewardFloor: 'superRare' })];
    const next = retireHomeSession(s, today), moved = next.eveningTasks.find(t => t.title === 'special')!;
    expect(moved.id).not.toBe(1); expect(oneOffSpecialClaimKey(moved)).toBe('task-1'); expect(next.oneOffSpecialClaimed).toBe(s.oneOffSpecialClaimed);
    expect(next.mining).toBe(s.mining); expect(next.dailyTreatPending).toMatchObject(s.dailyTreatPending);
    expect(retireHomeSession(next, today)).toBe(next);
    expect(retireHomeSession(JSON.parse(JSON.stringify(next)), today)).toEqual(next);
  });
  it('does not rewrite past calendar history; current illness remains ineligible for all-day rewards', () => {
    const s = fixture(); s.sessionSickSkip = { [today]: { morning: false, daytime: false, home: true, evening: false } };
    const next = retireHomeSession(s, today);
    expect(next.history['2026-10-18']).toBe(s.history['2026-10-18']); expect(next.history[today].homeRetired).toBe(true);
    expect(next.sessionSickSkip?.[today].evening).toBe(true);
    expect(isTrueFullDay({ morning: true, daytime: false, home: false, evening: true, homeRetired: true }, next.sessionSickSkip?.[today], monday)).toBe(false);
  });
  it.each(['done', 'skipped'] as const)('moves shared home %s to night, not into a morning placement', status => {
    const s = fixture(); s.morningTasks = [task(8, 'shared', { sharedKey: 'shared', sharedSessions: ['morning', 'home'] })];
    s.homeTasks = [task(2, 'shared', { sharedKey: 'shared', sharedSessions: ['morning', 'home'] })];
    s.homeDone = status === 'done' ? [2] : []; s.homeSkipped = status === 'skipped' ? [2] : [];
    const next = retireHomeSession(s, today), night = next.eveningTasks.find(t => t.sharedKey === 'shared')!;
    expect(next.morningDone).toEqual([]); expect(next.morningSkipped).toEqual([]); expect(next[`evening${status === 'done' ? 'Done' : 'Skipped'}`]).toContain(night.id);
  });
  it('migrates saved catch-up progress with the same ID mapping and clears stale night approval', () => {
    const s = fixture(); const day = { ...emptyCatchUpDayState(), homeDone: [1], homeSkipped: [2], eveningApproved: true, taskCompletedAt: { 'home-1': '2026-10-18T06:00:00Z' } };
    s.catchUpDays = { '2026-10-18': day }; const next = retireHomeSession(s, today);
    const night = next.eveningTasks.find(t => t.title === 'water')!, moved = next.catchUpDays!['2026-10-18'];
    expect(moved.eveningDone).toContain(night.id); expect(moved.homeDone).toEqual([]); expect(moved.homeSkipped).toEqual([]);
    expect(moved.taskCompletedAt?.[`evening-${night.id}`]).toBe(day.taskCompletedAt['home-1']); expect(moved.eveningApproved).toBe(false);
    expect(next.homeRetirement?.originalCatchUpDays?.['2026-10-18']).toEqual(day); expect(s.catchUpDays['2026-10-18']).toBe(day);
  });
  it('preserves unreceived home and evening rewards, but never revives a claimed legacy reward', () => {
    const s = fixture(); s.homeApproved = true;
    const next = retireHomeSession(s, today);
    expect(next.dailyTreatPending).toMatchObject({ [`${today}:home`]: true, [`${today}:evening`]: true });
    expect(retireHomeSession({ ...s, dailyTreatClaimed: { [today]: true } }, today).dailyTreatPending).toEqual({});
    expect(retireHomeSession({ ...s, dailyTreatClaimed: { [`${today}:home`]: true } }, today).dailyTreatPending?.[`${today}:home`]).toBeUndefined();
    expect(next.homeApproved).toBe(false); expect(next.eveningApproved).toBe(false);
  });
  it('does not complete an old missing-home day when only morning is reapproved', () => {
    const old = { morning: true, daytime: true, home: false, evening: true };
    const partial = approveRetiredCatchUpHistory(old, 'morning');
    expect(partial.evening).toBe(false); expect(isFullDayForDate(partial, sunday)).toBe(false);
    expect(isFullDayForDate(approveRetiredCatchUpHistory(partial, 'evening'), sunday)).toBe(true);
  });
  it('excludes current ephemeral tasks from past approval eligibility and never copies today timestamps into a past day', () => {
    const s = fixture(); s.eveningTasks.push(task(9, 'today only', { scope: 'today' }), task(10, 'special', { scope: 'special' }));
    s.catchUpDays = { '2026-10-18': { ...emptyCatchUpDayState(), homeDone: [1, 2], eveningDone: [1], homeApproved: true, eveningApproved: true } };
    const next = retireHomeSession(s, today), past = next.catchUpDays!['2026-10-18'];
    expect(past.eveningApproved).toBe(true); expect(past.taskCompletedAt).toEqual({}); expect(next.eveningApproved).toBe(false);
  });
  it('does not create unreceived rewards on a sick-skipped day, while preserving an existing pending right', () => {
    const s = fixture(); s.homeApproved = true;
    s.sessionSickSkip = { [today]: { morning: true, daytime: false, home: false, evening: false } };
    const key = `${today}:home`;
    expect(retireHomeSession(s, today).dailyTreatPending).toEqual({});
    expect(retireHomeSession({ ...s, dailyTreatPending: { [key]: true } }, today).dailyTreatPending).toEqual({ [key]: true });
  });
});
describe('current sessions and historical day versions', () => {
  it('uses morning/night on school days and includes daytime only on holidays', () => {
    expect(getActiveSessionIds(monday)).toEqual(['morning', 'evening']); expect(getActiveSessionIds(sunday)).toEqual(['morning', 'daytime', 'evening']);
    expect(isSessionActiveOnDate('home', monday)).toBe(false); expect(requiredSessionCount(monday)).toBe(2);
  });
  it('keeps old four/three-part histories unchanged while new days no longer require home', () => {
    const old = { morning: true, daytime: true, home: false, evening: true }, current = { ...old, homeRetired: true };
    expect(isFullDayForDate(old, monday)).toBe(false); expect(isFullDayForDate(old, sunday)).toBe(false);
    expect(isFullDayForDate(current, monday)).toBe(true); expect(isFullDayForDate(current, sunday)).toBe(true);
    expect(requiredSessionCount(sunday, old)).toBe(4); expect(requiredSessionCount(sunday, current)).toBe(3);
    expect(completedSessionCount(current, sunday)).toBe(3);
  });
});
describe('two-ticket full-day reward', () => {
  it('grants exactly two once and survives serialization and normalizing saves', () => {
    const initial = emptyMiningState(), next = grantFullDayTickets(initial, today);
    expect(next.tickets - initial.tickets).toBe(2); expect(initial.fullDayTicketClaimed[today]).toBeUndefined();
    const loaded = normalizeMiningState(JSON.parse(JSON.stringify(next)));
    expect(grantFullDayTickets(loaded, today)).toBe(loaded);
    expect(grantFullDayTickets(loaded, '2026-10-20').tickets).toBe(next.tickets + 2);
  });
  it('never pays twice or tops up legacy one-ticket claims', () => {
    const old = { ...emptyMiningState(), tickets: 9, fullDayTicketClaimed: { [today]: true } };
    expect(grantFullDayTickets(old, today)).toBe(old);
  });
  it('connects migration, persistence and the parent-approved eligibility gate to the real app', () => {
    const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
    for (const contract of ['return retireHomeSession({', 'homeRetirement,', 'next = grantFullDayTickets(next, date)', 'if (activeCatchUpDate) return;', 'if (!onTimeToday) return;', 'if (dayRewardsOk) {', 'homeRetired: true']) expect(source).toContain(contract);
  });
});
