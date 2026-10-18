import { isGameTask, isOneOffSpecialTask, maxTaskIdAcross, oneOffSpecialClaimKey, resolveTaskTimeKey, SESSION_IDS, taskScopeForSort, type AllSessionTasks, type SessionId, type Task } from './sharedTasks';

/** Pure placement transaction. Never routes a move through the destructive delete handler. */
export function editTaskPlacement(all: AllSessionTasks, source: SessionId, id: number, changes: Pick<Task, 'title' | 'emoji' | 'weekdays' | 'specialRewardFloor'>, requested: SessionId[] | undefined, newSharedKey: string) {
  const existing = all[source].tasks.find(t => t.id === id);
  if (!existing || isGameTask(existing) || !changes.title.trim()) return null;
  const related = SESSION_IDS.flatMap(session => all[session].tasks.filter(t => existing.sharedKey ? t.sharedKey === existing.sharedKey : session === source && t.id === id).map(task => ({ session, task })));
  const destinations = SESSION_IDS.filter(sid => (requested?.length ? requested : related.map(r => r.session)).includes(sid));
  if (!destinations.length) return null;
  const matches = (sid: SessionId, task: Task) => related.some(r => r.session === sid && r.task.id === task.id);
  const sessions = Object.fromEntries(SESSION_IDS.map(sid => [sid, { tasks: all[sid].tasks.filter(t => !matches(sid, t)), done: new Set(all[sid].done), skipped: new Set(all[sid].skipped) }])) as AllSessionTasks;
  for (const r of related) { sessions[r.session].done.delete(r.task.id); sessions[r.session].skipped.delete(r.task.id); }
  let nextId = maxTaskIdAcross(...SESSION_IDS.map(sid => all[sid].tasks));
  let sharedKey = existing.sharedKey ?? (destinations.length > 1 ? newSharedKey : undefined);
  const rows = destinations.map(sid => {
    const old = related.find(r => r.session === sid);
    const collision = sessions[sid].tasks.some(t => t.id === existing.id);
    const rowId = old?.task.id ?? (destinations.length === 1 && !collision ? existing.id : ++nextId);
    // A one-off reward's identity must not change merely because its numeric row id collided.
    if (isOneOffSpecialTask(existing) && rowId !== existing.id && !sharedKey) sharedKey = oneOffSpecialClaimKey(existing);
    const row: Task = { ...existing, ...changes, title: changes.title.trim(), id: rowId };
    if (sharedKey) { row.sharedKey = sharedKey; row.sharedSessions = destinations; }
    else { delete row.sharedKey; delete row.sharedSessions; }
    const oldIndex = old ? all[sid].tasks.findIndex(t => t.id === old.task.id) : -1;
    if (oldIndex >= 0) sessions[sid].tasks.splice(Math.min(oldIndex, sessions[sid].tasks.length), 0, row);
    else sessions[sid].tasks.push(row);
    return { session: sid, task: row };
  });
  const doneRows = related.filter(r => all[r.session].done.has(r.task.id));
  const retainedDone = rows.filter(r => doneRows.some(old => old.session === r.session));
  for (const r of retainedDone.length ? retainedDone : doneRows.length ? rows.slice(0, 1) : []) sessions[r.session].done.add(r.task.id);
  const skippedRows = related.filter(r => all[r.session].skipped.has(r.task.id));
  const retainedSkipped = rows.filter(r => skippedRows.some(old => old.session === r.session));
  for (const r of retainedSkipped.length ? retainedSkipped : skippedRows.length && !doneRows.length ? rows.slice(0, 1) : []) {
    if (!sessions[r.session].done.has(r.task.id)) sessions[r.session].skipped.add(r.task.id);
  }
  return { sessions, related, rows,
    oldTimeKeys: [...new Set(related.map(r => resolveTaskTimeKey(r.task, r.session, r.task.id)))],
    newTimeKeys: [...new Set(rows.map(r => resolveTaskTimeKey(r.task, r.session, r.task.id)))],
    oldClaimKey: oneOffSpecialClaimKey(existing), newClaimKey: oneOffSpecialClaimKey(rows[0].task) };
}

export function remapTaskRecord<T>(record: Record<string, T>, from: string[], to: string[]): Record<string, T> {
  if (from.length === to.length && from.every(key => to.includes(key))) return record;
  const source = from.find(key => Object.prototype.hasOwnProperty.call(record, key));
  if (source === undefined) return record;
  const next = { ...record };
  for (const key of to) next[key] = record[source];
  for (const key of from) if (!to.includes(key)) delete next[key];
  return next;
}

/** Swap only visible peers of the same kind. Hidden rows and the game row stay in place. */
export function moveTaskInList(all: Task[], visible: Task[], id: number, direction: -1 | 1): Task[] {
  const task = all.find(t => t.id === id);
  if (!task || isGameTask(task)) return all;
  const peers = visible.filter(t => !isGameTask(t) && taskScopeForSort(t) === taskScopeForSort(task));
  const index = peers.findIndex(t => t.id === id), other = peers[index + direction];
  if (index < 0 || !other) return all;
  const a = all.findIndex(t => t.id === id), b = all.findIndex(t => t.id === other.id);
  if (a < 0 || b < 0) return all;
  const next = [...all]; [next[a], next[b]] = [next[b], next[a]]; return next;
}
