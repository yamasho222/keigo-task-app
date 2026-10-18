import { describe, expect, it } from 'vitest';
import { editTaskPlacement, moveTaskInList, remapTaskRecord } from './taskEditing';
import { createGameTask, isTaskVisibleInSession, resolveTaskTimeKey, SESSION_IDS, sortTasksForSessionDisplay, type AllSessionTasks, type Task } from './sharedTasks';

function fixture(): AllSessionTasks {
  return Object.fromEntries(SESSION_IDS.map(sid => [sid, { tasks: [], done: new Set<number>(), skipped: new Set<number>() }])) as AllSessionTasks;
}
const task = (id: number, extra: Partial<Task> = {}): Task => ({ id, title: `task${id}`, emoji: '🎯', scope: 'regular', ...extra });
const edit = (all: AllSessionTasks, id: number, destinations = ['evening'] as Parameters<typeof editTaskPlacement>[4]) => editTaskPlacement(all, 'home', id, { title: ' changed ', emoji: '⭐', weekdays: [1, 3] }, destinations, 'new-shared')!;
const snapshot = (all: AllSessionTasks) => JSON.stringify(all, (_key, value) => value instanceof Set ? [...value] : value);

describe('task placement transaction', () => {
  it('moves a single row instead of only editing its source; unrelated duplicate ids survive', () => {
    const all = fixture(); all.home.tasks = [task(1), task(2)]; all.morning.tasks = [task(1)];
    const before = snapshot(all), result = edit(all, 1);
    expect(result.sessions.home.tasks.map(t => t.id)).toEqual([2]);
    expect(result.sessions.morning.tasks).toEqual(all.morning.tasks);
    expect(result.sessions.evening.tasks).toEqual([task(1, { title: 'changed', emoji: '⭐', weekdays: [1, 3] })]);
    expect(snapshot(all)).toBe(before);
    expect(result.oldTimeKeys).toEqual(['home-1']); expect(result.newTimeKeys).toEqual(['evening-1']);
  });
  it.each(['done', 'skipped'] as const)('carries %s status through a destination id collision', status => {
    const all = fixture(); all.home.tasks = [task(1)]; all.home[status].add(1); all.evening.tasks = [task(1, { title: 'unrelated' })];
    const result = edit(all, 1), moved = result.rows[0].task;
    expect(moved.id).toBe(2); expect(result.sessions.home[status].size).toBe(0);
    expect(result.sessions.evening[status].has(2)).toBe(true); expect(result.sessions.evening[status].has(1)).toBe(false);
    expect(result.sessions.evening.tasks[0].title).toBe('unrelated');
    expect(all.home[status].has(1)).toBe(true);
  });
  it('retains row position and identity during an ordinary same-period edit', () => {
    const all = fixture(); all.home.tasks = [task(1), task(2), task(3)]; all.home.done.add(2);
    const result = edit(all, 2, ['home']);
    expect(result.sessions.home.tasks.map(t => t.id)).toEqual([1, 2, 3]); expect(result.sessions.home.done.has(2)).toBe(true);
    expect(result.oldTimeKeys).toEqual(result.newTimeKeys);
  });
  it('edits all shared placements, removes deselected ones, and carries completion without duplicating it', () => {
    const all = fixture(); const shared = { sharedKey: 'shared-old', sharedSessions: ['home', 'evening'] as const };
    all.home.tasks = [task(10, { ...shared, sharedSessions: [...shared.sharedSessions] })];
    all.evening.tasks = [task(11, { ...shared, sharedSessions: [...shared.sharedSessions] })]; all.home.done.add(10);
    const result = edit(all, 10, ['evening', 'morning']);
    expect(result.sessions.home.tasks).toEqual([]); expect(result.sessions.home.done.size).toBe(0);
    expect(result.rows.every(r => r.task.sharedKey === 'shared-old')).toBe(true);
    expect(result.rows.every(r => r.task.sharedSessions?.join() === 'morning,evening')).toBe(true);
    expect([...result.sessions.morning.done]).toEqual([12]); expect(result.sessions.evening.done.size).toBe(0);
    expect(isTaskVisibleInSession(result.sessions.evening.tasks[0], 'evening', result.sessions, new Date(2026, 9, 19))).toBe(false);
  });
  it('retains an existing shared completion when that period remains selected', () => {
    const all = fixture(); for (const [sid, id] of [['home', 10], ['evening', 11]] as const) all[sid].tasks = [task(id, { sharedKey: 'shared-old', sharedSessions: ['home', 'evening'] })];
    all.evening.done.add(11); const result = edit(all, 10, ['morning', 'evening']);
    expect([...result.sessions.evening.done]).toEqual([11]); expect(result.sessions.morning.done.size).toBe(0);
  });
  it('keeps shared time/reward identity through shared → single → another period → shared', () => {
    let all = fixture(); all.home.tasks = [task(1, { scope: 'special', sharedKey: 'reward', sharedSessions: ['home', 'evening'] })];
    all.evening.tasks = [{ ...all.home.tasks[0], id: 2 }]; all.home.done.add(1);
    const changes = { title: 'mission', emoji: '⭐', specialRewardFloor: 'ultraRare' as const };
    for (const destinations of [['evening'], ['morning'], ['home', 'evening']] as const) {
      const source = SESSION_IDS.find(sid => all[sid].tasks.some(t => t.sharedKey === 'reward'))!;
      const existing = all[source].tasks.find(t => t.sharedKey === 'reward')!;
      const result = editTaskPlacement(all, source, existing.id, changes, [...destinations], 'unused')!; all = result.sessions;
      expect(result.oldClaimKey).toBe('reward'); expect(result.newClaimKey).toBe('reward');
      expect(result.oldTimeKeys).toEqual(['shared-reward']); expect(result.newTimeKeys).toEqual(['shared-reward']);
      expect(SESSION_IDS.reduce((sum, sid) => sum + all[sid].done.size, 0)).toBe(1);
    }
  });
  it('preserves a one-off claimed reward identity when the destination id collides', () => {
    const all = fixture(); all.home.tasks = [task(1, { scope: 'special', specialRewardFloor: 'superRare' })]; all.evening.tasks = [task(1)]; all.home.done.add(1);
    const result = edit(all, 1);
    expect(result.rows[0].task.id).toBe(2); expect(result.oldClaimKey).toBe('task-1'); expect(result.newClaimKey).toBe('task-1');
    expect(remapTaskRecord({ 'task-1': true }, [result.oldClaimKey], [result.newClaimKey])).toEqual({ 'task-1': true });
  });
  it('converts a single special mission to shared without losing its claimed or pending reward', () => {
    const all = fixture(); all.home.tasks = [task(1, { scope: 'special' })];
    const result = edit(all, 1, ['home', 'evening']);
    expect(result.oldClaimKey).toBe('task-1'); expect(result.newClaimKey).toBe('new-shared');
    expect(remapTaskRecord({ 'task-1': true, other: true }, [result.oldClaimKey], [result.newClaimKey])).toEqual({ 'new-shared': true, other: true });
    expect(remapTaskRecord({ 'task-1': 'superRare' }, [result.oldClaimKey], [result.newClaimKey])).toEqual({ 'new-shared': 'superRare' });
  });
  it('deduplicates periods and leaves all existing placements if no destination is supplied', () => {
    const all = fixture(); all.home.tasks = [task(1)];
    expect(edit(all, 1, ['home', 'home', 'evening']).rows).toHaveLength(2);
    expect(editTaskPlacement(all, 'home', 1, { title: 'same', emoji: '🎯' }, undefined, 'key')!.rows.map(r => r.session)).toEqual(['home']);
  });
  it('rejects invalid edits and the game row without mutating data', () => {
    const all = fixture(); all.home.tasks = [task(1), createGameTask()]; const before = snapshot(all);
    expect(editTaskPlacement(all, 'home', 1, { title: '  ', emoji: '' }, ['evening'], 'key')).toBeNull();
    expect(edit(all, 999)).toBeNull(); expect(edit(all, 9001)).toBeNull(); expect(snapshot(all)).toBe(before);
  });
});

