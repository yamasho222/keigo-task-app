export type SessionId = "morning" | "daytime" | "home" | "evening";

export type TaskScope = "regular" | "today" | "special";
export type SpecialRewardFloor = "rare" | "superRare" | "ultraRare";

export function isSpecialRewardFloor(value: unknown): value is SpecialRewardFloor {
  return value === "rare" || value === "superRare" || value === "ultraRare";
}

/** 旧形式 `true` や不正値を SpecialRewardFloor に正規化する */
export function normalizeOneOffSpecialTreatPending(
  raw: Record<string, unknown> | undefined,
  resolveFloor?: (claimKey: string) => SpecialRewardFloor | undefined,
): Record<string, SpecialRewardFloor> {
  if (!raw) return {};
  const next: Record<string, SpecialRewardFloor> = {};
  for (const [claimKey, value] of Object.entries(raw)) {
    if (isSpecialRewardFloor(value)) {
      next[claimKey] = value;
      continue;
    }
    if (value === true) {
      next[claimKey] = resolveFloor?.(claimKey) ?? "rare";
    }
  }
  return next;
}

export function specialRewardFloorLabel(floor: SpecialRewardFloor = "rare"): string {
  if (floor === "ultraRare") return "ウルトラレア以上";
  if (floor === "superRare") return "スーパーレア以上";
  return "レア以上";
}

export function specialRewardFloorCompact(floor?: SpecialRewardFloor): string {
  if (floor === "ultraRare") return "UR+";
  if (floor === "superRare") return "SR+";
  return "R+";
}

export function specialRewardFloorParentHint(floor: SpecialRewardFloor = "rare"): string {
  return `クリアすると${specialRewardFloorLabel(floor)}のシールがもらえるよ！`;
}

export function specialRewardFloorSetupHint(floor: SpecialRewardFloor = "rare"): string {
  return `クリアすると${specialRewardFloorLabel(floor)}のシールがもらえるよ（親の確認が必要）`;
}

export interface Task {
  id: number;
  title: string;
  emoji: string;
  scope?: TaskScope;
  specialRewardFloor?: SpecialRewardFloor;
  weekdays?: number[];
  sharedKey?: string;
  sharedSessions?: SessionId[];
}

export interface SessionTasksSlice {
  tasks: Task[];
  done: Set<number>;
  skipped: Set<number>;
}

export type AllSessionTasks = Record<SessionId, SessionTasksSlice>;

export const SESSION_IDS: SessionId[] = ["morning", "daytime", "home", "evening"];

export const SESSION_SHORT_LABELS: Record<SessionId, string> = {
  morning: "朝",
  daytime: "昼",
  home: "帰宅",
  evening: "夜",
};

export const DEFAULT_HOMEWORK_SHARED_KEY = "default-homework";

export const GAME_TASK_ID = 9001;
export const GAME_TASK_TITLE = "ゲーム・youtube";
export const GAME_TASK_EMOJI = "🎮";

export function isGameTask(task: Task): boolean {
  return task.id === GAME_TASK_ID || task.title === GAME_TASK_TITLE;
}

export function createGameTask(): Task {
  return { id: GAME_TASK_ID, title: GAME_TASK_TITLE, emoji: GAME_TASK_EMOJI, scope: "regular" };
}

export function ensureGameTaskInList(tasks: Task[]): Task[] {
  if (tasks.some(isGameTask)) return tasks;
  return [...tasks, createGameTask()];
}

export function gamePlayKey(date: string, session: SessionId): string {
  return `${date}:${session}`;
}

export function isOneOffSpecialTask(task: Task): boolean {
  return task.scope === "special";
}

export function oneOffSpecialClaimKey(task: Task): string {
  return task.sharedKey ?? `task-${task.id}`;
}

export function tasksForProgress(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isGameTask(t) && !isOneOffSpecialTask(t));
}

/** セッション画面のタスク一覧（ゲーム行以外を表示） */
export function tasksForSessionList(tasks: Task[]): Task[] {
  return tasks.filter((t) => !isGameTask(t));
}

const SCOPE_DISPLAY_ORDER: Record<TaskScope, number> = {
  regular: 0,
  today: 1,
  special: 2,
};

export function taskScopeForSort(task: Task): TaskScope {
  return task.scope ?? "regular";
}

/** 各フェーズ表示順: レギュラー → きょうだけ → 単発特別（スコープ内は配列順を維持） */
export function sortTasksForSessionDisplay(tasks: Task[]): Task[] {
  const orderIndex = new Map(tasks.map((task, index) => [task.id, index]));
  return [...tasks].sort((a, b) => {
    const scopeDiff = SCOPE_DISPLAY_ORDER[taskScopeForSort(a)] - SCOPE_DISPLAY_ORDER[taskScopeForSort(b)];
    if (scopeDiff !== 0) return scopeDiff;
    return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
  });
}

export function isTaskVisibleToday(task: Task, now = new Date()): boolean {
  if (task.scope === "today" || task.scope === "special") return true;
  if (!task.weekdays?.length) return true;
  return task.weekdays.includes(now.getDay());
}

export function isSharedTaskDone(sharedKey: string, allSessions: AllSessionTasks): boolean {
  for (const sid of SESSION_IDS) {
    const { tasks, done } = allSessions[sid];
    for (const t of tasks) {
      if (t.sharedKey === sharedKey && done.has(t.id)) return true;
    }
  }
  return false;
}

export function isTaskVisibleInSession(
  task: Task,
  session: SessionId,
  allSessions: AllSessionTasks,
  now = new Date(),
): boolean {
  if (!isTaskVisibleToday(task, now)) return false;
  if (!task.sharedKey) return true;
  if (!isSharedTaskDone(task.sharedKey, allSessions)) return true;
  const slice = allSessions[session];
  return slice.done.has(task.id) || slice.skipped.has(task.id);
}

export function visibleTasksForSession(
  session: SessionId,
  allSessions: AllSessionTasks,
  now = new Date(),
): Task[] {
  return allSessions[session].tasks.filter((t) => isTaskVisibleInSession(t, session, allSessions, now));
}

export function resolveTaskTimeKey(task: Task | undefined, session: SessionId, taskId: number): string {
  if (task?.sharedKey) return `shared-${task.sharedKey}`;
  return `${session}-${taskId}`;
}

export function sharedSessionsLabel(sessions: SessionId[]): string {
  return sessions.map((s) => SESSION_SHORT_LABELS[s]).join("·");
}

export function generateSharedKey(): string {
  return `shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function maxTaskIdAcross(...taskLists: Task[][]): number {
  let max = 0;
  for (const list of taskLists) {
    for (const t of list) max = Math.max(max, t.id);
  }
  return max;
}

export function findTaskBySharedKey(tasks: Task[], sharedKey: string): Task | undefined {
  return tasks.find((t) => t.sharedKey === sharedKey);
}

export function collectSharedSessions(allSessions: AllSessionTasks, sharedKey: string): SessionId[] {
  const found: SessionId[] = [];
  for (const sid of SESSION_IDS) {
    if (allSessions[sid].tasks.some((t) => t.sharedKey === sharedKey)) found.push(sid);
  }
  return found;
}

/** デフォルト構成の宿題のみ sharedKey を付与（カスタム済みデータは触らない） */
export function migrateDefaultHomeworkSharing(tasksBySession: Record<SessionId, Task[]>): Record<SessionId, Task[]> {
  const home = tasksBySession.home;
  const evening = tasksBySession.evening;
  const homeHw = home.find((t) => t.id === 2 && t.title === "宿題" && !t.sharedKey);
  const eveningHw = evening.find((t) => t.id === 1 && t.title === "宿題" && !t.sharedKey);
  if (!homeHw || !eveningHw) return tasksBySession;

  const sharedSessions: SessionId[] = ["home", "evening"];
  const patch = (t: Task): Task => ({
    ...t,
    sharedKey: DEFAULT_HOMEWORK_SHARED_KEY,
    sharedSessions,
  });

  return {
    ...tasksBySession,
    home: home.map((t) => (t.id === 2 && t.title === "宿題" ? patch(t) : t)),
    evening: evening.map((t) => (t.id === 1 && t.title === "宿題" ? patch(t) : t)),
  };
}

export function buildSharedTaskRow(
  id: number,
  title: string,
  emoji: string,
  scope: TaskScope,
  weekdays: number[] | undefined,
  sharedKey: string,
  sharedSessions: SessionId[],
): Task {
  const task: Task = { id, title, emoji, scope, sharedKey, sharedSessions };
  if (scope === "regular") {
    task.weekdays = weekdays;
  }
  return task;
}