describe('record remapping and persistent display order', () => {
  it('moves timing and completion records, retaining unrelated records and falsy values', () => {
    expect(remapTaskRecord({ 'home-1': 0, 'night-2': 42 }, ['home-1'], ['shared-new'])).toEqual({ 'shared-new': 0, 'night-2': 42 });
    const unchanged = { key: false }; expect(remapTaskRecord(unchanged, ['key'], ['key'])).toBe(unchanged);
    expect(remapTaskRecord(unchanged, ['missing'], ['new'])).toBe(unchanged);
    expect(remapTaskRecord({ old: '2026-10-18T10:00:00Z' }, ['old'], ['new'])).toEqual({ new: '2026-10-18T10:00:00Z' });
  });
  it('reorders visible peers without losing or moving hidden weekday tasks', () => {
    const all = [task(1), task(2, { weekdays: [0] }), task(3), task(4)]; const visible = [all[0], all[2], all[3]];
    const next = moveTaskInList(all, visible, 3, -1);
    expect(next.map(t => t.id)).toEqual([3, 2, 1, 4]); expect(all.map(t => t.id)).toEqual([1, 2, 3, 4]);
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
    expect(sortTasksForSessionDisplay(next).map(t => t.id)).toEqual([3, 2, 1, 4]);
  });
  it('does not cross task kinds or the game row, and respects first/last boundaries', () => {
    const all = [task(1), task(2, { scope: 'today' }), task(3, { scope: 'special' }), createGameTask(), task(4), task(5, { scope: 'today' })];
    expect(moveTaskInList(all, all, 1, -1)).toBe(all); expect(moveTaskInList(all, all, 4, 1)).toBe(all);
    expect(moveTaskInList(all, all, 3, 1)).toBe(all); expect(moveTaskInList(all, all, 9001, -1)).toBe(all);
    expect(moveTaskInList(all, all, 2, 1).map(t => t.id)).toEqual([1, 5, 3, 9001, 4, 2]);
    expect(moveTaskInList(all, [], 1, 1)).toBe(all); expect(moveTaskInList(all, all, 404, 1)).toBe(all);
  });
  it('roundtrips moved task rows, done/skipped sets and timing identity in the saved representation', () => {
    const all = fixture(); all.home.tasks = [task(1), task(2)]; all.home.done.add(1); all.home.skipped.add(2);
    const result = edit(all, 1), persisted = JSON.parse(snapshot(result.sessions));
    for (const sid of SESSION_IDS) { persisted[sid].done = new Set(persisted[sid].done); persisted[sid].skipped = new Set(persisted[sid].skipped); }
    expect(persisted).toEqual(result.sessions);
    expect(resolveTaskTimeKey(persisted.evening.tasks[0], 'evening', 1)).toBe('evening-1');
  });
});
