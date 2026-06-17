import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS as DndCSS } from "@dnd-kit/utilities";
import { theme } from "./theme";
import { AppScroll } from "./AppScroll";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";
import { TimerDurationPanel } from "./TimerControls";
import { AlarmSettingsPanel } from "./AlarmSettingsPanel";
import {
  loadAlarmSettings, saveAlarmSettings, startAlarm, stopAlarm,
  unlockAudio, retryAlarmSound, setSoundBlockedListener,
  type AlarmSettings,
} from "./alarm";
import { RecordScreen, getStreak, isFullDay, getFullDayStreak, type DayHistory } from "./RecordCalendar";
import {
  NewRecordOverlay, TreatOverlay,
  type NewRecordCelebration, type TreatMode,
} from "./Rewards";
import { loadStickerAlbum, mergeStickerAlbums, saveStickerAlbum, getStickersByCategory } from "./stickerRewards";
import {
  getActiveSessionIds, isDaytimeSessionDay, isSessionActiveOnDate,
} from "./japaneseCalendar";
import {
  type DailyMission, type FavoriteMission, type MissionCardStatus,
  MissionCard, MissionConfirmDialog, MissionBriefingOverlay,
  MissionSetupSheet, ShowParentMissionScreen, ShowParentOneOffScreen,
  isMissionBriefingSeen, markMissionBriefingSeen,
} from "./missions";
import {
  getMissionOverallStatus,
  getMissionCardStatus,
  isAllMissionPhasesParentApproved,
  getFirstMissionPhaseAwaitingParent,
  getActiveMissionSessions,
} from "./missionProgress";
import {
  type Task, type SessionId, type AllSessionTasks, type TaskScope, type SpecialRewardFloor,
  SESSION_IDS, SESSION_SHORT_LABELS,
  DEFAULT_HOMEWORK_SHARED_KEY,
  isTaskVisibleToday, isTaskVisibleInSession, visibleTasksForSession,
  isGameTask, ensureGameTaskInList, gamePlayKey, tasksForProgress, createGameTask,
  isOneOffSpecialTask, oneOffSpecialClaimKey, tasksForSessionList,
  resolveTaskTimeKey, sharedSessionsLabel, generateSharedKey,
  maxTaskIdAcross, collectSharedSessions, migrateDefaultHomeworkSharing,
  buildSharedTaskRow,
} from "./sharedTasks";

// ── Types & Data ──────────────────────────────────────

type ScreenId  = SessionId | "show_parent" | "show_parent_mission" | "show_parent_oneoff" | "timer" | "timer_end" | "alarm_settings" | "record" | "task_list";
type CelebType = "confetti" | "burst" | "stripes" | "bars" | "diagonal";
type SwipeMode = "delete" | "skip";

const HOMEWORK_SHARED_META = {
  sharedKey: DEFAULT_HOMEWORK_SHARED_KEY,
  sharedSessions: ["home", "evening"] as SessionId[],
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_WEEKDAY = [1, 2, 3, 4, 5];
const WEEKDAYS_WEEKEND = [0, 6];

function taskMatchesWeekdayFilter(task: Task, filterDow: number | null, now = new Date()): boolean {
  if (filterDow === null) return true;
  if (task.scope === "today" || task.scope === "special") return filterDow === now.getDay();
  if (!task.weekdays?.length) return true;
  return task.weekdays.includes(filterDow);
}

function taskScheduleBadge(task: Task): string {
  if (task.scope === "special") return "特別";
  if (task.scope === "today") return "きょう";
  return weekdayBadgeLabel(task.weekdays) ?? "毎日";
}

type ScheduleBadgeKind = "today" | "special" | "daily" | "weekday" | "weekend" | "custom";

function taskScheduleBadgeKind(task: Task): ScheduleBadgeKind {
  if (task.scope === "special") return "special";
  if (task.scope === "today") return "today";
  if (!task.weekdays?.length || task.weekdays.length === 7) return "daily";
  const sorted = [...task.weekdays].sort((a, b) => a - b);
  if (sorted.join() === WEEKDAYS_WEEKDAY.join()) return "weekday";
  if (sorted.join() === WEEKDAYS_WEEKEND.join()) return "weekend";
  return "custom";
}

function taskScheduleBadgeStyle(task: Task): { label: string; color: string; backgroundColor: string } {
  const label = taskScheduleBadge(task);
  const colorByKind: Record<ScheduleBadgeKind, string> = {
    today: theme.category.pink,
    special: theme.category.orange,
    daily: theme.category.blue,
    weekday: theme.category.purple,
    weekend: theme.category.orange,
    custom: theme.category.green,
  };
  const color = colorByKind[taskScheduleBadgeKind(task)];
  return { label, color, backgroundColor: `${color}18` };
}

function normalizeWeekdaysForSave(weekdays: number[]): number[] | undefined {
  const unique = [...new Set(weekdays)].sort((a, b) => a - b);
  if (unique.length === 0 || unique.length === 7) return undefined;
  return unique;
}

function weekdayBadgeLabel(weekdays?: number[]): string | null {
  if (!weekdays?.length || weekdays.length === 7) return null;
  const sorted = [...weekdays].sort((a, b) => a - b);
  if (sorted.join() === WEEKDAYS_WEEKDAY.join()) return "平日";
  if (sorted.join() === WEEKDAYS_WEEKEND.join()) return "土日";
  return WEEKDAY_DISPLAY_ORDER
    .filter((d) => weekdays.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join("");
}

function taskSharedBadgeStyle(task: Task): { label: string; color: string; backgroundColor: string } | null {
  if (!task.sharedKey || !task.sharedSessions?.length) return null;
  return {
    label: `共有 ${sharedSessionsLabel(task.sharedSessions)}`,
    color: theme.category.purple,
    backgroundColor: `${theme.category.purple}18`,
  };
}

function confirmSharedTaskComplete(task: Task): boolean {
  if (!task.sharedKey || !task.sharedSessions || task.sharedSessions.length < 2) return true;
  return window.confirm(
    `「${task.emoji} ${task.title}」は ${sharedSessionsLabel(task.sharedSessions)} でも同じタスクです。\n全部終わりましたか？`,
  );
}

function reorderVisibleInAll(
  session: SessionId,
  allTasks: Task[],
  reorderedVisible: Task[],
  allSessions: AllSessionTasks,
): Task[] {
  let vi = 0;
  return allTasks.map((t) => {
    if (!isTaskVisibleInSession(t, session, allSessions) || isGameTask(t) || isOneOffSpecialTask(t)) return t;
    const next = reorderedVisible[vi++];
    return next ?? t;
  });
}

function applyHomeworkMigrationToState(tasks: {
  morning: Task[];
  daytime: Task[];
  home: Task[];
  evening: Task[];
}): typeof tasks {
  const migrated = migrateDefaultHomeworkSharing(tasks);
  return {
    morning: migrated.morning,
    daytime: migrated.daytime,
    home: migrated.home,
    evening: migrated.evening,
  };
}

const MORNING_TASKS_DEFAULT: Task[] = [
  { id: 1, title: "朝ごはん",               emoji: "🍚" },
  { id: 2, title: "歯みがき",               emoji: "🦷" },
  { id: 3, title: "洗濯物の片付け",         emoji: "👕" },
  { id: 4, title: "宿題",                   emoji: "📖" },
  { id: 5, title: "宿題をカバンに入れる",   emoji: "📚" },
  { id: 6, title: "水筒の準備",             emoji: "🧴" },
  { id: 7, title: "体操服をカバンに入れる", emoji: "👟" },
  { id: 8, title: "上履きをカバンに入れる", emoji: "🥿" },
  createGameTask(),
];

const EVENING_TASKS_DEFAULT: Task[] = [
  { id: 1, title: "宿題", emoji: "📚", ...HOMEWORK_SHARED_META },
  { id: 2, title: "歯みがき",       emoji: "🦷" },
  { id: 3, title: "お風呂",         emoji: "🛁" },
  { id: 4, title: "頭を乾かす",     emoji: "💨" },
  { id: 5, title: "パジャマを着る", emoji: "😴" },
  createGameTask(),
];

const HOME_TASKS_DEFAULT: Task[] = [
  { id: 1, title: "大事なプリントなど机に出す", emoji: "📄" },
  { id: 2, title: "宿題",                       emoji: "📖", ...HOMEWORK_SHARED_META },
  { id: 3, title: "水筒をキッチンに出す",       emoji: "🧴" },
  { id: 4, title: "洗濯物の片付け",             emoji: "👕" },
  createGameTask(),
];

const DAYTIME_TASKS_DEFAULT: Task[] = [
  { id: 1, title: "お弁当",     emoji: "🍱" },
  { id: 2, title: "水筒を飲む", emoji: "💧" },
  createGameTask(),
];

const SESSION_TABS: { id: SessionId; label: string }[] = [
  { id: "morning", label: "☀️ 朝" },
  { id: "daytime", label: "🌤 昼" },
  { id: "home",    label: "🏠 帰宅" },
  { id: "evening", label: "🌙 夜" },
];

const SESSION_META: Record<SessionId, {
  label: string; timeSuffix: string; menuIcon: string; menuLabel: string;
}> = {
  morning: { label: "朝のやること", timeSuffix: "朝", menuIcon: "🌅", menuLabel: "朝のタスク" },
  daytime: { label: "昼のやること", timeSuffix: "昼", menuIcon: "🌤", menuLabel: "昼のタスク" },
  home:    { label: "帰宅後のやること", timeSuffix: "帰宅後", menuIcon: "🏠", menuLabel: "帰宅後のタスク" },
  evening: { label: "夜のやること", timeSuffix: "夜", menuIcon: "🌙", menuLabel: "夜のタスク" },
};

function isSessionScreen(s: ScreenId): s is SessionId {
  return SESSION_IDS.includes(s as SessionId);
}

function emptyDayHistory(): DayHistory {
  return { morning: false, daytime: false, home: false, evening: false };
}

const CELEB_TYPES: CelebType[] = ["confetti", "burst", "stripes", "bars", "diagonal"];
const CELEB_NAMES: Record<CelebType, string> = {
  confetti: "かみふぶき！", burst: "ドカン！",
  stripes:  "にじいろ！",   bars:  "カラフル！", diagonal: "ながれぼし！",
};
const STAMP_MESSAGES = [
  "すごい！", "さいこう！", "ばっちり！", "かんぺき！",
  "天才！", "100てん！", "あっぱれ！", "ナイス！",
  "がんばったね！", "よくできた！", "さすが！", "やったね！",
];
const FLOAT_COLORS = [
  theme.category.green, theme.category.yellow, theme.category.orange,
  theme.category.pink,  theme.category.purple,
];

// ── localStorage ──────────────────────────────────────

const STORAGE_KEY = "keigo-app-v1";

interface StoredState {
  date: string;
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
  morningTasks: Task[];
  daytimeTasks: Task[];
  eveningTasks: Task[];
  homeTasks: Task[];
  history: Record<string, DayHistory>;
  bestTimes?: Record<string, number>;
  gamePlayTimes?: Record<string, number>;
  dailyTreatClaimed?: Record<string, boolean>;
  dailyTreatPending?: Record<string, boolean>;
  fullDayBonusClaimed?: Record<string, boolean>;
  lastWeeklyRewardStreak?: number;
  stickerAlbum?: string[];
  customTaskEmojis?: string[];
  todayMission?: DailyMission | null;
  favoriteMissions?: FavoriteMission[];
  missionDoneSessions?: SessionId[];
  missionApprovedSessions?: SessionId[];
  specialMissionRewardClaimed?: Record<string, boolean>;
  specialMissionTreatPending?: Record<string, boolean>;
  oneOffSpecialClaimed?: Record<string, boolean>;
  oneOffSpecialTreatPending?: Record<string, boolean>;
  missionHistory?: Record<string, { title: string; emoji: string }>;
  missionEveningNudgeDate?: string;
}

interface ActiveWorkTask { session: SessionId; taskId: number; }

function sessionTreatKey(date: string, session: SessionId) {
  return `${date}:${session}`;
}

function isSessionTreatClaimed(claimed: Record<string, boolean>, date: string, session: SessionId) {
  if (claimed[sessionTreatKey(date, session)]) return true;
  if (claimed[date]) return true;
  return false;
}

interface PendingTreat {
  mode: TreatMode;
  session?: SessionId;
  devForceTier?: import("./stickerRewards").StickerRarity;
  devForceStickerId?: string;
  devForceTease?: boolean;
  devForceTeaseId?: import("./treatTease").TeaseVariantId;
  devForceLegendaryMode?: import("./rarityMeta").LegendaryRevealMode;
  devForceSrUrMode?: import("./rarityMeta").SrUrRevealMode;
  rewardFloor?: SpecialRewardFloor;
  missionTitle?: string;
  oneOffSpecialClaimKey?: string;
}

interface OneOffSpecialPending {
  claimKey: string;
  taskId: number;
  session: SessionId;
  title: string;
  emoji: string;
  rewardFloor: SpecialRewardFloor;
}

function buildTreatQueue(
  opts: {
    needsDaily: boolean;
    dailySession?: SessionId;
    specialMissionEligible: boolean;
    fullDayBonusEligible: boolean;
    weeklyMilestone: boolean;
    missionTitle?: string;
  },
): PendingTreat[] {
  const queue: PendingTreat[] = [];
  if (opts.needsDaily && opts.dailySession) {
    queue.push({ mode: "daily", session: opts.dailySession });
  }
  if (opts.specialMissionEligible) {
    queue.push({ mode: "specialMission", missionTitle: opts.missionTitle });
  }
  if (opts.fullDayBonusEligible) queue.push({ mode: "fullDayBonus" });
  if (opts.weeklyMilestone) queue.push({ mode: "weekly" });
  return queue;
}

function taskTimeKey(session: SessionId, taskId: number, task?: Task) {
  return resolveTaskTimeKey(task, session, taskId);
}

function isTaskResolved(done: Set<number>, skipped: Set<number>, id: number) {
  return done.has(id) || skipped.has(id);
}

function isAllResolved(session: SessionId, allSessions: AllSessionTasks) {
  const visible = tasksForProgress(visibleTasksForSession(session, allSessions));
  const { tasks, done, skipped } = allSessions[session];
  // 表示タスクがなければ、このセッションではやることがない（共有完了で全非表示など）
  if (visible.length === 0) return tasks.length > 0;
  return visible.every((t) => isTaskResolved(done, skipped, t.id));
}

function fmtTaskTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtTaskTimeMs(ms: number) {
  return fmtTaskTime(Math.floor(ms / 1000));
}

function sumSessionBestTimes(
  session: SessionId,
  tasks: Task[],
  bestTimes: Record<string, number>,
) {
  let totalSec = 0;
  let recorded = 0;
  for (const t of tasks) {
    const sec = bestTimes[resolveTaskTimeKey(t, session, t.id)];
    if (sec !== undefined) {
      totalSec += sec;
      recorded++;
    }
  }
  return { totalSec, recorded, total: tasks.length };
}

function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** カレンダー上の「きょう」（連続記録・親承認の日付） */
function todayKey() {
  return localDateKey();
}

/**
 * タスク完了のリセット境界（毎日 23:59 ローカル）。
 * 23:59 以降は翌日のタスク日として扱い、完了状態をリセットする。
 */
function taskDayKey(now = new Date()): string {
  const d = new Date(now);
  if (d.getHours() === 23 && d.getMinutes() >= 59) {
    d.setDate(d.getDate() + 1);
  }
  return localDateKey(d);
}

function freshCompletionSlice(
  morningTasks: Task[],
  daytimeTasks: Task[],
  eveningTasks: Task[],
  homeTasks: Task[],
) {
  return {
    date: taskDayKey(),
    morningDone: [] as number[],
    daytimeDone: [] as number[],
    eveningDone: [] as number[],
    homeDone: [] as number[],
    morningSkipped: [] as number[],
    daytimeSkipped: [] as number[],
    eveningSkipped: [] as number[],
    homeSkipped: [] as number[],
    morningApproved: false,
    daytimeApproved: false,
    eveningApproved: false,
    homeApproved: false,
    morningTasks: stripEphemeralTasks(morningTasks),
    daytimeTasks: stripEphemeralTasks(daytimeTasks),
    eveningTasks: stripEphemeralTasks(eveningTasks),
    homeTasks: stripEphemeralTasks(homeTasks),
  };
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => ({ ...t, scope: t.scope ?? "regular" }));
}

function normalizeAllTaskLists(stored: StoredState): Pick<StoredState, "morningTasks" | "daytimeTasks" | "eveningTasks" | "homeTasks"> {
  const raw = {
    morning: normalizeTasks(stored.morningTasks ?? MORNING_TASKS_DEFAULT),
    daytime: normalizeTasks(stored.daytimeTasks ?? DAYTIME_TASKS_DEFAULT),
    evening: normalizeTasks(stored.eveningTasks ?? EVENING_TASKS_DEFAULT),
    home: normalizeTasks(stored.homeTasks ?? HOME_TASKS_DEFAULT),
  };
  const migrated = applyHomeworkMigrationToState(raw);
  return {
    morningTasks: ensureGameTaskInList(migrated.morning),
    daytimeTasks: ensureGameTaskInList(migrated.daytime),
    eveningTasks: ensureGameTaskInList(migrated.evening),
    homeTasks: ensureGameTaskInList(migrated.home),
  };
}

function stripEphemeralTasks(tasks: Task[]): Task[] {
  return normalizeTasks(tasks).filter((t) => t.scope !== "today" && t.scope !== "special");
}

function hydrateStoredState(data: StoredState): StoredState {
  const lists = normalizeAllTaskLists(data);
  return {
    ...data,
    ...lists,
    morningDone: data.morningDone ?? [],
    daytimeDone: data.daytimeDone ?? [],
    eveningDone: data.eveningDone ?? [],
    homeDone: data.homeDone ?? [],
    morningSkipped: data.morningSkipped ?? [],
    daytimeSkipped: data.daytimeSkipped ?? [],
    eveningSkipped: data.eveningSkipped ?? [],
    homeSkipped: data.homeSkipped ?? [],
    morningApproved: data.morningApproved ?? false,
    daytimeApproved: data.daytimeApproved ?? false,
    eveningApproved: data.eveningApproved ?? false,
    homeApproved: data.homeApproved ?? false,
  };
}

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data: StoredState = JSON.parse(raw);
      if (data.date === taskDayKey()) {
        return hydrateStoredState(data);
      }
      const hydrated = hydrateStoredState(data);
      return {
        ...hydrated,
        ...freshCompletionSlice(
          hydrated.morningTasks,
          hydrated.daytimeTasks,
          hydrated.eveningTasks,
          hydrated.homeTasks,
        ),
        history: hydrated.history ?? {},
        bestTimes: hydrated.bestTimes,
        stickerAlbum: hydrated.stickerAlbum,
        dailyTreatClaimed: hydrated.dailyTreatClaimed,
        fullDayBonusClaimed: hydrated.fullDayBonusClaimed,
        lastWeeklyRewardStreak: hydrated.lastWeeklyRewardStreak,
        favoriteMissions: hydrated.favoriteMissions,
        gamePlayTimes: hydrated.gamePlayTimes,
        missionHistory: hydrated.missionHistory,
      };
    }
  } catch { /* ignore */ }
  return {
    ...freshCompletionSlice(
      MORNING_TASKS_DEFAULT,
      DAYTIME_TASKS_DEFAULT,
      EVENING_TASKS_DEFAULT,
      HOME_TASKS_DEFAULT,
    ),
    history: {},
  };
}

function getVisibleSessionTabs(d = new Date()) {
  return SESSION_TABS.filter((t) => isSessionActiveOnDate(t.id, d));
}

function getAdjacentSession(
  current: SessionId,
  direction: "next" | "prev",
  d = new Date(),
): SessionId | null {
  const tabs = getVisibleSessionTabs(d).map((t) => t.id);
  const idx = tabs.indexOf(current);
  if (idx < 0) return null;
  if (direction === "next") return idx < tabs.length - 1 ? tabs[idx + 1] : null;
  return idx > 0 ? tabs[idx - 1] : null;
}

function getSessionScreen(now = new Date()): SessionId {
  const h = now.getHours();
  if (h < 12) return "morning";
  if (h < 16 && isDaytimeSessionDay(now)) return "daytime";
  if (h < 19) return "home";
  return "evening";
}

function getInitialScreen(): ScreenId {
  return getSessionScreen();
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function getDayLabel(): string {
  const dow = ["日", "月", "火", "水", "木", "金", "土"][new Date().getDay()];
  return `${dow}曜日`;
}

// ── AnimStyles ────────────────────────────────────────

function AnimStyles() {
  return (
    <style>{`
      @keyframes checkPop {
        0%  { transform: scale(1); }
        35% { transform: scale(1.65); }
        60% { transform: scale(0.82); }
        80% { transform: scale(1.08); }
        100%{ transform: scale(1); }
      }
      @keyframes ringOut {
        0%  { transform: scale(1);  opacity: 0.9; }
        100%{ transform: scale(3);  opacity: 0; }
      }
      @keyframes rowGlow {
        0%,100%{ opacity:1; }
        25%    { opacity:0.55; }
      }
      @keyframes floatUp {
        0%  { transform: translateY(0)     scale(1.3);  opacity: 1; }
        30% { transform: translateY(-22px) scale(1.45); opacity: 1; }
        65% { transform: translateY(-44px) scale(1.2);  opacity: 1; }
        100%{ transform: translateY(-66px) scale(0.9);  opacity: 0; }
      }
      @keyframes stepPop {
        0%  { transform: scale(1);   }
        50% { transform: scale(1.3); }
        100%{ transform: scale(1);   }
      }
      @keyframes activePulse {
        0%,100%{ transform: scale(1);    opacity: 1;  }
        50%    { transform: scale(1.14); opacity: 0.8;}
      }
      @keyframes confettiPiece {
        0%  { transform: translateY(0)     rotate(0deg);              opacity: 1;  }
        88% { opacity: 0.85; }
        100%{ transform: translateY(100vh) rotate(var(--spin,600deg)); opacity: 0; }
      }
      @keyframes burstParticle {
        0%  { transform: translate(0,0) scale(1.2); opacity: 1; }
        100%{ transform: translate(var(--tx,0), var(--ty,0)) scale(0); opacity: 0; }
      }
      @keyframes stripeDown {
        0%  { transform: translateY(-100%); opacity: 0;    }
        16% { transform: translateY(0);     opacity: 0.72; }
        72% { transform: translateY(0);     opacity: 0.72; }
        100%{ transform: translateY(-100%); opacity: 0;    }
      }
      @keyframes barFromLeft {
        0%  { transform: translateX(-105%); opacity: 0;    }
        6%  {                               opacity: 0.75; }
        36% { transform: translateX(0);     opacity: 0.72; }
        64% { transform: translateX(0);     opacity: 0.72; }
        94% {                               opacity: 0.75; }
        100%{ transform: translateX(105%);  opacity: 0;    }
      }
      @keyframes barFromRight {
        0%  { transform: translateX(105%);  opacity: 0;    }
        6%  {                               opacity: 0.75; }
        36% { transform: translateX(0);     opacity: 0.72; }
        64% { transform: translateX(0);     opacity: 0.72; }
        94% {                               opacity: 0.75; }
        100%{ transform: translateX(-105%); opacity: 0;    }
      }
      @keyframes diagPiece {
        0%  { transform: translate(0,0) rotate(0deg);                               opacity: 1; }
        80% { opacity: 0.55; }
        100%{ transform: translate(var(--dx,180px), var(--dy,600px)) rotate(540deg); opacity: 0; }
      }
      @keyframes celebLabel {
        0%  { transform: translateY(16px) scale(0.7);  opacity: 0; }
        18% { transform: translateY(0)    scale(1.15); opacity: 1; }
        30% { transform: translateY(0)    scale(1);    opacity: 1; }
        75% { opacity: 1; }
        100%{ transform: translateY(-12px);            opacity: 0; }
      }
      @keyframes sparkleConverge {
        0%  { transform: translate(var(--sx, 0px), var(--sy, 0px)) scale(1.4); opacity: 1; }
        60% { opacity: 0.7; }
        100%{ transform: translate(0px, 0px) scale(0.1); opacity: 0; }
      }
      @keyframes stampPress {
        0%  { transform: scale(2.8) rotate(-18deg); opacity: 0; }
        48% { transform: scale(0.88) rotate(4deg);  opacity: 0.9; }
        65% { transform: scale(1.08) rotate(-2deg); opacity: 1; }
        82% { transform: scale(0.97) rotate(1deg); }
        100%{ transform: scale(1) rotate(-7deg);   opacity: 1; }
      }
      @keyframes inkRipple {
        0%  { transform: scale(0.5); opacity: 0.7; }
        100%{ transform: scale(2.6); opacity: 0; }
      }
      @keyframes phoneShake {
        0%,100%{ transform: translateX(0); }
        20%    { transform: translateX(-5px) rotate(-0.6deg); }
        40%    { transform: translateX(5px)  rotate(0.6deg); }
        60%    { transform: translateX(-3px); }
        80%    { transform: translateX(3px); }
      }
      @keyframes approvedSlide {
        0%  { transform: translateY(20px); opacity: 0; }
        100%{ transform: translateY(0);    opacity: 1; }
      }
      @keyframes weekStampPop {
        0%  { transform: scale(0); }
        55% { transform: scale(1.28); }
        78% { transform: scale(0.92); }
        100%{ transform: scale(1); }
      }
      @keyframes recordFlash {
        0%  { opacity: 0; }
        15% { opacity: 1; }
        100%{ opacity: 0.35; }
      }
      @keyframes recordTextPop {
        0%  { transform: scale(0.2); opacity: 0; }
        50% { transform: scale(1.2); opacity: 1; }
        70% { transform: scale(0.95); }
        100%{ transform: scale(1); opacity: 1; }
      }
      @keyframes recordTextPopDelay {
        0%  { transform: translateY(30px) scale(0.8); opacity: 0; }
        100%{ transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes recordBadgePop {
        0%  { transform: scale(0) rotate(-12deg); opacity: 0; }
        45% { transform: scale(1.35) rotate(4deg); opacity: 1; }
        65% { transform: scale(0.9); }
        100%{ transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes chestShake {
        0%,100%{ transform: rotate(0deg); }
        20%    { transform: rotate(-8deg) scale(1.05); }
        40%    { transform: rotate(8deg) scale(1.08); }
        60%    { transform: rotate(-5deg); }
        80%    { transform: rotate(5deg); }
      }
      @keyframes chestOpen {
        0%  { transform: scale(1); }
        40% { transform: scale(1.5); }
        100%{ transform: scale(1.2); }
      }
      @keyframes treatReveal {
        0%  { transform: scale(0.3); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100%{ transform: scale(1); opacity: 1; }
      }
      @keyframes treatRevealRare {
        0%  { transform: scale(0.2); opacity: 0; }
        55% { transform: scale(1.2); opacity: 1; }
        100%{ transform: scale(1); opacity: 1; }
      }
      @keyframes treatRevealSR {
        0%  { transform: scale(0) rotate(-8deg); opacity: 0; }
        50% { transform: scale(1.25) rotate(2deg); opacity: 1; }
        100%{ transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes treatRevealUR {
        0%  { transform: scale(0) rotate(-12deg); opacity: 0; }
        40% { transform: scale(1.4) rotate(4deg); opacity: 1; }
        70% { transform: scale(1.05) rotate(-2deg); opacity: 1; }
        100%{ transform: scale(1) rotate(0deg); opacity: 1; }
      }
      @keyframes rarityGlowPulse {
        0%, 100% { box-shadow: 0 0 12px var(--glow-color, #AF52DE44); }
        50%      { box-shadow: 0 0 28px var(--glow-color, #AF52DE88), 0 0 48px var(--glow-color, #AF52DE44); }
      }
      @keyframes urShimmer {
        0%  { text-shadow: 0 0 8px var(--shimmer-color, #FF950066); }
        50% { text-shadow: 0 0 20px var(--shimmer-color, #FF9500CC), 0 0 32px var(--shimmer-color, #FF950088); }
        100%{ text-shadow: 0 0 8px var(--shimmer-color, #FF950066); }
      }
      @keyframes chestOpenUR {
        0%  { transform: scale(1); }
        35% { transform: scale(1.8); }
        100%{ transform: scale(1.35); }
      }
      @keyframes chestLevitate {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-18px); }
      }
      @keyframes orbitParticle {
        from { transform: rotate(0deg) translateX(var(--orbit-r, 60px)) rotate(0deg); }
        to   { transform: rotate(360deg) translateX(var(--orbit-r, 60px)) rotate(-360deg); }
      }
      @keyframes srRipple {
        0%   { transform: scale(0.3); opacity: 0.85; }
        100% { transform: scale(2.8); opacity: 0; }
      }
      @keyframes glimmerRise {
        0%   { transform: translateY(0) scale(0.5); opacity: 0; }
        30%  { opacity: 1; }
        100% { transform: translateY(-80px) scale(1); opacity: 0.2; }
      }
      @keyframes teaseDimIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes urPillarGrow {
        0%   { transform: scaleY(0); opacity: 0; }
        40%  { opacity: 1; }
        100% { transform: scaleY(1); opacity: 0.95; }
      }
      @keyframes urShockwave {
        0%   { transform: scale(0.2); opacity: 0.75; }
        100% { transform: scale(3.2); opacity: 0; }
      }
      @keyframes urMeteor {
        0%   { transform: translate(var(--mx, 0), var(--my, 0)) scale(0.4); opacity: 0; }
        15%  { opacity: 1; }
        100% { transform: translate(0, 0) scale(1.3); opacity: 0; }
      }
      @keyframes urWhiteout {
        0%   { opacity: 0; }
        45%  { opacity: 1; }
        100% { opacity: 0.92; }
      }
      @keyframes urAuroraSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes teaseAuroraStrip {
        0%   { transform: translateX(-30%) rotate(var(--aurora-rot, -25deg)); opacity: 0; }
        30%  { opacity: 0.7; }
        100% { transform: translateX(30%) rotate(var(--aurora-rot, -25deg)); opacity: 0; }
      }
      @keyframes chestShakeFast {
        0%, 100% { transform: rotate(0deg) scale(1); }
        25%      { transform: rotate(-12deg) scale(1.1); }
        50%      { transform: rotate(12deg) scale(1.15); }
        75%      { transform: rotate(-8deg) scale(1.12); }
      }
      @keyframes chestShakePremium {
        0%, 100% { transform: rotate(0deg) scale(1); }
        15%      { transform: rotate(-10deg) scale(1.08); }
        30%      { transform: rotate(10deg) scale(1.12); }
        45%      { transform: rotate(-7deg) scale(1.1); }
        60%      { transform: rotate(7deg) scale(1.11); }
        75%      { transform: rotate(-4deg) scale(1.07); }
        90%      { transform: rotate(4deg) scale(1.06); }
      }
      @keyframes chestGlowPulse {
        0%, 100% { box-shadow: 0 0 18px 6px rgba(255,204,0,0.28), 0 0 36px 10px rgba(255,149,0,0.18); border-radius: 50%; }
        50%      { box-shadow: 0 0 28px 12px rgba(255,204,0,0.5), 0 0 52px 16px rgba(255,149,0,0.32); border-radius: 50%; }
      }
      @keyframes chestGlowPulseMission {
        0%, 100% { box-shadow: 0 0 18px 6px rgba(175,82,222,0.32), 0 0 36px 10px rgba(255,45,85,0.18); border-radius: 50%; }
        50%      { box-shadow: 0 0 28px 12px rgba(175,82,222,0.52), 0 0 52px 16px rgba(255,45,85,0.28); border-radius: 50%; }
      }
      @keyframes missionEveningNudge {
        0%, 100% { transform: scale(1); }
        50%      { transform: scale(1.02); box-shadow: 0 0 0 3px rgba(255,149,0,0.35); }
      }
      @keyframes chestSparkleTwinkle {
        0%, 100% { opacity: 0.45; }
        50%      { opacity: 1; }
      }
      @keyframes srMagicSpin {
        from { transform: rotate(0deg) scale(0.75); opacity: 0; }
        25%  { opacity: 1; }
        to   { transform: rotate(280deg) scale(1.05); opacity: 0.92; }
      }
      @keyframes srMagicSpinReverse {
        from { transform: rotate(0deg) scale(1.1); opacity: 0; }
        25%  { opacity: 0.9; }
        to   { transform: rotate(-360deg) scale(0.78); opacity: 0.82; }
      }
      @keyframes srMagicBeam {
        0%   { transform: rotate(var(--beam-rot, 0deg)) scaleY(0); opacity: 0; }
        40%  { opacity: 1; }
        100% { transform: rotate(var(--beam-rot, 0deg)) scaleY(1.25); opacity: 0; }
      }
      @keyframes srMagicFloorGlow {
        0%, 100% { transform: scaleX(0.5); opacity: 0; }
        35%      { opacity: 0.9; }
        75%      { transform: scaleX(1.3); opacity: 0.7; }
      }
      @keyframes srStarRain {
        0%   { transform: translate3d(-20px, -20vh, 0) scale(0.55); opacity: 0; }
        15%  { opacity: 1; }
        100% { transform: translate3d(36px, 72vh, 0) scale(1.15); opacity: 0; }
      }
      @keyframes srStarGroundGlow {
        0%, 100% { transform: scaleX(0.55); opacity: 0; }
        45%      { opacity: 0.85; }
        80%      { transform: scaleX(1.25); opacity: 0.65; }
      }
      @keyframes srMistRise {
        0%   { transform: translateY(18px) scale(0.55); opacity: 0; }
        25%  { opacity: 0.92; }
        100% { transform: translateY(-96px) scale(1.5); opacity: 0; }
      }
      @keyframes srMistSpread {
        0%   { transform: scale(0.35); opacity: 0; }
        45%  { opacity: 0.88; }
        100% { transform: scale(1.85); opacity: 0; }
      }
      @keyframes urLightColumnMax {
        0%   { transform: scaleY(0) scaleX(0.35); opacity: 0; }
        30%  { opacity: 1; }
        70%  { transform: scaleY(1.15) scaleX(1); opacity: 0.95; }
        100% { transform: scaleY(1.25) scaleX(1.25); opacity: 0; }
      }
      @keyframes urEmberRise {
        0%   { transform: translateY(40px) scale(0.45); opacity: 0; }
        20%  { opacity: 1; }
        100% { transform: translateY(-72vh) scale(1.25); opacity: 0; }
      }
      @keyframes urShockwaveMax {
        0%   { transform: scale(0.08); opacity: 0.95; }
        100% { transform: scale(5); opacity: 0; }
      }
      @keyframes urMeteorMax {
        0%   { transform: translate(var(--mx, 0), var(--my, 0)) rotate(var(--meteor-rot, 0deg)) scale(0.4); opacity: 0; }
        12%  { opacity: 1; }
        76%  { opacity: 1; }
        100% { transform: translate(0, 0) rotate(var(--meteor-rot, 0deg)) scale(1.45); opacity: 0; }
      }
      @keyframes urImpactWhite {
        0%   { opacity: 0; }
        30%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes urGateSpin {
        0%   { transform: rotate(0deg) scale(1.25); opacity: 0; }
        20%  { opacity: 0.95; }
        100% { transform: rotate(420deg) scale(0.45); opacity: 0; }
      }
      @keyframes urGateCore {
        0%   { transform: scale(0.2); opacity: 0; }
        35%  { opacity: 0.9; }
        100% { transform: scale(1.45); opacity: 0; }
      }
      @keyframes urWhiteoutMax {
        0%   { opacity: 0; }
        35%  { opacity: 1; }
        65%  { opacity: 0.35; }
        100% { opacity: 0; }
      }
      @keyframes urBlackout {
        0%   { opacity: 0; }
        45%  { opacity: 0.85; }
        100% { opacity: 0; }
      }
      @keyframes urStarDustFall {
        0%   { transform: translateY(-12vh) scale(0.5); opacity: 0; }
        25%  { opacity: 1; }
        100% { transform: translateY(76vh) scale(1); opacity: 0; }
      }
      @keyframes cutinFakeCrush {
        0%   { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
        35%  { transform: scale(1.08) rotate(-6deg); opacity: 1; filter: brightness(1.4); }
        100% { transform: scale(0.15) rotate(18deg); opacity: 0; filter: brightness(2); }
      }
      @keyframes cutinSpeedLine {
        0%   { transform: rotate(var(--line-rot, 0deg)) scaleX(0.08); opacity: 0; }
        20%  { opacity: 0.95; }
        100% { transform: rotate(var(--line-rot, 0deg)) scaleX(1.35); opacity: 0; }
      }
      @keyframes cutinTextSlam {
        0%   { transform: translateX(-50%) scale(2.8); opacity: 0; }
        35%  { transform: translateX(-50%) scale(0.92); opacity: 1; }
        55%  { transform: translateX(-50%) scale(1.05); opacity: 1; }
        100% { transform: translateX(-50%) scale(1); opacity: 0.92; }
      }
      @keyframes cutinTextSlamUr {
        0%   { transform: translateX(-50%) scale(3.2); opacity: 0; }
        28%  { transform: translateX(-50%) scale(0.88); opacity: 1; }
        48%  { transform: translateX(-50%) scale(1.12); opacity: 1; }
        100% { transform: translateX(-50%) scale(1); opacity: 1; }
      }
      @keyframes cutinFreezeDim {
        0%   { opacity: 0; }
        25%  { opacity: 0.72; }
        100% { opacity: 0.45; }
      }
      @keyframes cutinShockRing {
        0%   { transform: scale(0.15); opacity: 0.95; }
        100% { transform: scale(4.5); opacity: 0; }
      }
      @keyframes cutinTierBurst {
        0%   { opacity: 0; transform: scale(0.85); }
        30%  { opacity: 0.85; }
        100% { opacity: 0; transform: scale(1.15); }
      }
      @keyframes cutinMorphFlash {
        0%   { opacity: 0; }
        35%  { opacity: 0.95; }
        100% { opacity: 0; }
      }
      @keyframes cutinMorphFlashUr {
        0%   { opacity: 0; }
        30%  { opacity: 1; }
        70%  { opacity: 0.55; }
        100% { opacity: 0; }
      }
      @keyframes treatRevealLR {
        0%   { transform: scale(0) rotate(-12deg); opacity: 0; filter: brightness(2); }
        35%  { transform: scale(1.35) rotate(4deg); opacity: 1; filter: brightness(1.6); }
        55%  { transform: scale(0.95) rotate(-2deg); opacity: 1; filter: brightness(1.2); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
      }
      @keyframes lrShimmer {
        0%, 100% { background-position: 0% 50%; }
        50%      { background-position: 100% 50%; }
      }
      @keyframes lrRainbowBorder {
        0%   { border-color: #ff3366; box-shadow: 0 0 12px #ff336688; }
        16%  { border-color: #ff8800; box-shadow: 0 0 12px #ff880088; }
        33%  { border-color: #ffdd00; box-shadow: 0 0 12px #ffdd0088; }
        50%  { border-color: #33dd66; box-shadow: 0 0 12px #33dd6688; }
        66%  { border-color: #3399ff; box-shadow: 0 0 12px #3399ff88; }
        83%  { border-color: #8844ff; box-shadow: 0 0 12px #8844ff88; }
        100% { border-color: #ff44cc; box-shadow: 0 0 12px #ff44cc88; }
      }
      @keyframes lrRevealBurstIn {
        0%   { transform: scale(0.3); opacity: 0; }
        20%  { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes lrWhiteoutLegendary {
        0%   { opacity: 0; background: rgba(255,255,255,0); }
        40%  { opacity: 1; background: rgba(255,255,255,0.98); }
        100% { opacity: 0; background: rgba(255,255,255,0); }
      }
      @keyframes lrTeaseDim {
        0%   { opacity: 0; }
        100% { opacity: 0.72; }
      }
      @keyframes lrRainbowPillarGrow {
        0%   { transform: scaleY(0) scaleX(0.2); opacity: 0; }
        35%  { opacity: 1; }
        100% { transform: scaleY(1.2) scaleX(1.3); opacity: 0.85; }
      }
      @keyframes lrStarSuck {
        0%   { transform: translate(0, 0) scale(1); opacity: 0; }
        20%  { opacity: 1; }
        100% { transform: translate(calc(50vw - 50%), calc(50vh - 50%)) scale(0.2); opacity: 0; }
      }
      @keyframes lrShockwaveGold {
        0%   { transform: scale(0.1); opacity: 0.95; }
        100% { transform: scale(6); opacity: 0; }
      }
      @keyframes lrPrismRingSpin {
        0%   { transform: rotate(0deg) scale(0.85); opacity: 0; }
        25%  { opacity: 0.9; }
        100% { transform: rotate(360deg) scale(1.15); opacity: 0; }
      }
      @keyframes lrCrownDrop {
        0%   { transform: translateX(-50%) translateY(-80px) scale(1.8); opacity: 0; }
        40%  { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
      @keyframes lrMeteorRainbow {
        0%   { transform: translate(var(--mx, 0), var(--my, 0)) rotate(var(--meteor-rot, 0deg)) scale(0.3); opacity: 0; }
        15%  { opacity: 1; }
        80%  { opacity: 1; }
        100% { transform: translate(0, 0) rotate(var(--meteor-rot, 0deg)) scale(1.5); opacity: 0; }
      }
      @keyframes chestOpenLR {
        0%   { transform: scale(1) rotate(0deg); }
        30%  { transform: scale(1.35) rotate(-8deg); }
        55%  { transform: scale(0.92) rotate(6deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      @keyframes chestGlowRainbow {
        0%, 100% { filter: drop-shadow(0 0 12px #ff3366) drop-shadow(0 0 24px #8844ff); }
        33%      { filter: drop-shadow(0 0 16px #ffdd00) drop-shadow(0 0 28px #33dd66); }
        66%      { filter: drop-shadow(0 0 14px #3399ff) drop-shadow(0 0 26px #ff8800); }
      }
      @keyframes chestLevitateLr {
        0%, 100% { transform: translateY(0) scale(1); }
        50%      { transform: translateY(-18px) scale(1.06); }
      }
      @keyframes cutinFreezeHold {
        0%   { opacity: 0; }
        100% { opacity: 0.82; background: rgba(0,0,0,0.82); }
      }
      @keyframes lrCrackShatter {
        0%   { transform: scale(1); opacity: 1; filter: brightness(1); }
        40%  { transform: scale(1.05); opacity: 1; filter: brightness(1.5); }
        100% { transform: scale(0.2) rotate(12deg); opacity: 0; filter: brightness(2.5); }
      }
      @keyframes lrMorphRainbow {
        0%   { opacity: 0; transform: scale(0.5); }
        30%  { opacity: 1; transform: scale(1.2); }
        100% { opacity: 0; transform: scale(2); }
      }
      @keyframes cutinFakeUrHold {
        0%   { transform: scale(0.92); opacity: 0.85; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes lrNormalUrSurge {
        0%   { opacity: 0; transform: scale(0.75); }
        35%  { opacity: 0.9; transform: scale(1.05); }
        100% { opacity: 0; transform: scale(1.2); }
      }
      @keyframes lrUrImpactWhite {
        0%   { opacity: 0; }
        55%  { opacity: 0; }
        72%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes lrFakeUrBgGlow {
        0%   { opacity: 0; }
        20%  { opacity: 0.85; }
        100% { opacity: 0.55; }
      }
      @keyframes lrFakeUrBurstIn {
        0%   { transform: scale(0.15) rotate(-18deg); opacity: 0; filter: brightness(2.2); }
        28%  { transform: scale(1.18) rotate(6deg); opacity: 1; filter: brightness(1.6); }
        48%  { transform: scale(0.94) rotate(-3deg); opacity: 1; filter: brightness(1.25); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
      }
      .check-pop   { animation: checkPop   0.42s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .ring-out    { animation: ringOut    0.5s  ease-out forwards; }
      .row-glow    { animation: rowGlow    0.5s  ease-out; }
      .float-label { animation: floatUp    1.25s ease-out forwards; }
      .step-just   { animation: stepPop    0.38s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .step-active { animation: activePulse 1.8s ease-in-out infinite; }
      .stamp-press { animation: stampPress 0.55s cubic-bezier(0.34,1.2,0.64,1) forwards; }
      .ink-ripple  { animation: inkRipple  0.9s  ease-out both 0.1s; }
      .ink-ripple2 { animation: inkRipple  0.75s ease-out both 0.28s; }
      .phone-shake { animation: phoneShake 0.42s ease-out; }
      .approved-in { animation: approvedSlide 0.4s cubic-bezier(0.34,1.4,0.64,1) 0.5s both; }
      .stamp-day   { animation: weekStampPop 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .sparkle-in  { animation: sparkleConverge 0.65s ease-in both; }
      .record-flash       { animation: recordFlash 0.8s ease-out forwards; }
      .record-text-pop    { animation: recordTextPop 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .record-text-pop-delay { animation: recordTextPopDelay 0.5s cubic-bezier(0.34,1.4,0.64,1) 0.25s both; }
      .record-badge-pop   { animation: recordBadgePop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .chest-shake   { animation: chestShake 0.8s ease-in-out infinite; }
      .chest-shake-premium { animation: chestShakePremium 1.1s ease-in-out infinite; }
      .chest-glow-pulse    { animation: chestGlowPulse 1.8s ease-in-out infinite; }
      .chest-glow-pulse-mission { animation: chestGlowPulseMission 1.8s ease-in-out infinite; }
      .mission-evening-nudge { animation: missionEveningNudge 1.6s ease-in-out infinite; border-radius: 14px; }
      .chest-sparkle-orbit {
        animation: orbitParticle var(--orbit-dur, 2.4s) linear infinite,
                   chestSparkleTwinkle 1.4s ease-in-out infinite;
      }
      .chest-open    { animation: chestOpen 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .chest-open-ur { animation: chestOpenUR 0.65s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .treat-reveal      { animation: treatReveal 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .treat-reveal-rare { animation: treatRevealRare 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .treat-reveal-sr   { animation: treatRevealSR 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .treat-reveal-ur   { animation: treatRevealUR 0.85s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .treat-reveal-lr   { animation: treatRevealLR 1.05s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .lr-reveal-burst-in { animation: lrRevealBurstIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .lr-shimmer        { animation: lrShimmer 2s ease-in-out infinite; background: linear-gradient(90deg, #ff3366, #ffdd00, #33dd66, #3399ff, #8844ff, #ff3366); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; }
      .lr-rainbow-border { animation: lrRainbowBorder 2.5s linear infinite; border: 2px solid #ffdd00; }
      .lr-whiteout-legendary { animation: lrWhiteoutLegendary 0.55s ease-out forwards; background: rgba(255,255,255,0.98); position: absolute; inset: 0; }
      .lr-tease-dim      { animation: lrTeaseDim 0.8s ease-out forwards; background: rgba(0,0,0,0.72); position: absolute; inset: 0; }
      .lr-rainbow-pillar { animation: lrRainbowPillarGrow 2.2s ease-out forwards; }
      .lr-star-suck      { animation: lrStarSuck 1.4s ease-in forwards; }
      .lr-shockwave-gold { animation: lrShockwaveGold 0.75s ease-out forwards; }
      .lr-prism-ring     { animation: lrPrismRingSpin 2.4s ease-out forwards; }
      .lr-crown-drop     { animation: lrCrownDrop 1.2s cubic-bezier(0.34,1.4,0.64,1) forwards; }
      .lr-meteor-rainbow { animation: lrMeteorRainbow 1.1s ease-in forwards; }
      .chest-open-lr     { animation: chestOpenLR 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .chest-glow-rainbow { animation: chestGlowRainbow 1.6s ease-in-out infinite; }
      .chest-levitate-lr { animation: chestLevitateLr 2.2s ease-in-out infinite; }
      .chest-glow-rainbow .chest-shake-fast { animation: chestShakeFast 0.35s ease-in-out infinite, chestLevitateLr 2.2s ease-in-out infinite; }
      .cutin-freeze-hold { animation: cutinFreezeHold 0.4s ease-out forwards; background: rgba(0,0,0,0.82); position: absolute; inset: 0; }
      .lr-crack-shatter  { animation: lrCrackShatter 0.6s ease-in forwards; }
      .lr-morph-rainbow  { animation: lrMorphRainbow 1.8s ease-out forwards; }
      .cutin-fake-ur-hold { animation: cutinFakeUrHold 0.35s ease-out forwards; }
      .lr-normal-ur-surge { animation: lrNormalUrSurge 0.95s ease-out forwards; }
      .lr-ur-impact-white { animation: lrUrImpactWhite 0.55s ease-out forwards; background: rgba(255,255,255,0.94); position: absolute; inset: 0; }
      .lr-fake-ur-bg-glow { animation: lrFakeUrBgGlow 1.2s ease-out forwards; background: radial-gradient(circle at 50% 45%, rgba(255,160,60,0.55) 0%, rgba(255,220,80,0.28) 35%, transparent 68%); }
      .lr-fake-ur-burst-in { animation: lrFakeUrBurstIn 0.75s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .rarity-glow-pulse { animation: rarityGlowPulse 1.6s ease-in-out infinite; }
      .ur-shimmer        { animation: urShimmer 1.8s ease-in-out infinite; }
      .rarity-badge-pop-delay { animation: recordBadgePop 0.6s cubic-bezier(0.34,1.56,0.64,1) 0.15s both; }
      .chest-levitate    { animation: chestLevitate 2s ease-in-out infinite; }
      .chest-shake-fast  { animation: chestShakeFast 0.35s ease-in-out infinite; }
      .orbit-particle    { animation: orbitParticle var(--orbit-dur, 2s) linear infinite; }
      .sr-ripple         { animation: srRipple 0.85s ease-out forwards; }
      .glimmer-rise      { animation: glimmerRise 1s ease-out forwards; }
      .tease-dim         { animation: teaseDimIn 0.6s ease-out forwards; background: rgba(0,0,0,0.5); position: absolute; inset: 0; }
      .ur-pillar         { animation: urPillarGrow 1.4s ease-out forwards; transform-origin: bottom center; }
      .ur-shockwave      { animation: urShockwave 0.85s ease-out forwards; }
      .ur-meteor         { animation: urMeteor 0.75s ease-in forwards; }
      .ur-whiteout       { animation: urWhiteout 0.55s ease-in forwards; background: rgba(255,255,255,0.95); position: absolute; inset: 0; }
      .ur-aurora-ring    { animation: urAuroraSpin 3s linear infinite; }
      .tease-aurora-strip { animation: teaseAuroraStrip 1.4s ease-in-out forwards; }
      .sr-magic-spin     { animation: srMagicSpin 1.8s ease-out forwards; }
      .sr-magic-spin-reverse { animation: srMagicSpinReverse 1.8s ease-out forwards; }
      .sr-magic-beam     { animation: srMagicBeam 1.35s ease-out forwards; }
      .sr-magic-floor-glow { animation: srMagicFloorGlow 1.75s ease-out forwards; }
      .sr-star-rain      { animation: srStarRain 1.55s ease-in forwards; }
      .sr-star-ground-glow { animation: srStarGroundGlow 1.7s ease-out forwards; }
      .sr-mist-rise      { animation: srMistRise 1.45s ease-out forwards; }
      .sr-mist-spread    { animation: srMistSpread 1.65s ease-out forwards; }
      .ur-light-column-max { animation: urLightColumnMax 1.65s ease-out forwards; }
      .ur-ember-rise     { animation: urEmberRise 1.65s ease-out forwards; }
      .ur-shockwave-max  { animation: urShockwaveMax 0.9s ease-out forwards; }
      .ur-meteor-max     { animation: urMeteorMax 0.95s ease-in forwards; }
      .ur-impact-white   { animation: urImpactWhite 0.32s ease-out both; background: rgba(255,255,255,0.92); position: absolute; inset: 0; }
      .ur-gate-spin      { animation: urGateSpin 1.7s cubic-bezier(0.25,0.1,0.2,1) forwards; }
      .ur-gate-core      { animation: urGateCore 1.55s ease-out forwards; }
      .ur-whiteout-max   { animation: urWhiteoutMax 0.95s ease-out forwards; background: rgba(255,255,255,0.96); }
      .ur-blackout       { animation: urBlackout 0.65s ease-out forwards; }
      .ur-stardust-fall  { animation: urStarDustFall 0.9s ease-in forwards; }
      .cutin-fake-crush  { animation: cutinFakeCrush 0.55s ease-in forwards; }
      .cutin-speed-line  { animation: cutinSpeedLine 0.65s ease-out forwards; }
      .cutin-text-slam   { animation: cutinTextSlam 0.75s cubic-bezier(0.34,1.4,0.64,1) forwards; }
      .cutin-text-slam-ur { animation: cutinTextSlamUr 0.85s cubic-bezier(0.34,1.4,0.64,1) forwards; }
      .cutin-freeze-dim  { animation: cutinFreezeDim 0.5s ease-out forwards; background: rgba(0,0,0,0.55); position: absolute; inset: 0; }
      .cutin-shock-ring  { animation: cutinShockRing 0.85s ease-out forwards; }
      .cutin-tier-burst  { animation: cutinTierBurst 1.1s ease-out forwards; }
      .cutin-morph-flash { animation: cutinMorphFlash 0.45s ease-out forwards; }
      .cutin-morph-flash-ur { animation: cutinMorphFlashUr 0.55s ease-out forwards; }
    `}</style>
  );
}

// ── Main ──────────────────────────────────────────────

const QUICK_EMOJIS = ["📝", "✏️", "🎯", "⭐", "🎮", "📱", "🎵", "🏃", "🍽️", "🛒", "💊", "🐾"];
const CUSTOM_TASK_EMOJI_LIMIT = 24;

function extractFirstEmoji(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    const segments = [...segmenter.segment(trimmed)].map((s) => s.segment);
    const first = segments[0];
    if (!first || !/\p{Extended_Pictographic}/u.test(first)) return null;
    return first;
  } catch {
    const match = trimmed.match(/\p{Extended_Pictographic}/u);
    return match?.[0] ?? null;
  }
}

function rememberCustomTaskEmoji(prev: string[], emoji: string): string[] {
  if (!emoji || QUICK_EMOJIS.includes(emoji) || prev.includes(emoji)) return prev;
  return [emoji, ...prev].slice(0, CUSTOM_TASK_EMOJI_LIMIT);
}

export default function KeigoTaskApp() {
  const stored = loadStoredState();

  const [screen,         setScreen]         = useState<ScreenId>(getInitialScreen());
  const [morningTasks,   setMorningTasks]   = useState<Task[]>(stored.morningTasks ?? MORNING_TASKS_DEFAULT);
  const [daytimeTasks,   setDaytimeTasks]   = useState<Task[]>(stored.daytimeTasks ?? DAYTIME_TASKS_DEFAULT);
  const [eveningTasks,   setEveningTasks]   = useState<Task[]>(stored.eveningTasks ?? EVENING_TASKS_DEFAULT);
  const [homeTasks,      setHomeTasks]      = useState<Task[]>(stored.homeTasks ?? HOME_TASKS_DEFAULT);
  const [morningDone,    setMorningDone]    = useState<Set<number>>(new Set(stored.morningDone));
  const [daytimeDone,    setDaytimeDone]    = useState<Set<number>>(new Set(stored.daytimeDone));
  const [eveningDone,    setEveningDone]    = useState<Set<number>>(new Set(stored.eveningDone));
  const [homeDone,       setHomeDone]       = useState<Set<number>>(new Set(stored.homeDone));
  const [morningSkipped, setMorningSkipped] = useState<Set<number>>(new Set(stored.morningSkipped));
  const [daytimeSkipped, setDaytimeSkipped] = useState<Set<number>>(new Set(stored.daytimeSkipped));
  const [eveningSkipped, setEveningSkipped] = useState<Set<number>>(new Set(stored.eveningSkipped));
  const [homeSkipped,    setHomeSkipped]    = useState<Set<number>>(new Set(stored.homeSkipped));
  const [morningApproved, setMorningApproved] = useState(stored.morningApproved);
  const [daytimeApproved, setDaytimeApproved] = useState(stored.daytimeApproved);
  const [eveningApproved, setEveningApproved] = useState(stored.eveningApproved);
  const [homeApproved,    setHomeApproved]    = useState(stored.homeApproved);
  const [history,        setHistory]        = useState<Record<string, DayHistory>>(stored.history ?? {});
  const [bestTimes,      setBestTimes]      = useState<Record<string, number>>(stored.bestTimes ?? {});
  const [gamePlayTimes,  setGamePlayTimes]  = useState<Record<string, number>>(stored.gamePlayTimes ?? {});
  const [customTaskEmojis, setCustomTaskEmojis] = useState<string[]>(stored.customTaskEmojis ?? []);
  const [todayMission, setTodayMission] = useState<DailyMission | null>(() => {
    const m = stored.todayMission;
    if (m && m.dateKey === taskDayKey()) return m;
    return null;
  });
  const [favoriteMissions, setFavoriteMissions] = useState<FavoriteMission[]>(stored.favoriteMissions ?? []);
  const [missionDoneSessions, setMissionDoneSessions] = useState<SessionId[]>(() => {
    const m = stored.todayMission;
    if (!m || m.dateKey !== taskDayKey()) return [];
    return stored.missionDoneSessions ?? [];
  });
  const [missionApprovedSessions, setMissionApprovedSessions] = useState<SessionId[]>(() => {
    const m = stored.todayMission;
    if (!m || m.dateKey !== taskDayKey()) return [];
    return stored.missionApprovedSessions ?? [];
  });
  const [specialMissionRewardClaimed, setSpecialMissionRewardClaimed] = useState<Record<string, boolean>>(
    stored.specialMissionRewardClaimed ?? {},
  );
  const [specialMissionTreatPending, setSpecialMissionTreatPending] = useState<Record<string, boolean>>(
    stored.specialMissionTreatPending ?? {},
  );
  const [oneOffSpecialClaimed, setOneOffSpecialClaimed] = useState<Record<string, boolean>>(
    stored.oneOffSpecialClaimed ?? {},
  );
  const [oneOffSpecialTreatPending, setOneOffSpecialTreatPending] = useState<Record<string, boolean>>(
    stored.oneOffSpecialTreatPending ?? {},
  );
  const [oneOffSpecialAwaitingParent, setOneOffSpecialAwaitingParent] = useState<OneOffSpecialPending | null>(null);
  const [oneOffSpecialStampApproved, setOneOffSpecialStampApproved] = useState(false);
  const [oneOffSpecialCompletedAt, setOneOffSpecialCompletedAt] = useState("");
  const [missionHistory, setMissionHistory] = useState<Record<string, { title: string; emoji: string }>>(
    stored.missionHistory ?? {},
  );
  const [missionEveningNudgeDate, setMissionEveningNudgeDate] = useState<string | undefined>(
    stored.missionEveningNudgeDate,
  );
  const [showMissionSetup, setShowMissionSetup] = useState(false);
  const [showMissionConfirm, setShowMissionConfirm] = useState(false);
  const [missionConfirmSession, setMissionConfirmSession] = useState<SessionId | null>(null);
  const [showMissionBriefing, setShowMissionBriefing] = useState(false);
  const [missionParentPhase, setMissionParentPhase] = useState<SessionId | null>(null);
  const [missionCompletedAt, setMissionCompletedAt] = useState("");

  const addCustomTaskEmoji = (emoji: string) => {
    setCustomTaskEmojis((prev) => rememberCustomTaskEmoji(prev, emoji));
  };

  const [activeWorkTask, setActiveWorkTask] = useState<ActiveWorkTask | null>(null);
  const [workTimerElapsed, setWorkTimerElapsed] = useState(0);
  const [workTimerRunning, setWorkTimerRunning] = useState(false);
  const isWorkTimerLocked =
    activeWorkTask !== null && (workTimerRunning || workTimerElapsed > 0);
  const [newRecordTaskId, setNewRecordTaskId] = useState<number | null>(null);
  const [newRecordCelebration, setNewRecordCelebration] = useState<NewRecordCelebration | null>(null);
  const [newRecordCelebKey, setNewRecordCelebKey] = useState(0);
  const [dailyTreatClaimed, setDailyTreatClaimed] = useState<Record<string, boolean>>(stored.dailyTreatClaimed ?? {});
  const [dailyTreatPending, setDailyTreatPending] = useState<Record<string, boolean>>(stored.dailyTreatPending ?? {});
  const [fullDayBonusClaimed, setFullDayBonusClaimed] = useState<Record<string, boolean>>(stored.fullDayBonusClaimed ?? {});
  const [lastWeeklyRewardStreak, setLastWeeklyRewardStreak] = useState(stored.lastWeeklyRewardStreak ?? 0);
  const [pendingTreat, setPendingTreat] = useState<PendingTreat | null>(null);
  const [treatQueue, setTreatQueue] = useState<PendingTreat[]>([]);
  const [stickerAlbum, setStickerAlbum] = useState<string[]>(() => {
    const merged = mergeStickerAlbums(loadStickerAlbum(), stored.stickerAlbum ?? []);
    if (merged.length > 0) saveStickerAlbum(merged);
    return merged;
  });
  const taskDayRef = useRef(stored.date);
  const screenRef = useRef<ScreenId>(getInitialScreen());
  const specialMissionCollectedRef = useRef(false);
  const oneOffSpecialCollectedRef = useRef(false);
  const dailyTreatCollectedRef = useRef(false);
  const gameTimerStartRef = useRef<number | null>(null);
  const gameTimerPausedTotalRef = useRef(0);
  const gameTimerPauseStartRef = useRef<number | null>(null);
  const [gameTimerOvertime, setGameTimerOvertime] = useState(false);
  const [gameTimerElapsedSec, setGameTimerElapsedSec] = useState(0);
  const workTimerBaseRef = useRef(0);
  const workTimerStartRef = useRef<number | null>(null);

  const [justChecked,  setJustChecked]  = useState<number | null>(null);
  const [celebKey,     setCelebKey]     = useState(0);
  const [celebType,    setCelebType]    = useState<CelebType | null>(null);
  const [stampKey,     setStampKey]     = useState(0);
  const [stampVisible, setStampVisible] = useState(false);
  const [stampMessage, setStampMessage] = useState("");
  const [shaking,      setShaking]      = useState(false);
  const [anticipating, setAnticipating] = useState(false);
  const [floatColor,   setFloatColor]   = useState(theme.category.green);
  const [prevScreen,   setPrevScreen]   = useState<ScreenId>(getInitialScreen());
  const [showMenu,     setShowMenu]     = useState(false);
  const [taskListSession, setTaskListSession] = useState<SessionId>(getSessionScreen());
  const [parentSession, setParentSession] = useState<SessionId>("morning");
  const [parentCtx, setParentCtx] = useState<{ label: string; taskNames: string[]; completedAt: string }>({
    label: "朝のやること",
    taskNames: MORNING_TASKS_DEFAULT.map((t) => t.title),
    completedAt: "",
  });
  const [timerDuration, setTimerDuration] = useState(30); // 分単位
  const timerEndRef = useRef<number | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(0);
  const [timerSessionTotal, setTimerSessionTotal] = useState(30 * 60);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(loadAlarmSettings);
  const [alarmRinging, setAlarmRinging] = useState(false);
  const [alarmSoundBlocked, setAlarmSoundBlocked] = useState(false);
  const alarmSettingsRef = useRef(alarmSettings);
  useEffect(() => { alarmSettingsRef.current = alarmSettings; }, [alarmSettings]);

  const streak = getStreak(history);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const activeSessionIds = getActiveSessionIds();

  useEffect(() => {
    const today = todayKey();
    if (localStorage.getItem("keigo-daily-treat-pending-migration") === today) return;

    const approvedBySession: Record<SessionId, boolean> = {
      morning: morningApproved,
      daytime: daytimeApproved,
      home: homeApproved,
      evening: eveningApproved,
    };

    let nextPending = { ...dailyTreatPending };
    let nextClaimed = { ...dailyTreatClaimed };
    let changed = false;

    for (const sid of SESSION_IDS) {
      const key = sessionTreatKey(today, sid);
      if (approvedBySession[sid] && nextClaimed[key] && !nextPending[key]) {
        nextPending[key] = true;
        delete nextClaimed[key];
        changed = true;
      }
    }

    if (changed) {
      setDailyTreatPending(nextPending);
      setDailyTreatClaimed(nextClaimed);
    }
    localStorage.setItem("keigo-daily-treat-pending-migration", today);
  }, [morningApproved, daytimeApproved, homeApproved, eveningApproved, dailyTreatClaimed, dailyTreatPending]);

  const sessionState = {
    morning: {
      tasks: morningTasks, setTasks: setMorningTasks,
      done: morningDone, setDone: setMorningDone,
      skipped: morningSkipped, setSkipped: setMorningSkipped,
      approved: morningApproved, setApproved: setMorningApproved,
    },
    daytime: {
      tasks: daytimeTasks, setTasks: setDaytimeTasks,
      done: daytimeDone, setDone: setDaytimeDone,
      skipped: daytimeSkipped, setSkipped: setDaytimeSkipped,
      approved: daytimeApproved, setApproved: setDaytimeApproved,
    },
    home: {
      tasks: homeTasks, setTasks: setHomeTasks,
      done: homeDone, setDone: setHomeDone,
      skipped: homeSkipped, setSkipped: setHomeSkipped,
      approved: homeApproved, setApproved: setHomeApproved,
    },
    evening: {
      tasks: eveningTasks, setTasks: setEveningTasks,
      done: eveningDone, setDone: setEveningDone,
      skipped: eveningSkipped, setSkipped: setEveningSkipped,
      approved: eveningApproved, setApproved: setEveningApproved,
    },
  } as const;

  const getAllSessionTasks = (
    patch?: Partial<Record<SessionId, Partial<{ done: Set<number>; skipped: Set<number> }>>>,
  ): AllSessionTasks => {
    const pick = (sid: SessionId) => ({
      tasks: sessionState[sid].tasks,
      done: patch?.[sid]?.done ?? sessionState[sid].done,
      skipped: patch?.[sid]?.skipped ?? sessionState[sid].skipped,
    });
    return {
      morning: pick("morning"),
      daytime: pick("daytime"),
      home: pick("home"),
      evening: pick("evening"),
    };
  };

  const approved = sessionState[parentSession].approved;

  useEffect(() => {
    if (screen === "daytime" && !isDaytimeSessionDay()) {
      setScreen(getSessionScreen());
    }
    if (taskListSession === "daytime" && !isDaytimeSessionDay()) {
      setTaskListSession(getSessionScreen());
    }
  }, [screen, taskListSession]);

  // ── localStorage save ──
  useEffect(() => {
    const state: StoredState = {
      date: taskDayKey(),
      morningDone:    [...morningDone],
      daytimeDone:    [...daytimeDone],
      eveningDone:    [...eveningDone],
      homeDone:       [...homeDone],
      morningSkipped: [...morningSkipped],
      daytimeSkipped: [...daytimeSkipped],
      eveningSkipped: [...eveningSkipped],
      homeSkipped:    [...homeSkipped],
      morningApproved,
      daytimeApproved,
      eveningApproved,
      homeApproved,
      morningTasks,
      daytimeTasks,
      eveningTasks,
      homeTasks,
      history,
      bestTimes,
      gamePlayTimes,
      dailyTreatClaimed,
      dailyTreatPending,
      fullDayBonusClaimed,
      lastWeeklyRewardStreak,
      stickerAlbum,
      customTaskEmojis,
      todayMission,
      favoriteMissions,
      missionDoneSessions,
      missionApprovedSessions,
      specialMissionRewardClaimed,
      specialMissionTreatPending,
      oneOffSpecialClaimed,
      oneOffSpecialTreatPending,
      missionHistory,
      missionEveningNudgeDate,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStickerAlbum(stickerAlbum);
  }, [
    morningDone, daytimeDone, eveningDone, homeDone,
    morningSkipped, daytimeSkipped, eveningSkipped, homeSkipped,
    morningApproved, daytimeApproved, eveningApproved, homeApproved,
    morningTasks, daytimeTasks, eveningTasks, homeTasks,
    history, bestTimes, gamePlayTimes,
    dailyTreatClaimed, dailyTreatPending, fullDayBonusClaimed, lastWeeklyRewardStreak, stickerAlbum,
    customTaskEmojis, todayMission, favoriteMissions,
    missionDoneSessions, missionApprovedSessions, specialMissionRewardClaimed, specialMissionTreatPending,
    oneOffSpecialClaimed, oneOffSpecialTreatPending,
    missionHistory, missionEveningNudgeDate,
  ]);

  useEffect(() => {
    saveAlarmSettings(alarmSettings);
  }, [alarmSettings]);

  useEffect(() => () => stopAlarm(), []);

  useEffect(() => {
    setSoundBlockedListener(setAlarmSoundBlocked);
    return () => setSoundBlockedListener(null);
  }, []);

  // iOS 対策: 操作のたびに Audio を解禁しておく
  useEffect(() => {
    const unlock = () => { void unlockAudio(); };
    document.addEventListener("touchstart", unlock, { passive: true });
    document.addEventListener("click", unlock);
    const onVisible = () => {
      if (document.visibilityState === "visible") void unlockAudio();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("click", unlock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const stopAlarmNow = () => {
    stopAlarm();
    setAlarmRinging(false);
  };

  const triggerTimerEndAlarm = () => {
    void (async () => {
      await unlockAudio();
      startAlarm(alarmSettingsRef.current, () => setAlarmRinging(false), { loud: true });
      setAlarmRinging(true);
    })();
  };

  const testAlarm = async () => {
    stopAlarmNow();
    await unlockAudio();
    startAlarm({ ...alarmSettings, durationSec: 3 }, () => setAlarmRinging(false));
    setAlarmRinging(true);
  };

  const updateAlarmSettings = (next: AlarmSettings) => {
    setAlarmSettings(next);
    saveAlarmSettings(next);
  };

  // ── タスク作業タイマー（ゲームタイマーとは別・カウントアップ）──
  useEffect(() => {
    if (!workTimerRunning) return;
    const id = setInterval(() => {
      if (workTimerStartRef.current) {
        setWorkTimerElapsed(workTimerBaseRef.current + Date.now() - workTimerStartRef.current);
      }
    }, 100);
    return () => clearInterval(id);
  }, [workTimerRunning]);

  const resetWorkTimer = () => {
    workTimerBaseRef.current = 0;
    workTimerStartRef.current = null;
    setWorkTimerRunning(false);
    setWorkTimerElapsed(0);
  };

  // 23:59 をまたいだら完了状態をリセット（最短記録は維持）
  useEffect(() => {
    const applyTaskDayReset = () => {
      const key = taskDayKey();
      if (key === taskDayRef.current) return;
      taskDayRef.current = key;
      setMorningDone(new Set());
      setDaytimeDone(new Set());
      setEveningDone(new Set());
      setHomeDone(new Set());
      setMorningSkipped(new Set());
      setDaytimeSkipped(new Set());
      setEveningSkipped(new Set());
      setHomeSkipped(new Set());
      setMorningApproved(false);
      setDaytimeApproved(false);
      setEveningApproved(false);
      setHomeApproved(false);
      setMorningTasks((t) => stripEphemeralTasks(t));
      setDaytimeTasks((t) => stripEphemeralTasks(t));
      setEveningTasks((t) => stripEphemeralTasks(t));
      setHomeTasks((t) => stripEphemeralTasks(t));
      setOneOffSpecialClaimed({});
      setOneOffSpecialTreatPending({});
      setOneOffSpecialAwaitingParent(null);
      setOneOffSpecialStampApproved(false);
      setActiveWorkTask(null);
      resetWorkTimer();
      setJustChecked(null);
      setNewRecordCelebration(null);
      setStampVisible(false);
      setTodayMission(null);
      setMissionDoneSessions([]);
      setMissionApprovedSessions([]);
      setMissionParentPhase(null);
      setMissionEveningNudgeDate(undefined);
      setShowMissionBriefing(false);
      setShowMissionConfirm(false);
      if (screenRef.current === "daytime" && !isDaytimeSessionDay()) {
        setScreen(getSessionScreen());
      }
      setTaskListSession((s) => (s === "daytime" && !isDaytimeSessionDay() ? getSessionScreen() : s));
    };

    applyTaskDayReset();
    const id = setInterval(applyTaskDayReset, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") applyTaskDayReset();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const pauseWorkTimer = () => {
    if (workTimerStartRef.current) {
      workTimerBaseRef.current += Date.now() - workTimerStartRef.current;
      workTimerStartRef.current = null;
    }
    setWorkTimerRunning(false);
    setWorkTimerElapsed(workTimerBaseRef.current);
  };

  const startWorkTimer = () => {
    if (workTimerRunning) return;
    workTimerStartRef.current = Date.now();
    setWorkTimerRunning(true);
  };

  const resetSessionApproval = (session: SessionId) => {
    const today = todayKey();
    const prev = history[today] ?? emptyDayHistory();
    sessionState[session].setApproved(false);
    const updatedDay = { ...prev, [session]: false };
    setHistory({ ...history, [today]: updatedDay });
    const treatKey = sessionTreatKey(today, session);
    setDailyTreatPending((p) => {
      if (!p[treatKey]) return p;
      const next = { ...p };
      delete next[treatKey];
      return next;
    });
    setDailyTreatClaimed((c) => {
      if (!c[treatKey]) return c;
      const next = { ...c };
      delete next[treatKey];
      return next;
    });
    if (!isFullDay(updatedDay, new Date())) {
      setFullDayBonusClaimed((claimed) => {
        if (!claimed[today]) return claimed;
        const next = { ...claimed };
        delete next[today];
        return next;
      });
    }
    setStampVisible(false);
  };

  const closeTreatOverlay = () => {
    setPendingTreat((closing) => {
      if (closing?.mode === "specialMission" && !specialMissionCollectedRef.current) {
        setSpecialMissionTreatPending((p) => ({ ...p, [currentTaskDay]: true }));
      }
      if (closing?.mode === "oneOffSpecial" && closing.oneOffSpecialClaimKey && !oneOffSpecialCollectedRef.current) {
        setOneOffSpecialTreatPending((p) => ({ ...p, [closing.oneOffSpecialClaimKey!]: true }));
      }
      if (closing?.mode === "daily" && closing.session && !dailyTreatCollectedRef.current) {
        const treatSession = closing.session;
        setDailyTreatPending((p) => ({
          ...p,
          [sessionTreatKey(todayKey(), treatSession)]: true,
        }));
      }
      specialMissionCollectedRef.current = false;
      oneOffSpecialCollectedRef.current = false;
      dailyTreatCollectedRef.current = false;
      return null;
    });
    setTreatQueue((queue) => {
      if (queue.length === 0) {
        return [];
      }
      const [next, ...rest] = queue;
      setPendingTreat(next);
      return rest;
    });
    if (screenRef.current === "show_parent_oneoff") {
      if (isSessionScreen(prevScreen)) {
        setScreen(prevScreen);
      } else {
        setScreen(getSessionScreen());
      }
    }
  };

  const openTreatQueue = (queue: PendingTreat[]) => {
    if (queue.length === 0) return;
    const [first, ...rest] = queue;
    setPendingTreat(first);
    setTreatQueue(rest);
  };

  const redoTask = (
    session: SessionId,
    taskId: number,
    done: Set<number>,
    setDone: (s: Set<number>) => void,
  ) => {
    if (celebType || anticipating) return;
    const next = new Set(done);
    next.delete(taskId);
    setDone(next);
    resetSessionApproval(session);
    cancelWorkTask();
    setActiveWorkTask({ session, taskId });
  };

  const selectWorkTask = (
    session: SessionId,
    taskId: number,
    done: Set<number>,
    skipped: Set<number>,
    setDone: (s: Set<number>) => void,
  ) => {
    if (isWorkTimerLocked) return;
    const task = sessionState[session].tasks.find((t) => t.id === taskId);
    if (task && isGameTask(task)) return;
    if (skipped.has(taskId) || celebType || anticipating) return;
    if (done.has(taskId)) {
      redoTask(session, taskId, done, setDone);
      return;
    }
    if (activeWorkTask?.session === session && activeWorkTask.taskId === taskId) return;
    pauseWorkTimer();
    resetWorkTimer();
    setActiveWorkTask({ session, taskId });
  };

  const cancelWorkTask = () => {
    pauseWorkTimer();
    resetWorkTimer();
    setActiveWorkTask(null);
  };

  const maybeCelebrate = (
    session: SessionId,
    done: Set<number>,
    skipped: Set<number>,
    label: string,
  ) => {
    const allSessions = getAllSessionTasks({ [session]: { done, skipped } });
    const visible = visibleTasksForSession(session, allSessions);
    if (isAllResolved(session, allSessions)) {
      const names = visible.map((t) => {
        if (skipped.has(t.id)) return `${t.title}（あとで）`;
        return t.title;
      });
      setAnticipating(true);
      setTimeout(() => fireCelebration({ label, taskNames: names }, session), 750);
    }
  };

  const applyTaskDone = (
    session: SessionId,
    taskId: number,
    done: Set<number>,
    skipped: Set<number>,
    setDone: (s: Set<number>) => void,
    setSkipped: (s: Set<number>) => void,
    label: string,
  ) => {
    let nextDone = done;
    let nextSkipped = skipped;

    if (!done.has(taskId)) {
      nextDone = new Set(done);
      nextDone.add(taskId);
      setDone(nextDone);
      setFloatColor(FLOAT_COLORS[Math.floor(Math.random() * FLOAT_COLORS.length)]);
      setJustChecked(taskId);
      setTimeout(() => setJustChecked(null), 1350);
    }

    if (skipped.has(taskId)) {
      nextSkipped = new Set(skipped);
      nextSkipped.delete(taskId);
      setSkipped(nextSkipped);
    }

    const task = sessionState[session].tasks.find((t) => t.id === taskId);
    if (task && isOneOffSpecialTask(task)) {
      const claimKey = oneOffSpecialClaimKey(task);
      if (!oneOffSpecialClaimed[claimKey]) {
        fireOneOffSpecialCelebration(session, task);
      }
    } else {
      maybeCelebrate(session, nextDone, nextSkipped, label);
    }
  };

  const completeWorkTask = (
    session: SessionId,
    tasks: Task[],
    done: Set<number>,
    skipped: Set<number>,
    setDone: (s: Set<number>) => void,
    setSkipped: (s: Set<number>) => void,
    label: string,
  ) => {
    if (!activeWorkTask || activeWorkTask.session !== session) return;
    if (workTimerRunning) pauseWorkTimer();
    const totalSec = Math.floor(workTimerElapsed / 1000);
    if (totalSec < 1) return;

    const { taskId } = activeWorkTask;
    const task = tasks.find((t) => t.id === taskId);
    if (task?.sharedKey && !confirmSharedTaskComplete(task)) return;

    const key = resolveTaskTimeKey(task, session, taskId);
    const prevBest = bestTimes[key];
    if (prevBest === undefined || totalSec < prevBest) {
      setBestTimes((prev) => ({ ...prev, [key]: totalSec }));
      setNewRecordTaskId(taskId);
      setTimeout(() => setNewRecordTaskId(null), 4500);
      if (task) {
        setNewRecordCelebKey((k) => k + 1);
        setNewRecordCelebration({ emoji: task.emoji, title: task.title, timeSec: totalSec });
        setShaking(true);
        setTimeout(() => setShaking(false), 520);
        navigator.vibrate?.(30);
      }
    }

    applyTaskDone(session, taskId, done, skipped, setDone, setSkipped, label);
    resetWorkTimer();
    setActiveWorkTask(null);
  };

  const quickCompleteTask = (
    session: SessionId,
    taskId: number,
    tasks: Task[],
    done: Set<number>,
    skipped: Set<number>,
    setDone: (s: Set<number>) => void,
    setSkipped: (s: Set<number>) => void,
    label: string,
  ) => {
    if (celebType || anticipating) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || isGameTask(task) || done.has(taskId)) return;
    if (task.sharedKey && !confirmSharedTaskComplete(task)) return;

    if (activeWorkTask?.session === session && activeWorkTask.taskId === taskId) {
      cancelWorkTask();
    }

    applyTaskDone(session, taskId, done, skipped, setDone, setSkipped, label);
  };

  // ── ゲームタイマー（カウントダウン後は超過時間も計測）──
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      if (!gameTimerStartRef.current) return;

      let pausedTotal = gameTimerPausedTotalRef.current;
      if (timerPaused && gameTimerPauseStartRef.current) {
        pausedTotal += Date.now() - gameTimerPauseStartRef.current;
      }
      const elapsed = Math.max(0, Math.floor((Date.now() - gameTimerStartRef.current - pausedTotal) / 1000));
      setGameTimerElapsedSec(elapsed);

      if (timerPaused) return;

      if (gameTimerOvertime) return;

      const rem = timerSessionTotal - elapsed;
      if (rem <= 0) {
        timerEndRef.current = null;
        setTimerSecondsLeft(0);
        setGameTimerOvertime(true);
        triggerTimerEndAlarm();
        setScreen((s) => (s === "timer" ? "timer_end" : s));
      } else {
        setTimerSecondsLeft(rem);
      }
    }, 500);
    return () => clearInterval(id);
  }, [timerRunning, timerPaused, timerSessionTotal, gameTimerOvertime]);

  const startTimer = (minutes: number) => {
    void unlockAudio();
    const secs = minutes * 60;
    gameTimerStartRef.current = Date.now();
    gameTimerPausedTotalRef.current = 0;
    gameTimerPauseStartRef.current = null;
    timerEndRef.current = Date.now() + secs * 1000;
    setTimerSecondsLeft(secs);
    setTimerSessionTotal(secs);
    setTimerDuration(minutes);
    setTimerPaused(false);
    setTimerRunning(true);
    setGameTimerOvertime(false);
    setGameTimerElapsedSec(0);
  };

  const pauseTimer = () => {
    if (!timerRunning || timerPaused) return;
    gameTimerPauseStartRef.current = Date.now();
    if (timerEndRef.current) {
      const rem = Math.max(0, Math.ceil((timerEndRef.current - Date.now()) / 1000));
      timerEndRef.current = null;
      setTimerSecondsLeft(rem);
    }
    setTimerPaused(true);
  };

  const resumeTimer = () => {
    if (!timerPaused || !timerRunning) return;
    if (gameTimerPauseStartRef.current) {
      gameTimerPausedTotalRef.current += Date.now() - gameTimerPauseStartRef.current;
      gameTimerPauseStartRef.current = null;
    }
    if (!gameTimerOvertime) {
      timerEndRef.current = Date.now() + timerSecondsLeft * 1000;
    }
    setTimerPaused(false);
  };

  const resetGameTimerState = () => {
    timerEndRef.current = null;
    gameTimerStartRef.current = null;
    gameTimerPausedTotalRef.current = 0;
    gameTimerPauseStartRef.current = null;
    setGameTimerOvertime(false);
    setGameTimerElapsedSec(0);
    setTimerPaused(false);
    setTimerRunning(false);
    setTimerSecondsLeft(timerDuration * 60);
    setTimerSessionTotal(timerDuration * 60);
  };

  const cancelTimer = () => {
    resetGameTimerState();
  };

  const finishGameSession = () => {
    if (!gameTimerStartRef.current) {
      resetGameTimerState();
      goHome();
      return;
    }
    let pausedTotal = gameTimerPausedTotalRef.current;
    if (timerPaused && gameTimerPauseStartRef.current) {
      pausedTotal += Date.now() - gameTimerPauseStartRef.current;
    }
    const totalSec = Math.max(1, Math.floor((Date.now() - gameTimerStartRef.current - pausedTotal) / 1000));
    const key = gamePlayKey(todayKey(), parentSession);
    setGamePlayTimes((prev) => ({ ...prev, [key]: totalSec }));
    stopAlarmNow();
    resetGameTimerState();
    goHome();
  };

  const setTimerDurationOnly = (minutes: number) => {
    setTimerDuration(minutes);
    if (!timerRunning) {
      setTimerSecondsLeft(minutes * 60);
      setTimerSessionTotal(minutes * 60);
    }
  };

  // ── celebration ──
  const fireCelebration = (
    ctx: { label: string; taskNames: string[] },
    session: SessionId,
  ) => {
    setAnticipating(false);
    setStampVisible(false);
    setParentSession(session);
    setParentCtx({ ...ctx, completedAt: fmtTime(new Date()) });
    const picked = CELEB_TYPES[Math.floor(Math.random() * CELEB_TYPES.length)];
    setCelebKey((k) => k + 1);
    setCelebType(picked);
    setTimeout(() => {
      setCelebType(null);
      const s = screenRef.current;
      if (isSessionScreen(s)) setPrevScreen(s);
      setScreen("show_parent");
    }, 3500);
  };

  const triggerStamp = () => {
    const msg = STAMP_MESSAGES[Math.floor(Math.random() * STAMP_MESSAGES.length)];
    setStampMessage(msg);
    setStampKey((k) => k + 1);
    setStampVisible(true);
    setShaking(true);
    setTimeout(() => setShaking(false), 450);
  };

  const collectSticker = (rewardId: string) => {
    setStickerAlbum((prev) => {
      const next = mergeStickerAlbums(prev, [rewardId]);
      saveStickerAlbum(next);
      return next;
    });
  };

  const handleTreatCollect = (rewardId: string) => {
    collectSticker(rewardId);
    setPendingTreat((treat) => {
      if (treat?.mode === "specialMission") {
        specialMissionCollectedRef.current = true;
        setSpecialMissionRewardClaimed((c) => ({ ...c, [currentTaskDay]: true }));
        setSpecialMissionTreatPending((p) => {
          if (!p[currentTaskDay]) return p;
          const next = { ...p };
          delete next[currentTaskDay];
          return next;
        });
      }
      if (treat?.mode === "oneOffSpecial" && treat.oneOffSpecialClaimKey) {
        oneOffSpecialCollectedRef.current = true;
        const key = treat.oneOffSpecialClaimKey;
        setOneOffSpecialClaimed((c) => ({ ...c, [key]: true }));
        setOneOffSpecialTreatPending((p) => {
          if (!p[key]) return p;
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
      if (treat?.mode === "daily" && treat.session) {
        dailyTreatCollectedRef.current = true;
        const key = sessionTreatKey(todayKey(), treat.session);
        setDailyTreatClaimed((c) => ({ ...c, [key]: true }));
        setDailyTreatPending((p) => {
          if (!p[key]) return p;
          const next = { ...p };
          delete next[key];
          return next;
        });
      }
      return treat;
    });
  };

  const openSessionDailyReward = (session: SessionId) => {
    dailyTreatCollectedRef.current = false;
    const key = sessionTreatKey(todayKey(), session);
    setDailyTreatClaimed((c) => {
      if (!c[key]) return c;
      const next = { ...c };
      delete next[key];
      return next;
    });
    setDailyTreatPending((p) => {
      if (!p[key]) return p;
      const next = { ...p };
      delete next[key];
      return next;
    });
    openTreatQueue([{ mode: "daily", session }]);
  };

  const hasUnclaimedSessionDailyReward = (session: SessionId) => {
    if (!sessionState[session].approved) return false;
    const key = sessionTreatKey(todayKey(), session);
    if (dailyTreatPending[key]) return true;
    return !isSessionTreatClaimed(dailyTreatClaimed, todayKey(), session);
  };

  const findOneOffSpecialPendingInfo = (claimKey: string): OneOffSpecialPending | null => {
    for (const sid of SESSION_IDS) {
      for (const t of sessionState[sid].tasks) {
        if (isOneOffSpecialTask(t) && oneOffSpecialClaimKey(t) === claimKey) {
          return {
            claimKey,
            taskId: t.id,
            session: sid,
            title: t.title,
            emoji: t.emoji,
            rewardFloor: t.specialRewardFloor ?? "rare",
          };
        }
      }
    }
    return null;
  };

  const openOneOffSpecialReward = (pending: OneOffSpecialPending) => {
    oneOffSpecialCollectedRef.current = false;
    setOneOffSpecialTreatPending((p) => {
      if (!p[pending.claimKey]) return p;
      const next = { ...p };
      delete next[pending.claimKey];
      return next;
    });
    openTreatQueue([{
      mode: "oneOffSpecial",
      missionTitle: `${pending.emoji} ${pending.title}`,
      oneOffSpecialClaimKey: pending.claimKey,
      rewardFloor: pending.rewardFloor,
    }]);
  };

  const openFirstPendingOneOffSpecialReward = () => {
    const claimKey = Object.keys(oneOffSpecialTreatPending).find((k) => oneOffSpecialTreatPending[k]);
    if (!claimKey) return;
    const info = findOneOffSpecialPendingInfo(claimKey);
    if (info) openOneOffSpecialReward(info);
  };

  const hasUnclaimedOneOffSpecialReward = () =>
    Object.keys(oneOffSpecialTreatPending).some((k) => oneOffSpecialTreatPending[k]);

  const openOneOffParentCheck = () => {
    if (!oneOffSpecialAwaitingParent) return;
    setScreen("show_parent_oneoff");
  };

  const fireOneOffSpecialCelebration = (session: SessionId, task: Task) => {
    setOneOffSpecialAwaitingParent({
      claimKey: oneOffSpecialClaimKey(task),
      taskId: task.id,
      session,
      title: task.title,
      emoji: task.emoji,
      rewardFloor: task.specialRewardFloor ?? "rare",
    });
    setOneOffSpecialStampApproved(false);
    setAnticipating(false);
    setStampVisible(false);
    setOneOffSpecialCompletedAt(fmtTime(new Date()));
    setCelebKey((k) => k + 1);
    setCelebType("burst");
    setTimeout(() => {
      setCelebType(null);
      const s = screenRef.current;
      if (isSessionScreen(s)) setPrevScreen(s);
      setScreen("show_parent_oneoff");
    }, 3000);
  };

  const handleOneOffSpecialApprove = () => {
    const pending = oneOffSpecialAwaitingParent;
    if (!pending || oneOffSpecialStampApproved) return;
    setOneOffSpecialStampApproved(true);
    triggerStamp();
    setTimeout(() => {
      setOneOffSpecialAwaitingParent(null);
      setOneOffSpecialStampApproved(false);
      setScreen(pending.session);
      openOneOffSpecialReward(pending);
    }, 950);
  };

  const resetOneOffSpecialApproval = () => {
    const pending = oneOffSpecialAwaitingParent;
    if (!pending) return;
    const { session, taskId } = pending;
    sessionState[session].setDone((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
    setOneOffSpecialAwaitingParent(null);
    setOneOffSpecialStampApproved(false);
    if (isSessionScreen(prevScreen)) {
      setScreen(prevScreen);
    } else {
      setScreen(getSessionScreen());
    }
  };

  const currentTaskDay = taskDayKey();
  const currentTodayKey = todayKey();
  const activeMissionSessions = getActiveMissionSessions();
  const missionRewardClaimedToday = !!specialMissionRewardClaimed[currentTaskDay];
  const activeMissionOverall = getMissionOverallStatus(
    todayMission,
    currentTaskDay,
    missionApprovedSessions,
    missionRewardClaimedToday,
  );

  const saveTodayMission = (
    partial: Omit<DailyMission, "dateKey">,
    addToFavorites: boolean,
  ) => {
    const mission: DailyMission = { ...partial, dateKey: currentTaskDay };
    setTodayMission(mission);
    setMissionDoneSessions([]);
    setMissionApprovedSessions([]);
    setMissionParentPhase(null);
    if (addToFavorites) {
      const fav: FavoriteMission = {
        id: `${Date.now()}-${partial.title}`,
        title: partial.title,
        emoji: partial.emoji,
        createdAt: new Date().toISOString(),
      };
      setFavoriteMissions((prev) => {
        const exists = prev.some((f) => f.title === fav.title && f.emoji === fav.emoji);
        if (exists) return prev;
        return [fav, ...prev].slice(0, 20);
      });
    }
    setShowMissionSetup(false);
  };

  const clearTodayMission = () => {
    setTodayMission(null);
    setMissionDoneSessions([]);
    setMissionApprovedSessions([]);
    setMissionParentPhase(null);
    setShowMissionSetup(false);
  };

  const fireMissionCelebration = (phase: SessionId) => {
    setMissionParentPhase(phase);
    setAnticipating(false);
    setStampVisible(false);
    setMissionCompletedAt(fmtTime(new Date()));
    setCelebKey((k) => k + 1);
    setCelebType("burst");
    setTimeout(() => {
      setCelebType(null);
      const s = screenRef.current;
      if (isSessionScreen(s)) setPrevScreen(s);
      setScreen("show_parent_mission");
    }, 3000);
  };

  const confirmMissionDone = () => {
    if (!missionConfirmSession) return;
    setShowMissionConfirm(false);
    const sid = missionConfirmSession;
    setMissionConfirmSession(null);
    const next = missionDoneSessions.includes(sid)
      ? missionDoneSessions
      : [...missionDoneSessions, sid];
    setMissionDoneSessions(next);
    fireMissionCelebration(sid);
  };

  const openMissionParentCheck = (phase: SessionId) => {
    if (!todayMission) return;
    if (!missionDoneSessions.includes(phase)) return;
    if (missionApprovedSessions.includes(phase)) return;
    setMissionParentPhase(phase);
    setMissionCompletedAt((prev) => prev || fmtTime(new Date()));
    const s = screenRef.current;
    if (isSessionScreen(s)) setPrevScreen(s);
    setScreen("show_parent_mission");
  };

  const openMissionReward = () => {
    if (!todayMission) return;
    if (!isAllMissionPhasesParentApproved(missionApprovedSessions)) return;
    specialMissionCollectedRef.current = false;
    setSpecialMissionTreatPending((p) => {
      if (!p[currentTaskDay]) return p;
      const next = { ...p };
      delete next[currentTaskDay];
      return next;
    });
    openTreatQueue([{
      mode: "specialMission",
      missionTitle: `${todayMission.emoji} ${todayMission.title}`,
      rewardFloor: todayMission.rewardFloor ?? "rare",
    }]);
  };

  const handleMissionApprove = () => {
    if (!todayMission || !missionParentPhase) return;
    if (missionApprovedSessions.includes(missionParentPhase)) return;
    if (!missionDoneSessions.includes(missionParentPhase)) return;
    const nextApproved = [...missionApprovedSessions, missionParentPhase];
    setMissionApprovedSessions(nextApproved);
    triggerStamp();
    if (isAllMissionPhasesParentApproved(nextApproved)) {
      setMissionHistory((h) => ({
        ...h,
        [currentTodayKey]: { title: todayMission.title, emoji: todayMission.emoji },
      }));
      setTimeout(() => openMissionReward(), 950);
    }
  };

  const undoMissionSession = (session: SessionId) => {
    setMissionDoneSessions((prev) => prev.filter((s) => s !== session));
    setMissionApprovedSessions((prev) => prev.filter((s) => s !== session));
    setSpecialMissionRewardClaimed((c) => {
      if (!c[currentTaskDay]) return c;
      const next = { ...c };
      delete next[currentTaskDay];
      return next;
    });
    setSpecialMissionTreatPending((p) => {
      if (!p[currentTaskDay]) return p;
      const next = { ...p };
      delete next[currentTaskDay];
      return next;
    });
  };

  const resetMissionApproval = () => {
    if (!missionParentPhase) return;
    setMissionApprovedSessions((prev) => prev.filter((s) => s !== missionParentPhase));
    setStampVisible(false);
  };

  useEffect(() => {
    if (!todayMission || activeMissionOverall !== "pending") return;
    if (isMissionBriefingSeen(currentTaskDay)) return;
    if (!isSessionScreen(screen)) return;
    setShowMissionBriefing(true);
  }, [todayMission, activeMissionOverall, currentTaskDay, screen]);

  useEffect(() => {
    if (screen !== "evening") return;
    if (activeMissionOverall !== "pending") return;
    if (missionEveningNudgeDate === currentTaskDay) return;
    setMissionEveningNudgeDate(currentTaskDay);
  }, [screen, activeMissionOverall, currentTaskDay, missionEveningNudgeDate]);

  const missionPhaseAwaitingParent = todayMission
    ? getFirstMissionPhaseAwaitingParent(missionDoneSessions, missionApprovedSessions)
    : null;

  const showEveningMissionNudge =
    screen === "evening"
    && activeMissionOverall === "pending"
    && missionEveningNudgeDate === currentTaskDay;

  const handleApprove = () => {
    if (approved) return;
    const today = todayKey();
    const prev = history[today] ?? emptyDayHistory();
    let updatedDay = { ...prev };
    sessionState[parentSession].setApproved(true);
    updatedDay = { ...updatedDay, [parentSession]: true };
    const newHistory = { ...history, [today]: updatedDay };
    setHistory(newHistory);
    triggerStamp();

    const needsDaily = !isSessionTreatClaimed(dailyTreatClaimed, today, parentSession);
    const fullDayBonusEligible = isFullDay(updatedDay, new Date()) && !fullDayBonusClaimed[today];
    const fullDayStreak = getFullDayStreak(newHistory);
    const weeklyMilestone = isFullDay(updatedDay, new Date())
      && fullDayStreak >= 7
      && fullDayStreak % 7 === 0
      && fullDayStreak > lastWeeklyRewardStreak;

    const treatQueueToOpen = buildTreatQueue({
      needsDaily,
      dailySession: parentSession,
      specialMissionEligible: false,
      fullDayBonusEligible,
      weeklyMilestone,
    });

    setTimeout(() => {
      if (treatQueueToOpen.length > 0) {
        openTreatQueue(treatQueueToOpen);
      }
      if (fullDayBonusEligible) {
        setFullDayBonusClaimed((c) => ({ ...c, [today]: true }));
      }
      if (weeklyMilestone) {
        setLastWeeklyRewardStreak(fullDayStreak);
      }
    }, 950);
  };

  const resetApproval = () => {
    sessionState[parentSession].setApproved(false);
    setStampVisible(false);
  };

  const goToTimer = () => {
    setPrevScreen(screen);
    if (!timerRunning) {
      setTimerSecondsLeft(timerDuration * 60);
      setTimerSessionTotal(timerDuration * 60);
    }
    setScreen("timer");
  };

  const startAndGoTimer = () => {
    setPrevScreen(screen);
    startTimer(timerDuration);
    setScreen("timer");
  };

  const goToScreen = (id: ScreenId) => {
    if (isWorkTimerLocked) return;
    if (id === "daytime" && !isDaytimeSessionDay()) {
      setScreen(getSessionScreen());
      return;
    }
    if (id === "timer") {
      goToTimer();
      return;
    }
    setScreen(id);
  };

  const navigateToScreen = (next: ScreenId) => {
    if (isWorkTimerLocked) return;
    setPrevScreen(screen);
    setScreen(next);
  };

  const goHome = () => {
    if (isSessionScreen(prevScreen)) {
      setScreen(prevScreen);
      return;
    }
    setScreen(getSessionScreen());
  };

  const removeTaskRow = (session: SessionId, id: number, task?: Task) => {
    const { tasks: base, setTasks, done: doneSet, setDone, skipped: skippedSet, setSkipped } = sessionState[session];
    setTasks(base.filter((t) => t.id !== id));
    const next = new Set(doneSet);
    next.delete(id);
    setDone(next);
    const nextSkipped = new Set(skippedSet);
    nextSkipped.delete(id);
    setSkipped(nextSkipped);
    const key = resolveTaskTimeKey(task ?? base.find((t) => t.id === id), session, id);
    setBestTimes((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
    if (activeWorkTask?.session === session && activeWorkTask.taskId === id) {
      resetWorkTimer();
      setActiveWorkTask(null);
    }
  };

  const addTask = (
    session: SessionId,
    title: string,
    emoji: string,
    scope: TaskScope,
    weekdays?: number[],
    targetSessions?: SessionId[],
    specialRewardFloor: SpecialRewardFloor = "rare",
  ) => {
    if (!title.trim()) return;
    const sessions = (targetSessions?.length ? targetSessions : [session]) as SessionId[];
    const normalizedWeekdays = scope === "regular"
      ? normalizeWeekdaysForSave(weekdays ?? ALL_WEEKDAYS)
      : undefined;

    if (sessions.length >= 2) {
      const sharedKey = generateSharedKey();
      const sharedSessions = [...new Set(sessions)].sort(
        (a, b) => SESSION_IDS.indexOf(a) - SESSION_IDS.indexOf(b),
      );
      let nextId = maxTaskIdAcross(morningTasks, daytimeTasks, homeTasks, eveningTasks);
      for (const sid of sharedSessions) {
        nextId += 1;
        const task = buildSharedTaskRow(
          nextId, title.trim(), emoji, scope, normalizedWeekdays, sharedKey, sharedSessions,
        );
        if (scope === "special") task.specialRewardFloor = specialRewardFloor;
        const { tasks: base, setTasks } = sessionState[sid];
        setTasks([...base, task]);
      }
      return;
    }

    const sid = sessions[0];
    const { tasks: base, setTasks } = sessionState[sid];
    const maxId = base.reduce((m, t) => Math.max(m, t.id), 0);
    const task: Task = { id: maxId + 1, title: title.trim(), emoji, scope };
    if (scope === "regular") task.weekdays = normalizedWeekdays;
    if (scope === "special") task.specialRewardFloor = specialRewardFloor;
    setTasks([...base, task]);
  };

  const updateTask = (
    session: SessionId,
    id: number,
    title: string,
    emoji: string,
    weekdays?: number[],
    targetSessions?: SessionId[],
    specialRewardFloor: SpecialRewardFloor = "rare",
  ) => {
    if (!title.trim()) return;
    const existing = sessionState[session].tasks.find((t) => t.id === id);
    if (!existing || isGameTask(existing)) return;

    const scope = existing.scope ?? "regular";
    const normalizedWeekdays = scope === "regular"
      ? normalizeWeekdaysForSave(weekdays ?? ALL_WEEKDAYS)
      : undefined;

    const desiredSessions = (targetSessions?.length
      ? targetSessions
      : existing.sharedKey
        ? collectSharedSessions(getAllSessionTasks(), existing.sharedKey)
        : [session]) as SessionId[];
    const sortedDesired = [...new Set(desiredSessions)].sort(
      (a, b) => SESSION_IDS.indexOf(a) - SESSION_IDS.indexOf(b),
    );

    if (sortedDesired.length >= 2) {
      const sharedKey = existing.sharedKey ?? generateSharedKey();
      const currentSessions = existing.sharedKey
        ? collectSharedSessions(getAllSessionTasks(), sharedKey)
        : [session];

      for (const sid of currentSessions) {
        if (!sortedDesired.includes(sid)) {
          const row = sessionState[sid].tasks.find((t) => t.sharedKey === sharedKey || t.id === id);
          if (row) removeTaskRow(sid, row.id, row);
        }
      }

      let nextId = maxTaskIdAcross(morningTasks, daytimeTasks, homeTasks, eveningTasks);
      for (const sid of sortedDesired) {
        const { tasks: base, setTasks } = sessionState[sid];
        const row = base.find((t) => t.sharedKey === sharedKey);
        if (row) {
          setTasks(base.map((t) => (t.sharedKey === sharedKey ? {
            ...t,
            title: title.trim(),
            emoji,
            scope,
            weekdays: normalizedWeekdays,
            specialRewardFloor: scope === "special" ? specialRewardFloor : undefined,
            sharedKey,
            sharedSessions: sortedDesired,
          } : t)));
        } else {
          nextId += 1;
          const created = buildSharedTaskRow(
            nextId, title.trim(), emoji, scope, normalizedWeekdays, sharedKey, sortedDesired,
          );
          if (scope === "special") created.specialRewardFloor = specialRewardFloor;
          setTasks([
            ...base,
            created,
          ]);
        }
      }
      return;
    }

    if (existing.sharedKey) {
      const sharedKey = existing.sharedKey;
      for (const sid of SESSION_IDS) {
        const row = sessionState[sid].tasks.find((t) => t.sharedKey === sharedKey);
        if (row && sid !== session) removeTaskRow(sid, row.id, row);
      }
    }

    const { tasks: base, setTasks } = sessionState[session];
    setTasks(base.map((t) => {
      if (t.id !== id) return t;
      const updated: Task = { ...t, title: title.trim(), emoji };
      delete updated.sharedKey;
      delete updated.sharedSessions;
      if (scope === "regular") updated.weekdays = normalizedWeekdays;
      updated.specialRewardFloor = scope === "special" ? specialRewardFloor : undefined;
      return updated;
    }));
  };

  const clearBestTime = (session: SessionId, taskId: number) => {
    const task = sessionState[session].tasks.find((t) => t.id === taskId);
    const key = resolveTaskTimeKey(task, session, taskId);
    setBestTimes((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const deleteTask = (session: SessionId, id: number) => {
    const task = sessionState[session].tasks.find((t) => t.id === id);
    if (!task || isGameTask(task)) return;

    const clearOneOffState = (t: Task) => {
      if (!isOneOffSpecialTask(t)) return;
      const claimKey = oneOffSpecialClaimKey(t);
      setOneOffSpecialTreatPending((p) => {
        if (!p[claimKey]) return p;
        const next = { ...p };
        delete next[claimKey];
        return next;
      });
      setOneOffSpecialClaimed((c) => {
        if (!c[claimKey]) return c;
        const next = { ...c };
        delete next[claimKey];
        return next;
      });
      setOneOffSpecialAwaitingParent((p) => (p?.claimKey === claimKey ? null : p));
    };

    if (task.sharedKey) {
      for (const sid of SESSION_IDS) {
        const row = sessionState[sid].tasks.find((t) => t.sharedKey === task.sharedKey);
        if (row) {
          clearOneOffState(row);
          removeTaskRow(sid, row.id, row);
        }
      }
      return;
    }

    clearOneOffState(task);
    removeTaskRow(session, id, task);
  };

  const skipTask = (
    session: SessionId,
    id: number,
    _tasks: Task[],
    done: Set<number>,
    skipped: Set<number>,
    setDone: (s: Set<number>) => void,
    setSkipped: (s: Set<number>) => void,
    label: string,
  ) => {
    if (celebType || anticipating) return;

    if (skipped.has(id)) {
      const nextSkipped = new Set(skipped);
      nextSkipped.delete(id);
      setSkipped(nextSkipped);
      return;
    }

    const nextSkipped = new Set(skipped);
    nextSkipped.add(id);
    setSkipped(nextSkipped);

    let nextDone = done;
    if (done.has(id)) {
      nextDone = new Set(done);
      nextDone.delete(id);
      setDone(nextDone);
    }

    if (activeWorkTask?.session === session && activeWorkTask.taskId === id) {
      cancelWorkTask();
    }

    maybeCelebrate(session, nextDone, nextSkipped, label);
  };

  const dayLabel = getDayLabel();

  return (
    <div style={{ width: "100%", minHeight: "100dvh", backgroundColor: theme.bg.editor, position: "relative", overflow: "hidden" }}>
      <AnimStyles />

      {anticipating && <AnticipationOverlay />}
      {celebType && <CelebrationOverlay key={celebKey} type={celebType} celebKey={celebKey} />}
      {newRecordCelebration && (
        <NewRecordOverlay
          key={newRecordCelebKey}
          data={newRecordCelebration}
          celebKey={newRecordCelebKey}
          onDone={() => setNewRecordCelebration(null)}
        />
      )}
      {pendingTreat && (
        <TreatOverlay
          key={`${pendingTreat.mode}-${pendingTreat.devForceTier ?? ""}-${pendingTreat.devForceStickerId ?? ""}-${pendingTreat.devForceTeaseId ?? ""}-${pendingTreat.devForceLegendaryMode ?? ""}-${pendingTreat.devForceSrUrMode ?? ""}-${treatQueue.length}`}
          mode={pendingTreat.mode}
          devForceTier={pendingTreat.devForceTier}
          devForceStickerId={pendingTreat.devForceStickerId}
          devForceTease={pendingTreat.devForceTease}
          devForceTeaseId={pendingTreat.devForceTeaseId}
          devForceLegendaryMode={pendingTreat.devForceLegendaryMode}
          devForceSrUrMode={pendingTreat.devForceSrUrMode}
          rewardFloor={pendingTreat.rewardFloor}
          missionTitle={pendingTreat.missionTitle}
          collectedIds={stickerAlbum}
          onClose={closeTreatOverlay}
          onCollect={handleTreatCollect}
        />
      )}

      {showMissionConfirm && todayMission && missionConfirmSession && (
        <MissionConfirmDialog
          mission={todayMission}
          sessionLabel={SESSION_SHORT_LABELS[missionConfirmSession]}
          onConfirm={confirmMissionDone}
          onCancel={() => {
            setShowMissionConfirm(false);
            setMissionConfirmSession(null);
          }}
        />
      )}

      {showMissionBriefing && todayMission && (
        <MissionBriefingOverlay
          mission={todayMission}
          onDismiss={() => {
            markMissionBriefingSeen(currentTaskDay);
            setShowMissionBriefing(false);
          }}
        />
      )}

      {showMissionSetup && (
        <MissionSetupSheet
          favorites={favoriteMissions}
          currentMission={todayMission}
          customTaskEmojis={customTaskEmojis}
          onSave={saveTodayMission}
          onClear={clearTodayMission}
          onClose={() => setShowMissionSetup(false)}
        />
      )}
      {stampVisible && screen === "show_parent" && (
        <HanamaruStamp key={stampKey} message={stampMessage} />
      )}

      {/* ── ハンバーガーボタン */}
      <button
        type="button"
        aria-label="メニューを開く"
        onClick={() => { if (!isWorkTimerLocked) setShowMenu(true); }}
        disabled={isWorkTimerLocked}
        style={{
          position: "fixed",
          right: 16,
          bottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          zIndex: 80, width: 48, height: 48, borderRadius: 14,
          backgroundColor: theme.fill.secondary, border: `1px solid ${theme.stroke.secondary}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          cursor: isWorkTimerLocked ? "default" : "pointer",
          opacity: isWorkTimerLocked ? 0.35 : 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 5,
        }}
      >
        {[0,1,2].map((i) => (
          <span key={i} style={{ display: "block", width: 18, height: 2, borderRadius: 2, backgroundColor: theme.text.secondary }} />
        ))}
      </button>

      {/* ── ハンバーガーメニュー オーバーレイ */}
      {showMenu && (
        <div
          data-modal-overlay
          onClick={() => setShowMenu(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", top: 0, right: 0, bottom: 0,
              width: "72%", maxWidth: 280,
              backgroundColor: theme.bg.editor,
              boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
              display: "flex", flexDirection: "column",
              paddingTop: "max(env(safe-area-inset-top, 20px), 20px)",
              paddingBottom: "max(env(safe-area-inset-bottom, 20px), 20px)",
              gap: 0, minHeight: 0,
            }}
          >
            {/* メニューヘッダー */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px 12px", flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: theme.text.primary }}>メニュー</span>
              <button onClick={() => setShowMenu(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: theme.text.tertiary, fontSize: 22, lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>
            {/* メニュー項目（スクロール） */}
            <div style={{
              flex: 1, minHeight: 0, overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}>
            {[
              ...activeSessionIds.map((sid) => ({
                icon: SESSION_META[sid].menuIcon,
                label: SESSION_META[sid].menuLabel,
                action: () => { setScreen(sid); setShowMenu(false); },
              })),
              { icon: "📋", label: "タスク一覧", action: () => { setTaskListSession(getSessionScreen()); navigateToScreen("task_list"); setShowMenu(false); } },
              { icon: "✅", label: "親チェック画面", action: () => { navigateToScreen("show_parent"); setShowMenu(false); } },
              ...(missionPhaseAwaitingParent ? [{
                icon: "⭐",
                label: "ミッション親チェック",
                action: () => { openMissionParentCheck(missionPhaseAwaitingParent); setShowMenu(false); },
              }] : []),
              { icon: "⏱", label: "タイマー",
                action: () => {
                  if (approved) {
                    if (timerRunning) navigateToScreen(gameTimerOvertime ? "timer_end" : "timer");
                    else goToTimer();
                  } else {
                    navigateToScreen("show_parent");
                  }
                  setShowMenu(false);
                },
              },
              { icon: "🔔", label: "アラーム設定", action: () => { navigateToScreen("alarm_settings"); setShowMenu(false); } },
              { icon: "📅", label: "連続記録", action: () => { navigateToScreen("record"); setShowMenu(false); } },
              ...(import.meta.env.DEV ? [
                { icon: "⛏️", label: "MCシールプレビュー（全16枚）", action: () => {
                  openTreatQueue(getStickersByCategory("minecraft").map((s) => ({
                    mode: "daily" as const,
                    devForceStickerId: s.id,
                  })));
                  setShowMenu(false);
                } },
                { icon: "👑", label: "最強王図鑑プレビュー（全8枚）", action: () => {
                  openTreatQueue(getStickersByCategory("saikyoou").map((s) => ({
                    mode: "daily" as const,
                    devForceStickerId: s.id,
                  })));
                  setShowMenu(false);
                } },
                { icon: "⚡", label: "ポケモンプレビュー", action: () => {
                  openTreatQueue(getStickersByCategory("pokemon").map((s) => ({
                    mode: "daily" as const,
                    devForceStickerId: s.id,
                  })));
                  setShowMenu(false);
                } },
                { icon: "🎁", label: "通常ごほうびテスト", action: () => { openTreatQueue([{ mode: "daily" }]); setShowMenu(false); } },
                { icon: "🌟", label: "1日ボーナステスト", action: () => {
                  openTreatQueue([{ mode: "fullDayBonus" }]);
                  setShowMenu(false);
                } },
                { icon: "⭐", label: "ミッションごほうびテスト", action: () => {
                  openTreatQueue([{ mode: "specialMission", missionTitle: "📚 テストミッション" }]);
                  setShowMenu(false);
                } },
                { icon: "🎊", label: "週間ごほうびテスト", action: () => { openTreatQueue([{ mode: "weekly" }]); setShowMenu(false); } },
                { icon: "💙", label: "レア抽選テスト", action: () => { openTreatQueue([{ mode: "daily", devForceTier: "rare" }]); setShowMenu(false); } },
                { icon: "💜", label: "SR抽選テスト", action: () => { openTreatQueue([{ mode: "daily", devForceTier: "superRare" }]); setShowMenu(false); } },
                { icon: "🧡", label: "UR抽選テスト", action: () => { openTreatQueue([{ mode: "daily", devForceTier: "ultraRare" }]); setShowMenu(false); } },
                { icon: "👑", label: "LR抽選テスト", action: () => { openTreatQueue([{ mode: "daily", devForceTier: "legendary" }]); setShowMenu(false); } },
                { icon: "🌈", label: "LR: パターンA（二段Cutin）", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "legendary", devForceLegendaryMode: "cutin" }]);
                  setShowMenu(false);
                } },
                { icon: "💥", label: "LR: パターンC（直Reveal）", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "legendary", devForceLegendaryMode: "direct" }]);
                  setShowMenu(false);
                } },
                { icon: "🎬", label: "LR: 本番再現（50% A/C）", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "legendary" }]);
                  setShowMenu(false);
                } },
                { icon: "🌈", label: "LR演出: 虹の光柱", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "legendary", devForceTease: true, devForceTeaseId: "lr-rainbow-pillar" }]);
                  setShowMenu(false);
                } },
                { icon: "👑", label: "LR演出: プリズム王冠", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "legendary", devForceTease: true, devForceTeaseId: "lr-prism-crown" }]);
                  setShowMenu(false);
                } },
                { icon: "☄️", label: "LR演出: 星の雨", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "legendary", devForceTease: true, devForceTeaseId: "lr-starfall" }]);
                  setShowMenu(false);
                } },
                { icon: "🔥", label: "LR: 煉獄さんGIF", action: () => {
                  openTreatQueue([{ mode: "daily", devForceStickerId: "lr-rengoku", devForceLegendaryMode: "direct" }]);
                  setShowMenu(false);
                } },
                { icon: "⚔️", label: "LR: たんじろうGIF", action: () => {
                  openTreatQueue([{ mode: "daily", devForceStickerId: "lr-tanjiro", devForceLegendaryMode: "direct" }]);
                  setShowMenu(false);
                } },
                { icon: "⚡", label: "LR: ぜんいつGIF", action: () => {
                  openTreatQueue([{ mode: "daily", devForceStickerId: "lr-zenitu", devForceLegendaryMode: "direct" }]);
                  setShowMenu(false);
                } },
                { icon: "🐸", label: "LR: ゲッコウガGIF", action: () => {
                  openTreatQueue([{ mode: "daily", devForceStickerId: "lr-gekkouga", devForceLegendaryMode: "direct" }]);
                  setShowMenu(false);
                } },
                { icon: "🐉", label: "UR: エンダードラゴンGIF", action: () => {
                  openTreatQueue([{ mode: "daily", devForceStickerId: "ur-enderdragon" }]);
                  setShowMenu(false);
                } },
                { icon: "✨", label: "期待演出SR（強制・ランダム）", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "superRare", devForceTease: true }]);
                  setShowMenu(false);
                } },
                { icon: "🔥", label: "期待演出UR（強制・ランダム）", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceTease: true }]);
                  setShowMenu(false);
                } },
                { icon: "🌀", label: "SR演出: 魔法陣", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "superRare", devForceTease: true, devForceTeaseId: "sr-orbit" }]);
                  setShowMenu(false);
                } },
                { icon: "🌠", label: "SR演出: 星の雨", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "superRare", devForceTease: true, devForceTeaseId: "sr-ripple" }]);
                  setShowMenu(false);
                } },
                { icon: "🌫", label: "SR演出: ミスト", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "superRare", devForceTease: true, devForceTeaseId: "sr-glimmer" }]);
                  setShowMenu(false);
                } },
                { icon: "⚡", label: "UR演出: 光柱Max", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceTease: true, devForceTeaseId: "ur-pillar" }]);
                  setShowMenu(false);
                } },
                { icon: "☄️", label: "UR演出: 流星衝突", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceTease: true, devForceTeaseId: "ur-meteor" }]);
                  setShowMenu(false);
                } },
                { icon: "🌀", label: "UR演出: オーロラゲート", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceTease: true, devForceTeaseId: "ur-aurora" }]);
                  setShowMenu(false);
                } },
                { icon: "💥", label: "UR演出: 超新星Max", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceTease: true, devForceTeaseId: "ur-supernova" }]);
                  setShowMenu(false);
                } },
                { icon: "🎭", label: "SR: カットイン昇格", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "superRare", devForceSrUrMode: "cutin" }]);
                  setShowMenu(false);
                } },
                { icon: "🎭", label: "UR: カットイン昇格", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceSrUrMode: "cutin" }]);
                  setShowMenu(false);
                } },
                { icon: "✨", label: "SR: 期待演出→Reveal", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "superRare", devForceSrUrMode: "tease" }]);
                  setShowMenu(false);
                } },
                { icon: "🔥", label: "UR: 期待演出→Reveal", action: () => {
                  openTreatQueue([{ mode: "daily", devForceTier: "ultraRare", devForceSrUrMode: "tease" }]);
                  setShowMenu(false);
                } },
              ] : []),
            ].map(({ icon, label, action }) => (
              <button key={label} onClick={action} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "16px 20px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left", width: "100%",
                borderBottom: `1px solid ${theme.stroke.secondary}`,
              }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{ fontSize: 15, color: theme.text.primary, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {alarmRinging && alarmSoundBlocked && (
        <div
          data-modal-overlay
          onClick={() => void retryAlarmSound()}
          style={{
            position: "fixed", inset: 0, zIndex: 145,
            display: "flex", alignItems: "center", justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)", padding: 24,
          }}
        >
          <div style={{
            padding: "20px 24px", borderRadius: 16, backgroundColor: theme.bg.editor,
            textAlign: "center", fontSize: 16, fontWeight: 700, color: theme.text.primary,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}>
            👆 タップして<br />アラームの音を鳴らす
          </div>
        </div>
      )}

      {alarmRinging && (
        <div style={{
          position: "fixed", left: 16, right: 16, bottom: "max(env(safe-area-inset-bottom, 16px), 16px)",
          zIndex: 150, padding: 14, borderRadius: 14,
          backgroundColor: theme.category.orange,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column", gap: 10, alignItems: "center",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>🔔 タイマーが終わったよ！</div>
          {alarmSoundBlocked && (
            <div style={{ fontSize: 12, color: "#fff", opacity: 0.9 }}>音が鳴らないときは画面をタップ</div>
          )}
          <button
            type="button"
            onClick={stopAlarmNow}
            style={{
              width: "100%", padding: "12px 0", borderRadius: 10, border: "none",
              cursor: "pointer", backgroundColor: "#fff", color: theme.category.orange,
              fontSize: 16, fontWeight: 800,
            }}
          >
            アラームをとめる
          </button>
        </div>
      )}

      <AppScroll
        className={shaking ? "phone-shake" : ""}
        style={{
          padding: "max(env(safe-area-inset-top, 16px), 16px) 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          pointerEvents: (anticipating || !!celebType) ? "none" : "auto",
        }}
      >
        {isSessionScreen(screen) && activeSessionIds.includes(screen) && (
          <SessionPhaseSwipe
            session={screen}
            onSwitch={goToScreen}
            disabled={isWorkTimerLocked || anticipating || !!celebType}
          >
            <InAppTabs screen={screen} onSwitch={goToScreen} disabled={isWorkTimerLocked} />
            {activeSessionIds.map((sid) => screen === sid && (
              <TaskScreen
                key={sid}
                session={sid}
                interactionLocked={isWorkTimerLocked}
                label={SESSION_META[sid].label}
                timeLabel={`${dayLabel} ${SESSION_META[sid].timeSuffix}`}
                tasks={sessionState[sid].tasks}
                done={sessionState[sid].done}
                skipped={sessionState[sid].skipped}
                justChecked={justChecked}
                floatColor={floatColor}
                bestTimes={bestTimes}
                activeWorkTask={activeWorkTask}
                workTimerElapsed={workTimerElapsed}
                workTimerRunning={workTimerRunning}
                newRecordTaskId={newRecordTaskId}
                allSessionTasks={getAllSessionTasks()}
                onReorder={sessionState[sid].setTasks}
                onAddTask={(title, emoji, scope, weekdays, targetSessions, specialRewardFloor) => addTask(sid, title, emoji, scope, weekdays, targetSessions, specialRewardFloor)}
                onEditTask={(id, title, emoji, weekdays, targetSessions, specialRewardFloor) => updateTask(sid, id, title, emoji, weekdays, targetSessions, specialRewardFloor)}
                onDeleteTask={(id) => deleteTask(sid, id)}
                onSkipTask={(id) => skipTask(
                  sid, id,
                  sessionState[sid].tasks,
                  sessionState[sid].done,
                  sessionState[sid].skipped,
                  sessionState[sid].setDone,
                  sessionState[sid].setSkipped,
                  SESSION_META[sid].label,
                )}
                onSelectTask={(id) => selectWorkTask(
                  sid, id,
                  sessionState[sid].done,
                  sessionState[sid].skipped,
                  sessionState[sid].setDone,
                )}
                onStartTimer={startWorkTimer}
                onPauseTimer={pauseWorkTimer}
                onCancelTask={cancelWorkTask}
                onQuickCompleteTask={(id) => quickCompleteTask(
                  sid, id,
                  sessionState[sid].tasks,
                  sessionState[sid].done,
                  sessionState[sid].skipped,
                  sessionState[sid].setDone,
                  sessionState[sid].setSkipped,
                  SESSION_META[sid].label,
                )}
                onCompleteTask={() => completeWorkTask(
                  sid,
                  sessionState[sid].tasks,
                  sessionState[sid].done,
                  sessionState[sid].skipped,
                  sessionState[sid].setDone,
                  sessionState[sid].setSkipped,
                  SESSION_META[sid].label,
                )}
                onClearBestTime={(id) => clearBestTime(sid, id)}
                customTaskEmojis={customTaskEmojis}
                onAddCustomTaskEmoji={addCustomTaskEmoji}
                todayMission={todayMission}
                missionCardStatus={getMissionCardStatus(
                  todayMission,
                  currentTaskDay,
                  missionDoneSessions,
                  missionApprovedSessions,
                  missionRewardClaimedToday,
                  sid,
                )}
                activeMissionSessions={activeMissionSessions}
                missionDoneSessions={missionDoneSessions}
                missionApprovedSessions={missionApprovedSessions}
                showEveningMissionNudge={showEveningMissionNudge}
                onMissionDone={() => {
                  setMissionConfirmSession(sid);
                  setShowMissionConfirm(true);
                }}
                onMissionUndo={() => undoMissionSession(sid)}
                onMissionSetup={() => setShowMissionSetup(true)}
                onOpenMissionReward={openMissionReward}
                onOpenMissionParentCheck={() => openMissionParentCheck(sid)}
                showDailyRewardButton={hasUnclaimedSessionDailyReward(sid)}
                onOpenDailyReward={() => openSessionDailyReward(sid)}
                showOneOffSpecialRewardButton={hasUnclaimedOneOffSpecialReward()}
                onOpenOneOffSpecialReward={openFirstPendingOneOffSpecialReward}
                showOneOffParentCheckButton={oneOffSpecialAwaitingParent !== null}
                onOpenOneOffParentCheck={openOneOffParentCheck}
                gamePlaySec={gamePlayTimes[gamePlayKey(todayKey(), sid)]}
              />
            ))}
          </SessionPhaseSwipe>
        )}

        {screen === "show_parent_mission" && todayMission && missionParentPhase && (
          <ShowParentMissionScreen
            mission={todayMission}
            phaseSession={missionParentPhase}
            phaseLabel={SESSION_META[missionParentPhase].label}
            completedAt={missionCompletedAt}
            phaseApproved={missionApprovedSessions.includes(missionParentPhase)}
            activeSessions={activeMissionSessions}
            doneSessions={missionDoneSessions}
            approvedSessions={missionApprovedSessions}
            onApprove={handleMissionApprove}
            onReset={resetMissionApproval}
            onHome={goHome}
          />
        )}

        {screen === "show_parent_oneoff" && oneOffSpecialAwaitingParent && (
          <ShowParentOneOffScreen
            emoji={oneOffSpecialAwaitingParent.emoji}
            title={oneOffSpecialAwaitingParent.title}
            phaseLabel={SESSION_META[oneOffSpecialAwaitingParent.session].label}
            completedAt={oneOffSpecialCompletedAt}
            approved={oneOffSpecialStampApproved}
            onApprove={handleOneOffSpecialApprove}
            onReset={resetOneOffSpecialApproval}
            onHome={goHome}
          />
        )}

        {screen === "show_parent" && (
          <ShowParentScreen
            context={parentCtx}
            approved={approved}
            timerDuration={timerDuration}
            onSetDuration={setTimerDuration}
            onApprove={handleApprove}
            onReset={resetApproval}
            onGoTimer={startAndGoTimer}
            onHome={goHome}
          />
        )}

        {screen === "timer" && (
          <TimerScreen
            secondsLeft={timerSecondsLeft}
            totalSeconds={timerSessionTotal}
            elapsedSec={gameTimerElapsedSec}
            overtime={gameTimerOvertime}
            paused={timerPaused}
            timerRunning={timerRunning}
            timerDuration={timerDuration}
            onSetDuration={setTimerDurationOnly}
            onStart={() => startTimer(timerDuration)}
            onPause={pauseTimer}
            onResume={resumeTimer}
            onCancel={cancelTimer}
            onFinish={finishGameSession}
            onBack={() => setScreen(prevScreen)}
            onHome={goHome}
          />
        )}

        {screen === "timer_end" && (
          <TimerEndScreen
            streak={streak}
            elapsedSec={gameTimerElapsedSec}
            plannedSec={timerSessionTotal}
            paused={timerPaused}
            alarmRinging={alarmRinging}
            onPause={pauseTimer}
            onResume={resumeTimer}
            onStopAlarm={stopAlarmNow}
            onFinish={finishGameSession}
            onBack={() => setScreen("timer")}
            onHome={goHome}
          />
        )}

        {screen === "record" && (
          <RecordScreen history={history} streak={streak} stickerAlbum={stickerAlbum} onBack={goHome} />
        )}

        {screen === "task_list" && (
          <TaskListScreen
            session={taskListSession}
            morningTasks={morningTasks}
            daytimeTasks={daytimeTasks}
            homeTasks={homeTasks}
            eveningTasks={eveningTasks}
            onSwitchSession={setTaskListSession}
            onBack={goHome}
            onAddTask={(title, emoji, scope, weekdays, targetSessions, specialRewardFloor) => addTask(taskListSession, title, emoji, scope, weekdays, targetSessions, specialRewardFloor)}
            onEditTask={(sess, id, title, emoji, weekdays, targetSessions, specialRewardFloor) => updateTask(sess, id, title, emoji, weekdays, targetSessions, specialRewardFloor)}
            onDeleteTask={(sess, id) => deleteTask(sess, id)}
            customTaskEmojis={customTaskEmojis}
            onAddCustomTaskEmoji={addCustomTaskEmoji}
            todayMission={todayMission}
            onOpenMissionSetup={() => setShowMissionSetup(true)}
            onClearMission={clearTodayMission}
          />
        )}

        {screen === "alarm_settings" && (
          <AlarmSettingsScreen
            settings={alarmSettings}
            onChange={updateAlarmSettings}
            onTest={testAlarm}
            onBack={goHome}
          />
        )}
      </AppScroll>
    </div>
  );
}

// ── Anticipation Overlay ──────────────────────────────

function AnticipationOverlay() {
  const colors = [
    theme.category.yellow, theme.category.orange, theme.category.pink,
    theme.category.purple, theme.category.blue,   theme.category.green,
  ];
  const corners = [
    { bx: -145, by: -270 }, { bx: 145, by: -270 },
    { bx: -145, by:  270 }, { bx: 145, by:  270 },
  ];
  const scatter = [{ dx: -18, dy: -10 }, { dx: 0, dy: 0 }, { dx: 18, dy: 10 }];
  const particles = corners.flatMap((c, ci) =>
    scatter.map((s, si) => ({
      sx: c.bx + s.dx, sy: c.by + s.dy,
      delay: ci * 0.05 + si * 0.07,
      color: colors[(ci * 3 + si) % 6],
      size:  8 + si * 4,
    }))
  );
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 45, pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {particles.map((p, i) => (
        <div key={i} className="sparkle-in" style={{
          position: "absolute",
          width: p.size, height: p.size, borderRadius: "50%",
          backgroundColor: p.color,
          animationDelay: `${p.delay}s`,
          "--sx": `${p.sx}px`, "--sy": `${p.sy}px`,
        } as CSSProperties} />
      ))}
    </div>
  );
}

// ── Celebration Overlay ───────────────────────────────

interface CelebProps { type: CelebType; celebKey: number; }

function CelebrationOverlay({ type, celebKey }: CelebProps) {
  const colors = [
    theme.category.purple, theme.category.blue,   theme.category.green,
    theme.category.yellow, theme.category.orange, theme.category.pink,
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 40, pointerEvents: "none", overflow: "hidden",
    }}>
      {type === "confetti"  && <ConfettiEffect  colors={colors} celebKey={celebKey} />}
      {type === "burst"     && <BurstEffect     colors={colors} />}
      {type === "stripes"   && <StripesEffect   colors={colors} />}
      {type === "bars"      && <BarsEffect      colors={colors} />}
      {type === "diagonal"  && <DiagonalEffect  colors={colors} celebKey={celebKey} />}
      <div style={{
        position: "absolute", bottom: 80, left: 0, right: 0,
        display: "flex", justifyContent: "center",
        animationName: "celebLabel", animationDuration: "3s",
        animationFillMode: "both", animationTimingFunction: "ease-out",
      }}>
        <span style={{
          fontSize: 22, fontWeight: 900,
          color: colors[(celebKey * 3) % 6], letterSpacing: 1,
          padding: "6px 18px", borderRadius: 100,
          backgroundColor: theme.bg.editor,
          border: `2px solid ${colors[(celebKey * 3) % 6]}66`,
        }}>
          {CELEB_NAMES[type]}
        </span>
      </div>
    </div>
  );
}

function ConfettiEffect({ colors, celebKey }: { colors: string[]; celebKey: number }) {
  const pieces = [...Array(30)].map((_, i) => {
    const s = i * 13 + celebKey * 7;
    return {
      x: (s * 31) % (window.innerWidth - 20) + 10,
      delay: (i * 0.055) % 0.6,
      colorIdx: (i + celebKey * 3) % 6,
      size: (s % 8) + 7,
      isCircle: s % 3 === 0,
      spin: ((s % 5) + 2) * 180,
      dur: 1.6 + (s % 5) * 0.1,
    };
  });
  return (
    <>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: -16,
          width: p.size, height: p.isCircle ? p.size : p.size * 0.55,
          borderRadius: p.isCircle ? "50%" : 2,
          backgroundColor: colors[p.colorIdx],
          animationName: "confettiPiece",
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          animationFillMode: "both", animationTimingFunction: "linear",
          "--spin": `${p.spin}deg`,
        } as CSSProperties} />
      ))}
    </>
  );
}

function BurstEffect({ colors }: { colors: string[] }) {
  const mainAngles  = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  const innerAngles = [15, 75, 135, 195, 255, 315];
  return (
    <div style={{ position: "absolute", left: "50%", top: "44%" }}>
      {mainAngles.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const d   = 130 + (i % 3) * 20;
        const sz  = 26 + (i % 3) * 8;
        return (
          <div key={`m${i}`} style={{
            position: "absolute", width: sz, height: sz, borderRadius: "50%",
            backgroundColor: colors[i % 6], left: -sz / 2, top: -sz / 2,
            animationName: "burstParticle", animationDuration: "1.1s",
            animationDelay: `${i * 0.035}s`, animationFillMode: "both",
            animationTimingFunction: "cubic-bezier(0.1, 0.6, 0.3, 1)",
            "--tx": `${Math.cos(rad) * d}px`, "--ty": `${Math.sin(rad) * d}px`,
          } as CSSProperties} />
        );
      })}
      {innerAngles.map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <div key={`s${i}`} style={{
            position: "absolute", width: 16, height: 16, borderRadius: "50%",
            backgroundColor: colors[(i + 2) % 6], left: -8, top: -8,
            animationName: "burstParticle", animationDuration: "0.88s",
            animationDelay: `${0.12 + i * 0.05}s`, animationFillMode: "both",
            animationTimingFunction: "ease-out",
            "--tx": `${Math.cos(rad) * 78}px`, "--ty": `${Math.sin(rad) * 78}px`,
          } as CSSProperties} />
        );
      })}
    </div>
  );
}

function StripesEffect({ colors }: { colors: string[] }) {
  const w = Math.floor(window.innerWidth / colors.length);
  return (
    <>
      {colors.map((color, i) => (
        <div key={i} style={{
          position: "absolute", top: 0, left: i * w,
          width: w + (i === colors.length - 1 ? 8 : 0), height: "100%",
          backgroundColor: color,
          animationName: "stripeDown", animationDuration: "2.4s",
          animationDelay: `${i * 0.075}s`, animationFillMode: "both",
          animationTimingFunction: "cubic-bezier(0.4,0,0.2,1)",
        }} />
      ))}
    </>
  );
}

function BarsEffect({ colors }: { colors: string[] }) {
  const BARS = 8;
  const barH = Math.floor(window.innerHeight / BARS);
  return (
    <>
      {[...Array(BARS)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", left: 0, top: i * barH,
          width: "100%", height: barH,
          backgroundColor: colors[i % 6],
          animationName: i % 2 === 0 ? "barFromLeft" : "barFromRight",
          animationDuration: "2.5s", animationDelay: `${i * 0.11}s`,
          animationFillMode: "both", animationTimingFunction: "cubic-bezier(0.4,0,0.2,1)",
        }} />
      ))}
    </>
  );
}

function DiagonalEffect({ colors, celebKey }: { colors: string[]; celebKey: number }) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const pieces = [...Array(22)].map((_, i) => {
    const s = i * 11 + celebKey * 5;
    const sx = (s * 19) % W; const sy = (s * 7) % 80 - 40;
    const size = (s % 10) + 9;
    return {
      x: sx, y: sy,
      dx: W - sx + (s % 60 - 30), dy: H + (s % 100),
      size, isCircle: s % 2 === 0,
      colorIdx: (i + celebKey * 2) % 6,
      delay: (i * 0.06) % 0.55,
      dur: 1.3 + (s % 6) * 0.11,
    };
  });
  return (
    <>
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: p.x, top: p.y,
          width: p.size, height: p.size,
          borderRadius: p.isCircle ? "50%" : 3,
          backgroundColor: colors[p.colorIdx],
          animationName: "diagPiece",
          animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s`,
          animationFillMode: "both", animationTimingFunction: "ease-in",
          "--dx": `${p.dx}px`, "--dy": `${p.dy}px`,
        } as CSSProperties} />
      ))}
    </>
  );
}

// ── StepProgress ──────────────────────────────────────

function getEncouragement(done: number, total: number): string {
  if (done === 0)                        return "きょうもはじめよう！";
  if (done === 1)                        return "いいスタート！";
  if (done === Math.round(total / 2))    return "はんぶんきたよ！";
  if (done === total - 1)                return "あと1こ！もうすぐだよ！";
  if (done === total)                    return "ぜんぶ！";
  return `あと${total - done}こ！`;
}

function StepProgress({
  tasks, done, skipped, justChecked,
}: {
  tasks: Task[]; done: Set<number>; skipped: Set<number>; justChecked: number | null;
}) {
  const total       = tasks.length;
  const doneCount   = tasks.filter((t) => isTaskResolved(done, skipped, t.id)).length;
  const allDone     = total > 0 && doneCount === total;
  const activeIdx   = tasks.findIndex((t) => !isTaskResolved(done, skipped, t.id));
  const circleSize = total <= 5 ? 36 : total <= 7 ? 28 : 22;
  const iconSize   = circleSize * 0.44;
  const lineW      = total <= 5 ? 22 : total <= 7 ? 14 : 8;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 28, fontWeight: 900, color: allDone ? theme.category.yellow : theme.text.primary, lineHeight: 1 }}>
            {doneCount}
          </span>
          <span style={{ fontSize: 16, color: theme.text.tertiary, marginLeft: 1 }}>/{total}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: allDone ? theme.category.yellow : doneCount > 0 ? theme.accent.primary : theme.text.tertiary }}>
          {getEncouragement(doneCount, total)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        {tasks.map((task, idx) => {
          const isDone    = done.has(task.id);
          const isSkipped = skipped.has(task.id);
          const isResolved = isDone || isSkipped;
          const isActive  = idx === activeIdx;
          const isJust    = justChecked === task.id;
          const isFuture  = !isResolved && !isActive;
          const prevDone  = idx > 0 && isTaskResolved(done, skipped, tasks[idx - 1].id);
          return (
            <div key={task.id} style={{ display: "flex", alignItems: "center" }}>
              {idx > 0 && (
                <div style={{
                  width: lineW, height: 3, borderRadius: 2, flexShrink: 0,
                  backgroundColor: isResolved || (isActive && prevDone) ? theme.category.green : theme.fill.secondary,
                }} />
              )}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  className={isJust ? "step-just" : isActive ? "step-active" : ""}
                  style={{
                    width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                    backgroundColor: isDone ? theme.category.green : isSkipped ? theme.category.orange : isActive ? theme.accent.primary : "transparent",
                    border: isFuture ? `2px solid ${theme.stroke.secondary}` : isActive ? `2px solid ${theme.accent.primary}` : isSkipped ? `2px solid ${theme.category.orange}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", zIndex: 1,
                  }}
                >
                  {isDone ? (
                    <svg width={iconSize} height={iconSize * 0.82} viewBox="0 0 12 10" fill="none">
                      <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : isSkipped ? (
                    <span style={{ fontSize: circleSize * 0.34, fontWeight: 900, color: "#fff" }}>－</span>
                  ) : (
                    <span style={{ fontSize: circleSize * 0.38, fontWeight: 800, color: isActive ? theme.text.onAccent : theme.text.tertiary }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
                {isJust && (
                  <div className="ring-out" style={{
                    position: "absolute", top: 0, left: 0,
                    width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                    border: `3px solid ${theme.category.green}`, pointerEvents: "none", zIndex: 2,
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BestTimeSummary({
  session, tasks, bestTimes,
}: {
  session: SessionId;
  tasks: Task[];
  bestTimes: Record<string, number>;
}) {
  const { totalSec, recorded } = sumSessionBestTimes(session, tasks, bestTimes);
  if (recorded === 0) return null;

  return (
    <div style={{
      marginTop: 4, padding: "10px 14px", borderRadius: 12,
      backgroundColor: `${theme.category.orange}12`,
      border: `1.5px solid ${theme.category.orange}33`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary }}>
        全部終わるまでの時間
      </div>
      <div style={{
        fontSize: 22, fontWeight: 900, color: theme.category.orange,
        fontVariantNumeric: "tabular-nums", lineHeight: 1, flexShrink: 0,
      }}>
        🏆 {fmtTaskTime(totalSec)}
      </div>
    </div>
  );
}

// ── InApp Tabs ────────────────────────────────────────

function BackLink({ onBack }: { onBack: () => void }) {
  return <ScrollSafeBackButton onBack={onBack} />;
}

function SessionTabs({ session, onSwitch }: { session: SessionId; onSwitch: (s: SessionId) => void }) {
  const tabs = getVisibleSessionTabs();
  return (
    <div style={{ display: "flex", gap: 4, padding: "2px 0 4px" }}>
      {tabs.map((t) => {
        const active = session === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onSwitch(t.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: active ? 800 : 600, fontSize: 11,
            color: active ? "#fff" : theme.text.secondary,
            background: active ? theme.accent.primary : `${theme.accent.primary}18`,
            transition: "all 0.2s",
          }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function WeekdayFilterBar({
  selected, onChange,
}: {
  selected: number | null;
  onChange: (dow: number | null) => void;
}) {
  const todayDow = new Date().getDay();
  const chipStyle = (active: boolean, isToday: boolean): CSSProperties => ({
    flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
    fontSize: 12, fontWeight: 800, cursor: "pointer",
    backgroundColor: active ? theme.accent.primary : theme.fill.secondary,
    color: active ? "#fff" : theme.text.secondary,
    outline: isToday ? `2px solid ${theme.category.yellow}` : "none",
    outlineOffset: 1,
  });

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "stretch" }}>
      <button
        type="button"
        onClick={() => onChange(null)}
        style={{
          padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 12, fontWeight: 800, flexShrink: 0,
          backgroundColor: selected === null ? theme.accent.primary : theme.fill.secondary,
          color: selected === null ? "#fff" : theme.text.secondary,
        }}
      >
        すべて
      </button>
      {WEEKDAY_DISPLAY_ORDER.map((dow) => (
        <button
          key={dow}
          type="button"
          onClick={() => onChange(selected === dow ? null : dow)}
          style={chipStyle(selected === dow, dow === todayDow)}
        >
          {WEEKDAY_LABELS[dow]}
        </button>
      ))}
    </div>
  );
}

const LIST_SWIPE_DELETE_WIDTH = 72;
const LIST_GESTURE_SLOP = 10;

function TaskListSwipeRow({
  task,
  showRestBadge,
  filterDow,
  swipeOpen,
  onSwipeOpen,
  onSwipeClose,
  onSelect,
  onDelete,
}: {
  task: Task;
  showRestBadge: boolean;
  filterDow: number | null;
  swipeOpen: boolean;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<HTMLDivElement>(null);
  const gestureSurfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState>(emptyGesture());
  const suppressClickRef = useRef(false);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const snapOffset = swipeOpen ? -LIST_SWIPE_DELETE_WIDTH : 0;
  const displayX = dragging ? offsetX : snapOffset;
  const scheduleBadge = taskScheduleBadgeStyle(task);
  const visibleToday = isTaskVisibleToday(task);

  const clampOffset = (v: number) => Math.min(0, Math.max(-LIST_SWIPE_DELETE_WIDTH, v));

  const resetGesture = () => {
    gesture.current = emptyGesture();
    setDragging(false);
  };

  const releaseCapture = () => {
    const el = gestureSurfaceRef.current;
    const { pointerId, phase } = gesture.current;
    if (el && phase === "swiping" && pointerId >= 0) {
      try {
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const blockScroll = (e: TouchEvent) => {
      if (gesture.current.phase === "swiping") e.preventDefault();
    };
    el.addEventListener("touchmove", blockScroll, { passive: false });
    return () => el.removeEventListener("touchmove", blockScroll);
  }, []);

  const beginGesture = (clientX: number, clientY: number, pointerId: number) => {
    const startOffset = swipeOpen ? -LIST_SWIPE_DELETE_WIDTH : 0;
    gesture.current = {
      phase: "pending",
      startX: clientX,
      startY: clientY,
      startOffset,
      moved: false,
      lastOffset: startOffset,
      pointerId,
    };
  };

  const moveGesture = (clientX: number, clientY: number, target: HTMLElement) => {
    const g = gesture.current;
    if (g.phase === "idle") return;

    const dx = clientX - g.startX;
    const dy = clientY - g.startY;

    if (g.phase === "pending") {
      if (Math.abs(dx) > LIST_GESTURE_SLOP || Math.abs(dy) > LIST_GESTURE_SLOP) {
        if (Math.abs(dy) > LIST_GESTURE_SLOP && Math.abs(dy) >= Math.abs(dx)) {
          resetGesture();
          return;
        }
        if (Math.abs(dx) > LIST_GESTURE_SLOP && Math.abs(dx) > Math.abs(dy)) {
          g.phase = "swiping";
          try {
            target.setPointerCapture(g.pointerId);
          } catch { /* ignore */ }
          setDragging(true);
          setOffsetX(g.startOffset);
        }
      }
    }

    if (g.phase !== "swiping") return;

    if (Math.abs(dx) > LIST_GESTURE_SLOP) g.moved = true;
    g.lastOffset = clampOffset(g.startOffset + dx);
    setOffsetX(g.lastOffset);
  };

  const endGesture = () => {
    const g = gesture.current;
    if (g.phase === "swiping") {
      if (g.moved) suppressClickRef.current = true;
      if (g.lastOffset < -LIST_SWIPE_DELETE_WIDTH / 2) onSwipeOpen();
      else onSwipeClose();
    }
    releaseCapture();
    resetGesture();
  };

  const handleSelect = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (gesture.current.moved) {
      gesture.current.moved = false;
      return;
    }
    if (swipeOpen) {
      onSwipeClose();
      return;
    }
    onSelect();
  };

  return (
    <div
      ref={swipeRef}
      style={{ position: "relative", overflow: "hidden", borderRadius: 14, touchAction: "pan-y" }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="タスクを削除"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: LIST_SWIPE_DELETE_WIDTH,
          border: "none", cursor: "pointer",
          backgroundColor: theme.category.pink,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, padding: 0,
        }}
      >
        🗑️
      </button>
      <div
        ref={gestureSurfaceRef}
        style={{
          transform: `translateX(${displayX}px)`,
          transition: dragging ? "none" : "transform 0.22s ease-out",
          backgroundColor: theme.bg.editor,
          position: "relative", zIndex: 1,
          touchAction: "pan-y",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          beginGesture(e.clientX, e.clientY, e.pointerId);
        }}
        onPointerMove={(e) => moveGesture(e.clientX, e.clientY, e.currentTarget)}
        onPointerUp={() => endGesture()}
        onPointerCancel={() => endGesture()}
      >
        <button
          type="button"
          onClick={handleSelect}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 14px", borderRadius: 14, border: `1.5px solid ${theme.stroke.tertiary}`,
            backgroundColor: theme.fill.quaternary, cursor: "pointer",
            textAlign: "left", width: "100%", fontFamily: "inherit",
            opacity: showRestBadge ? 0.55 : 1,
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0 }}>{task.emoji}</span>
          <span style={{ fontSize: 15, fontWeight: 600, flex: 1, color: theme.text.primary }}>
            {task.title}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, flexShrink: 0,
            color: scheduleBadge.color,
            backgroundColor: scheduleBadge.backgroundColor,
            padding: "2px 6px", borderRadius: 6,
          }}>
            {scheduleBadge.label}
          </span>
          {(() => {
            const sharedBadge = taskSharedBadgeStyle(task);
            return sharedBadge ? (
              <span style={{
                fontSize: 10, fontWeight: 700, flexShrink: 0,
                color: sharedBadge.color,
                backgroundColor: sharedBadge.backgroundColor,
                padding: "2px 6px", borderRadius: 6,
              }}>
                {sharedBadge.label}
              </span>
            ) : null;
          })()}
          {filterDow === null && visibleToday && (
            <span style={{
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              color: theme.category.green,
              backgroundColor: `${theme.category.green}18`,
              padding: "2px 6px", borderRadius: 6,
            }}>
              きょう
            </span>
          )}
          {showRestBadge && (
            <span style={{
              fontSize: 10, fontWeight: 700, flexShrink: 0,
              color: theme.text.tertiary,
              backgroundColor: theme.fill.secondary,
              padding: "2px 6px", borderRadius: 6,
            }}>
              お休み
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function TaskListScreen({
  session, morningTasks, daytimeTasks, homeTasks, eveningTasks,
  onSwitchSession, onBack, onAddTask, onEditTask, onDeleteTask,
  customTaskEmojis, onAddCustomTaskEmoji,
  todayMission, onOpenMissionSetup, onClearMission,
}: {
  session: SessionId;
  morningTasks: Task[];
  daytimeTasks: Task[];
  homeTasks: Task[];
  eveningTasks: Task[];
  onSwitchSession: (s: SessionId) => void;
  onBack: () => void;
  onAddTask: (title: string, emoji: string, scope: TaskScope, weekdays?: number[], targetSessions?: SessionId[], specialRewardFloor?: SpecialRewardFloor) => void;
  onEditTask: (session: SessionId, id: number, title: string, emoji: string, weekdays?: number[], targetSessions?: SessionId[], specialRewardFloor?: SpecialRewardFloor) => void;
  onDeleteTask: (session: SessionId, id: number) => void;
  customTaskEmojis: string[];
  onAddCustomTaskEmoji: (emoji: string) => void;
  todayMission: DailyMission | null;
  onOpenMissionSetup: () => void;
  onClearMission: () => void;
}) {
  const [filterDow, setFilterDow] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<TaskScope>("regular");

  const tasksBySession: Record<SessionId, Task[]> = {
    morning: morningTasks,
    daytime: daytimeTasks,
    home: homeTasks,
    evening: eveningTasks,
  };
  const allTasks = tasksBySession[session];
  const filteredTasks = allTasks.filter((t) => taskMatchesWeekdayFilter(t, filterDow));
  const editingTask = editingTaskId !== null ? allTasks.find((t) => t.id === editingTaskId) : null;
  const todayVisibleCount = allTasks.filter((t) => isTaskVisibleToday(t)).length;

  const summaryText = filterDow === null
    ? `${allTasks.length}件登録 · きょう ${todayVisibleCount}件`
    : `${filteredTasks.length}件 · ${WEEKDAY_LABELS[filterDow]}曜のタスク`;

  const handleAdd = (
    title: string,
    emoji: string,
    weekdays?: number[],
    sharedSessions?: SessionId[],
    specialRewardFloor?: SpecialRewardFloor,
  ) => {
    onAddTask(title, emoji, addMode, weekdays, sharedSessions, specialRewardFloor);
    setIsAdding(false);
  };

  const confirmDeleteShared = (task: Task): boolean => {
    if (!task.sharedKey || !task.sharedSessions || task.sharedSessions.length < 2) return true;
    return window.confirm(
      `「${task.title}」をすべての時間帯（${sharedSessionsLabel(task.sharedSessions)}）から削除しますか？`,
    );
  };

  const startAdding = (mode: TaskScope) => {
    setAddMode(mode);
    setIsAdding(true);
  };

  const addHeaderLabel = addMode === "special"
    ? "単発特別ミッション"
    : addMode === "today"
      ? "きょうだけのタスク"
      : "レギュラータスク";

  const handleDeleteTask = (taskId: number) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (task && !confirmDeleteShared(task)) return;
    onDeleteTask(session, taskId);
    setOpenSwipeId(null);
    if (editingTaskId === taskId) setEditingTaskId(null);
  };

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: "80vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BackLink onBack={onBack} />
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>タスク一覧</div>
        </div>

        <div style={{
          padding: "14px 16px", borderRadius: 14,
          border: `1.5px solid ${theme.category.purple}44`,
          backgroundColor: `${theme.category.purple}08`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: theme.category.purple, marginBottom: 6 }}>
            きょうの特別ミッション
          </div>
          <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 10 }}>
            親と一緒に決めよう
          </div>
          {todayMission ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{todayMission.emoji}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: theme.text.primary }}>{todayMission.title}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: theme.text.secondary, marginBottom: 10 }}>
              まだ設定されていません
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onOpenMissionSetup} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: "none",
              backgroundColor: theme.category.purple, color: "#fff",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>
              {todayMission ? "変更する" : "設定する"}
            </button>
            {todayMission && (
              <button type="button" onClick={onClearMission} style={{
                padding: "10px 14px", borderRadius: 10,
                border: `1px solid ${theme.stroke.secondary}`,
                backgroundColor: "transparent", color: theme.text.tertiary,
                fontSize: 13, cursor: "pointer",
              }}>
                なし
              </button>
            )}
          </div>
        </div>

        <SessionTabs session={session} onSwitch={onSwitchSession} />
        <WeekdayFilterBar selected={filterDow} onChange={setFilterDow} />

        <div style={{ fontSize: 13, fontWeight: 600, color: theme.text.secondary }}>
          {summaryText}
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{
            padding: "32px 16px", textAlign: "center", borderRadius: 14,
            backgroundColor: theme.fill.quaternary, border: `1px solid ${theme.stroke.tertiary}`,
          }}>
            <div style={{ fontSize: 14, color: theme.text.secondary, marginBottom: 12 }}>
              {filterDow === null ? "タスクがありません" : `${WEEKDAY_LABELS[filterDow]}曜のタスクはありません`}
            </div>
            {filterDow !== null && (
              <button type="button" onClick={() => setFilterDow(null)} style={{
                padding: "8px 16px", borderRadius: 8, border: `1px solid ${theme.stroke.secondary}`,
                backgroundColor: theme.fill.secondary, fontSize: 13, fontWeight: 700,
                color: theme.text.secondary, cursor: "pointer",
              }}>
                すべて表示
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filteredTasks.map((task) => {
              const showRestBadge = filterDow === null && !isTaskVisibleToday(task);
              return (
                <TaskListSwipeRow
                  key={task.id}
                  task={task}
                  showRestBadge={showRestBadge}
                  filterDow={filterDow}
                  swipeOpen={openSwipeId === task.id}
                  onSwipeOpen={() => setOpenSwipeId(task.id)}
                  onSwipeClose={() => setOpenSwipeId(null)}
                  onSelect={() => setEditingTaskId(task.id)}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              );
            })}
          </div>
        )}

        {isAdding ? (
          <TaskEditForm
            key={`list-add-${addMode}`}
            header={addHeaderLabel}
            hint={addMode === "special" ? "クリアするとレア以上のシールがもらえるよ（親の確認が必要）" : undefined}
            initialTitle=""
            initialEmoji="🎯"
          isSpecialMission={addMode === "special"}
          initialSpecialRewardFloor="rare"
            saveLabel="追加する"
            showWeekdays={addMode === "regular"}
            currentSession={session}
            customTaskEmojis={customTaskEmojis}
            onAddCustomTaskEmoji={onAddCustomTaskEmoji}
            onSave={handleAdd}
            onCancel={() => setIsAdding(false)}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            <button type="button" onClick={() => startAdding("special")} style={{
              ...addBtnStyle,
              borderColor: `${theme.category.orange}66`,
              color: theme.category.orange,
              backgroundColor: `${theme.category.orange}10`,
            }}>
              <span style={{ fontSize: 18 }}>＋</span> 単発特別ミッション
            </button>
            <button type="button" onClick={() => startAdding("today")} style={addBtnStyle}>
              <span style={{ fontSize: 18 }}>＋</span> きょうだけのタスク
            </button>
            <button type="button" onClick={() => startAdding("regular")} style={{ ...addBtnStyle, borderColor: `${theme.accent.primary}55`, color: theme.text.secondary }}>
              <span style={{ fontSize: 18 }}>＋</span> レギュラータスク
            </button>
          </div>
        )}
      </div>

      {editingTask && (
        <div
          data-modal-overlay
          onClick={() => setEditingTaskId(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 110,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480,
              maxHeight: "92dvh", overflowY: "auto",
              backgroundColor: theme.bg.editor,
              borderRadius: "20px 20px 0 0",
              padding: "16px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <TaskEditForm
              key={`list-edit-${editingTask.id}`}
              header="タスクを編集"
              initialTitle={editingTask.title}
              initialEmoji={editingTask.emoji}
              isSpecialMission={(editingTask.scope ?? "regular") === "special"}
              initialSpecialRewardFloor={editingTask.specialRewardFloor ?? "rare"}
              initialWeekdays={editingTask.weekdays ?? ALL_WEEKDAYS}
              showWeekdays={(editingTask.scope ?? "regular") === "regular"}
              saveLabel="保存する"
              autoFocus={false}
              currentSession={session}
              initialSharedSessions={editingTask.sharedSessions}
              customTaskEmojis={customTaskEmojis}
              onAddCustomTaskEmoji={onAddCustomTaskEmoji}
              onSave={(title, emoji, weekdays, sharedSessions, specialRewardFloor) => {
                onEditTask(session, editingTask.id, title, emoji, weekdays, sharedSessions, specialRewardFloor);
                setEditingTaskId(null);
              }}
              onCancel={() => setEditingTaskId(null)}
              onDelete={() => handleDeleteTask(editingTask.id)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function SessionPhaseSwipe({
  session, onSwitch, disabled = false, children,
}: {
  session: SessionId;
  onSwitch: (id: ScreenId) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const gesture = useRef<{ startX: number; startY: number; tracking: boolean; decided: boolean }>({
    startX: 0, startY: 0, tracking: false, decided: false,
  });
  const PHASE_SWIPE_MIN = 72;
  const SLOP = 14;

  const isBlockedTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    return !!target.closest(
      "[data-task-swipe], [data-dnd-handle], [data-no-phase-swipe], button, input, textarea, select, [data-modal-overlay]",
    );
  };

  const reset = () => {
    gesture.current = { startX: 0, startY: 0, tracking: false, decided: false };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled || e.button !== 0 || isBlockedTarget(e.target)) return;
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      tracking: true,
      decided: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.tracking || g.decided) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
    if (Math.abs(dy) >= Math.abs(dx)) {
      reset();
      return;
    }
    g.decided = true;
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.tracking) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    reset();
    if (!g.decided) return;
    if (Math.abs(dx) < PHASE_SWIPE_MIN || Math.abs(dy) >= Math.abs(dx)) return;

    const next = dx < 0
      ? getAdjacentSession(session, "next")
      : getAdjacentSession(session, "prev");
    if (next) {
      navigator.vibrate?.(8);
      onSwitch(next);
    }
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 14, touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={reset}
    >
      {children}
    </div>
  );
}

function InAppTabs({
  screen, onSwitch, disabled = false,
}: {
  screen: ScreenId; onSwitch: (s: ScreenId) => void; disabled?: boolean;
}) {
  const tabs = getVisibleSessionTabs();
  return (
    <div style={{ display: "flex", gap: 4, padding: "2px 0 4px", opacity: disabled ? 0.45 : 1 }}>
      {tabs.map((t) => {
        const active = screen === t.id;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onSwitch(t.id)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: 10, border: "none",
              cursor: disabled ? "default" : "pointer",
              fontWeight: active ? 800 : 600, fontSize: 11,
              color: active ? "#fff" : theme.text.secondary,
              background: active ? theme.accent.primary : `${theme.accent.primary}18`,
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Task Edit / Action Sheet ──────────────────────────

function WeekdayPicker({
  selected, onChange,
}: {
  selected: number[];
  onChange: (days: number[]) => void;
}) {
  const todayDow = new Date().getDay();
  const presetBtn = (label: string, days: number[]) => (
    <button
      key={label}
      type="button"
      onClick={() => onChange(days)}
      style={{
        padding: "5px 10px", borderRadius: 8, border: `1px solid ${theme.stroke.secondary}`,
        backgroundColor: theme.fill.secondary, fontSize: 11, fontWeight: 700,
        color: theme.text.secondary, cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary }}>くりかえすようび</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {presetBtn("毎日", ALL_WEEKDAYS)}
        {presetBtn("平日", WEEKDAYS_WEEKDAY)}
        {presetBtn("土日", WEEKDAYS_WEEKEND)}
      </div>
      <div style={{ display: "flex", gap: 5, justifyContent: "space-between" }}>
        {WEEKDAY_DISPLAY_ORDER.map((dow) => {
          const on = selected.includes(dow);
          const isToday = dow === todayDow;
          return (
            <button
              key={dow}
              type="button"
              onClick={() => onChange(on ? selected.filter((d) => d !== dow) : [...selected, dow])}
              style={{
                flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                fontSize: 13, fontWeight: 800, cursor: "pointer",
                backgroundColor: on ? theme.accent.primary : theme.fill.secondary,
                color: on ? "#fff" : theme.text.secondary,
                outline: isToday ? `2px solid ${theme.category.yellow}` : "none",
                outlineOffset: 1,
              }}
            >
              {WEEKDAY_LABELS[dow]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionMultiPicker({
  selected, onChange,
}: {
  selected: SessionId[];
  onChange: (sessions: SessionId[]) => void;
}) {
  const toggle = (sid: SessionId) => {
    if (selected.includes(sid)) {
      if (selected.length <= 1) return;
      onChange(selected.filter((s) => s !== sid));
      return;
    }
    onChange([...selected, sid].sort((a, b) => SESSION_IDS.indexOf(a) - SESSION_IDS.indexOf(b)));
  };

  const chipStyle = (active: boolean): CSSProperties => ({
    flex: 1, padding: "10px 4px", borderRadius: 10, border: "none",
    fontSize: 12, fontWeight: 800, cursor: "pointer",
    backgroundColor: active ? theme.category.purple : theme.fill.secondary,
    color: active ? "#fff" : theme.text.secondary,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary }}>出す時間帯</div>
      <div style={{ fontSize: 11, color: theme.text.tertiary }}>
        2つ以上選ぶと共有タスク（1日1回）になります
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {SESSION_IDS.map((sid) => (
          <button key={sid} type="button" onClick={() => toggle(sid)} style={chipStyle(selected.includes(sid))}>
            {SESSION_SHORT_LABELS[sid]}
          </button>
        ))}
      </div>
      {selected.length >= 2 && (
        <div style={{ fontSize: 11, fontWeight: 700, color: theme.category.purple }}>
          共有: {sharedSessionsLabel(selected)}
        </div>
      )}
    </div>
  );
}

function TaskEditForm({
  header, hint, initialTitle, initialEmoji, saveLabel, onSave, onCancel, onDelete, autoFocus = true,
  showWeekdays = false, initialWeekdays,
  isSpecialMission = false, initialSpecialRewardFloor = "rare",
  currentSession, initialSharedSessions,
  customTaskEmojis, onAddCustomTaskEmoji,
}: {
  header?: string;
  hint?: string;
  initialTitle: string;
  initialEmoji: string;
  saveLabel: string;
  onSave: (
    title: string,
    emoji: string,
    weekdays?: number[],
    sharedSessions?: SessionId[],
    specialRewardFloor?: SpecialRewardFloor,
  ) => void;
  onCancel: () => void;
  onDelete?: () => void;
  autoFocus?: boolean;
  showWeekdays?: boolean;
  initialWeekdays?: number[];
  isSpecialMission?: boolean;
  initialSpecialRewardFloor?: SpecialRewardFloor;
  currentSession: SessionId;
  initialSharedSessions?: SessionId[];
  customTaskEmojis: string[];
  onAddCustomTaskEmoji: (emoji: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [weekdays, setWeekdays] = useState<number[]>(initialWeekdays ?? ALL_WEEKDAYS);
  const [sharedSessions, setSharedSessions] = useState<SessionId[]>(
    initialSharedSessions?.length ? initialSharedSessions : [currentSession],
  );
  const [weekdayError, setWeekdayError] = useState(false);
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const [customEmojiError, setCustomEmojiError] = useState(false);
  const [specialRewardFloor, setSpecialRewardFloor] = useState<SpecialRewardFloor>(initialSpecialRewardFloor);

  const savedCustomEmojis = customTaskEmojis.filter((e) => !QUICK_EMOJIS.includes(e));
  const showSavedCustom = savedCustomEmojis.length > 0 || (emoji && !QUICK_EMOJIS.includes(emoji) && !savedCustomEmojis.includes(emoji));
  const extraSelectedEmoji = emoji && !QUICK_EMOJIS.includes(emoji) && !savedCustomEmojis.includes(emoji) ? emoji : null;

  useEffect(() => {
    setTitle(initialTitle);
    setEmoji(initialEmoji);
    setWeekdays(initialWeekdays ?? ALL_WEEKDAYS);
    setSharedSessions(initialSharedSessions?.length ? initialSharedSessions : [currentSession]);
    setSpecialRewardFloor(initialSpecialRewardFloor);
    setWeekdayError(false);
    setCustomEmojiInput("");
    setCustomEmojiError(false);
  }, [initialTitle, initialEmoji, initialWeekdays, initialSharedSessions, currentSession, initialSpecialRewardFloor]);

  const handleAddCustomEmoji = () => {
    const picked = extractFirstEmoji(customEmojiInput);
    if (!picked) {
      setCustomEmojiError(true);
      return;
    }
    setCustomEmojiError(false);
    setEmoji(picked);
    onAddCustomTaskEmoji(picked);
    setCustomEmojiInput("");
  };

  const handleSave = () => {
    if (!title.trim()) return;
    if (showWeekdays && weekdays.length === 0) {
      setWeekdayError(true);
      return;
    }
    setWeekdayError(false);
    onAddCustomTaskEmoji(emoji);
    onSave(title, emoji, showWeekdays ? weekdays : undefined, sharedSessions, isSpecialMission ? specialRewardFloor : undefined);
  };

  const emojiBtnStyle = (selected: boolean): CSSProperties => ({
    width: 36, height: 36, borderRadius: 8,
    border: selected ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.secondary}`,
    backgroundColor: selected ? `${theme.accent.primary}18` : theme.fill.secondary,
    fontSize: 20, cursor: "pointer", padding: 0,
  });

  return (
    <div style={{
      padding: "10px 12px", borderRadius: 14,
      border: `1.5px solid ${theme.accent.primary}44`,
      backgroundColor: `${theme.accent.primary}08`,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {header && (
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary }}>{header}</div>
      )}
      {hint && (
        <div style={{ fontSize: 11, color: theme.text.tertiary, lineHeight: 1.45 }}>{hint}</div>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: theme.text.tertiary }}>おすすめ</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => setEmoji(e)} style={emojiBtnStyle(emoji === e)}>{e}</button>
        ))}
      </div>
      {showSavedCustom && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.text.tertiary }}>マイ絵文字</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {extraSelectedEmoji && (
              <button type="button" onClick={() => setEmoji(extraSelectedEmoji)} style={emojiBtnStyle(emoji === extraSelectedEmoji)}>
                {extraSelectedEmoji}
              </button>
            )}
            {savedCustomEmojis.map((e) => (
              <button key={e} type="button" onClick={() => setEmoji(e)} style={emojiBtnStyle(emoji === e)}>{e}</button>
            ))}
          </div>
        </>
      )}
      <div style={{ fontSize: 11, fontWeight: 700, color: theme.text.tertiary }}>自分で追加</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          value={customEmojiInput}
          onChange={(e) => { setCustomEmojiInput(e.target.value); setCustomEmojiError(false); }}
          onKeyDown={(e) => e.key === "Enter" && handleAddCustomEmoji()}
          placeholder="絵文字を入力..."
          style={{
            flex: 1, padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${theme.stroke.secondary}`,
            fontSize: 18, outline: "none", backgroundColor: theme.bg.editor, color: theme.text.primary,
            fontFamily: "inherit",
          }}
        />
        <button type="button" onClick={handleAddCustomEmoji} style={{
          padding: "8px 12px", borderRadius: 8, border: "none",
          backgroundColor: theme.fill.secondary, color: theme.text.secondary,
          fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
        }}>
          追加
        </button>
      </div>
      {customEmojiError && (
        <div style={{ fontSize: 11, color: theme.category.pink, fontWeight: 700 }}>
          絵文字を1つ入力してね
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        <input
          autoFocus={autoFocus}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="タスク名を入力..."
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${theme.stroke.secondary}`,
            fontSize: 15, outline: "none", backgroundColor: theme.bg.editor, color: theme.text.primary,
            fontFamily: "inherit",
          }}
        />
      </div>
      {showWeekdays && (
        <>
          <WeekdayPicker selected={weekdays} onChange={(d) => { setWeekdays(d); setWeekdayError(false); }} />
          {weekdayError && (
            <div style={{ fontSize: 12, color: theme.category.pink, fontWeight: 700 }}>
              ようびを1つえらんでね
            </div>
          )}
        </>
      )}
      {isSpecialMission && (
        <div style={{
          display: "flex", gap: 8,
          padding: 8, borderRadius: 10,
          border: `1px solid ${theme.stroke.tertiary}`,
          backgroundColor: theme.fill.quaternary,
        }}>
          <button
            type="button"
            onClick={() => setSpecialRewardFloor("rare")}
            style={{
              flex: 1, padding: "9px 8px", borderRadius: 9, cursor: "pointer",
              border: specialRewardFloor === "rare" ? `2px solid ${theme.category.orange}` : `1px solid ${theme.stroke.secondary}`,
              backgroundColor: specialRewardFloor === "rare" ? `${theme.category.orange}16` : theme.bg.editor,
              color: specialRewardFloor === "rare" ? theme.category.orange : theme.text.secondary,
              fontSize: 12, fontWeight: 800,
            }}
          >
            レア以上
          </button>
          <button
            type="button"
            onClick={() => setSpecialRewardFloor("superRare")}
            style={{
              flex: 1, padding: "9px 8px", borderRadius: 9, cursor: "pointer",
              border: specialRewardFloor === "superRare" ? `2px solid ${theme.category.purple}` : `1px solid ${theme.stroke.secondary}`,
              backgroundColor: specialRewardFloor === "superRare" ? `${theme.category.purple}16` : theme.bg.editor,
              color: specialRewardFloor === "superRare" ? theme.category.purple : theme.text.secondary,
              fontSize: 12, fontWeight: 800,
            }}
          >
            スーパーレア以上
          </button>
        </div>
      )}
      <SessionMultiPicker selected={sharedSessions} onChange={setSharedSessions} />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={handleSave} style={{
          flex: 2, padding: "10px", borderRadius: 10, border: "none",
          backgroundColor: theme.accent.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>{saveLabel}</button>
        <button type="button" onClick={onCancel} style={{
          flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${theme.stroke.secondary}`,
          backgroundColor: "transparent", color: theme.text.tertiary, fontSize: 13, cursor: "pointer",
        }}>キャンセル</button>
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete} style={{
          width: "100%", padding: "10px", borderRadius: 10,
          border: `1.5px solid ${theme.category.pink}55`,
          backgroundColor: `${theme.category.pink}10`, color: theme.category.pink,
          fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>
          {sharedSessions.length >= 2 ? "すべての時間帯から削除する" : "削除する"}
        </button>
      )}
    </div>
  );
}

function TaskActionSheet({
  task, onEdit, onClose,
}: {
  task: Task;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <div
      data-modal-overlay
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        backgroundColor: "rgba(0,0,0,0.45)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: theme.bg.editor,
          borderRadius: "20px 20px 0 0",
          padding: "20px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 16, padding: "0 4px",
        }}>
          <span style={{ fontSize: 28 }}>{task.emoji}</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: theme.text.primary }}>{task.title}</span>
        </div>
        <button type="button" onClick={onEdit} style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          backgroundColor: theme.accent.primary, color: "#fff",
          fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 8,
        }}>
          ✏️ タスクを編集
        </button>
        <button type="button" onClick={onClose} style={{
          width: "100%", padding: "14px", borderRadius: 12,
          border: `1px solid ${theme.stroke.secondary}`,
          backgroundColor: "transparent", color: theme.text.tertiary,
          fontSize: 15, cursor: "pointer",
        }}>
          キャンセル
        </button>
      </div>
    </div>
  );
}

// ── Task Screen ───────────────────────────────────────

interface TaskScreenProps {
  session: SessionId;
  allSessionTasks: AllSessionTasks;
  interactionLocked?: boolean;
  label: string; timeLabel: string;
  tasks: Task[]; done: Set<number>; skipped: Set<number>; justChecked: number | null;
  floatColor: string;
  bestTimes: Record<string, number>;
  activeWorkTask: ActiveWorkTask | null;
  workTimerElapsed: number;
  workTimerRunning: boolean;
  newRecordTaskId: number | null;
  onReorder: (tasks: Task[]) => void;
  onAddTask: (title: string, emoji: string, scope: TaskScope, weekdays?: number[], targetSessions?: SessionId[], specialRewardFloor?: SpecialRewardFloor) => void;
  onEditTask: (id: number, title: string, emoji: string, weekdays?: number[], targetSessions?: SessionId[], specialRewardFloor?: SpecialRewardFloor) => void;
  onDeleteTask: (id: number) => void;
  onSkipTask: (id: number) => void;
  onQuickCompleteTask: (id: number) => void;
  onSelectTask: (id: number) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onCancelTask: () => void;
  onCompleteTask: () => void;
  onClearBestTime: (id: number) => void;
  customTaskEmojis: string[];
  onAddCustomTaskEmoji: (emoji: string) => void;
  todayMission: DailyMission | null;
  missionCardStatus: MissionCardStatus | null;
  activeMissionSessions: SessionId[];
  missionDoneSessions: SessionId[];
  missionApprovedSessions: SessionId[];
  showEveningMissionNudge: boolean;
  onMissionDone: () => void;
  onMissionUndo: () => void;
  onMissionSetup: () => void;
  onOpenMissionReward: () => void;
  onOpenMissionParentCheck: () => void;
  showDailyRewardButton: boolean;
  onOpenDailyReward: () => void;
  showOneOffSpecialRewardButton: boolean;
  onOpenOneOffSpecialReward: () => void;
  showOneOffParentCheckButton: boolean;
  onOpenOneOffParentCheck: () => void;
  gamePlaySec?: number;
}

function TaskScreen({
  session, allSessionTasks, interactionLocked = false, label, timeLabel, tasks, done, skipped, justChecked, floatColor,
  bestTimes, activeWorkTask, workTimerElapsed, workTimerRunning, newRecordTaskId,
  onReorder, onAddTask, onEditTask, onDeleteTask, onSkipTask, onQuickCompleteTask, onSelectTask, onStartTimer, onPauseTimer, onCancelTask, onCompleteTask,
  onClearBestTime, customTaskEmojis, onAddCustomTaskEmoji,
  todayMission, missionCardStatus, activeMissionSessions, missionDoneSessions, missionApprovedSessions,
  showEveningMissionNudge, onMissionDone, onMissionUndo, onMissionSetup, onOpenMissionReward,
  showDailyRewardButton, onOpenDailyReward, onOpenMissionParentCheck,
  showOneOffSpecialRewardButton, onOpenOneOffSpecialReward,
  showOneOffParentCheckButton, onOpenOneOffParentCheck,
  gamePlaySec,
}: TaskScreenProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<TaskScope>("today");
  const [openSwipe, setOpenSwipe] = useState<{ id: number; mode: SwipeMode } | null>(null);
  const [confirmDeleteTimeId, setConfirmDeleteTimeId] = useState<number | null>(null);
  const [actionSheetTaskId, setActionSheetTaskId] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  const actionSheetTask = actionSheetTaskId !== null ? tasks.find((t) => t.id === actionSheetTaskId) : null;
  const editingTask = editingTaskId !== null ? tasks.find((t) => t.id === editingTaskId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const shownTasks = visibleTasksForSession(session, allSessionTasks);
  const listTasks = tasksForSessionList(shownTasks);
  const progressTasks = tasksForProgress(shownTasks);
  const gameTask = shownTasks.find(isGameTask);

  const handleDragEnd = (event: DragEndEvent) => {
    if (interactionLocked) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = progressTasks.findIndex((t) => t.id === active.id);
      const newIdx = progressTasks.findIndex((t) => t.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      onReorder(reorderVisibleInAll(session, tasks, arrayMove(progressTasks, oldIdx, newIdx), allSessionTasks));
    }
  };

  const handleAdd = (
    title: string,
    emoji: string,
    weekdays?: number[],
    sharedSessions?: SessionId[],
    specialRewardFloor?: SpecialRewardFloor,
  ) => {
    onAddTask(title, emoji, addMode, weekdays, sharedSessions, specialRewardFloor);
    setIsAdding(false);
  };

  const confirmDeleteShared = (task: Task): boolean => {
    if (!task.sharedKey || !task.sharedSessions || task.sharedSessions.length < 2) return true;
    return window.confirm(
      `「${task.title}」をすべての時間帯（${sharedSessionsLabel(task.sharedSessions)}）から削除しますか？`,
    );
  };

  const handleDeleteTask = (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (task && !confirmDeleteShared(task)) return;
    onDeleteTask(id);
  };

  const startAdding = (mode: TaskScope) => {
    setAddMode(mode);
    setIsAdding(true);
  };

  const handleLongPress = (taskId: number) => {
    if (interactionLocked) return;
    setOpenSwipe(null);
    setActionSheetTaskId(taskId);
  };

  return (
    <>
      <div>
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 3, letterSpacing: 0.8, textTransform: "uppercase" }}>
          {timeLabel}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: theme.text.primary, lineHeight: 1.2 }}>
          {label}
        </div>
      </div>

      <StepProgress tasks={progressTasks} done={done} skipped={skipped} justChecked={justChecked} />
      <BestTimeSummary session={session} tasks={progressTasks} bestTimes={bestTimes} />
      <div style={{ height: 1, backgroundColor: theme.stroke.tertiary }} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={listTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {listTasks.map((task) => {
              const isActive = activeWorkTask?.session === session && activeWorkTask.taskId === task.id;
              const isSkipped = skipped.has(task.id);
              const swipeMode = openSwipe?.id === task.id ? openSwipe.mode : null;
              return (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  sortable={!isOneOffSpecialTask(task)}
                  isDone={done.has(task.id)}
                  isSkipped={isSkipped}
                  isJustChecked={justChecked === task.id}
                  isActive={isActive}
                  isNewRecord={newRecordTaskId === task.id}
                  floatColor={floatColor}
                  bestTime={bestTimes[taskTimeKey(session, task.id, task)]}
                  liveElapsed={isActive ? workTimerElapsed : undefined}
                  timerRunning={isActive && workTimerRunning}
                  interactionLocked={interactionLocked}
                  swipeMode={swipeMode}
                  onSwipeOpen={(mode) => {
                    if (interactionLocked) return;
                    setOpenSwipe({ id: task.id, mode });
                  }}
                  onSwipeClose={() => setOpenSwipe(null)}
                  onSelect={() => onSelectTask(task.id)}
                  onDelete={() => { handleDeleteTask(task.id); setOpenSwipe(null); }}
                  onSkip={() => { onSkipTask(task.id); setOpenSwipe(null); }}
                  onQuickComplete={() => { onQuickCompleteTask(task.id); setOpenSwipe(null); }}
                  onStartTimer={onStartTimer}
                  onPauseTimer={onPauseTimer}
                  onCancelTask={onCancelTask}
                  onCompleteTask={onCompleteTask}
                  confirmDeleteTime={confirmDeleteTimeId === task.id}
                  onTimeBadgeTap={() => setConfirmDeleteTimeId(
                    confirmDeleteTimeId === task.id ? null : task.id,
                  )}
                  onConfirmDeleteTime={() => {
                    onClearBestTime(task.id);
                    setConfirmDeleteTimeId(null);
                  }}
                  onCancelDeleteTime={() => setConfirmDeleteTimeId(null)}
                  onLongPress={() => handleLongPress(task.id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {gameTask && (
        <TaskRow
          task={gameTask}
          isDone={false}
          isSkipped={false}
          isJustChecked={false}
          isActive={false}
          isNewRecord={false}
          floatColor={floatColor}
          isGameRow
          gamePlaySec={gamePlaySec}
          interactionLocked={interactionLocked}
          confirmDeleteTime={false}
          onSelect={() => {}}
          onTimeBadgeTap={() => {}}
          onConfirmDeleteTime={() => {}}
          onCancelDeleteTime={() => {}}
        />
      )}

      {showDailyRewardButton && (
        <div style={{
          borderRadius: 14,
          border: `1.5px solid ${theme.category.green}55`,
          backgroundColor: `${theme.category.green}12`,
          padding: "13px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🎁</span>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              color: theme.text.primary,
            }}>
              きょうのごほうび
            </span>
            <button
              type="button"
              onClick={onOpenDailyReward}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                backgroundColor: theme.category.green,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              ごほうび！
            </button>
          </div>
        </div>
      )}

      {showOneOffParentCheckButton && (
        <div style={{
          borderRadius: 14,
          border: `1.5px solid ${theme.category.orange}55`,
          backgroundColor: `${theme.category.orange}12`,
          padding: "13px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>👪</span>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              color: theme.text.primary,
            }}>
              特別ミッション — 親の確認待ち
            </span>
            <button
              type="button"
              onClick={onOpenOneOffParentCheck}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                backgroundColor: theme.category.orange,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              確認する
            </button>
          </div>
        </div>
      )}

      {showOneOffSpecialRewardButton && (
        <div style={{
          borderRadius: 14,
          border: `1.5px solid ${theme.category.orange}55`,
          backgroundColor: `${theme.category.orange}12`,
          padding: "13px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🎯</span>
            <span style={{
              fontSize: 15,
              fontWeight: 600,
              flex: 1,
              minWidth: 0,
              color: theme.text.primary,
            }}>
              特別ミッションのごほうび
            </span>
            <button
              type="button"
              onClick={onOpenOneOffSpecialReward}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                backgroundColor: theme.category.orange,
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              もらう！
            </button>
          </div>
        </div>
      )}

      {todayMission && missionCardStatus && (
        <MissionCard
          mission={todayMission}
          status={missionCardStatus}
          currentSession={session}
          activeSessions={activeMissionSessions}
          doneSessions={missionDoneSessions}
          approvedSessions={missionApprovedSessions}
          showEveningNudge={showEveningMissionNudge}
          alignWithTaskRows
          onDone={onMissionDone}
          onUndoSession={missionCardStatus === "session_complete" ? onMissionUndo : undefined}
          onOpenReward={onOpenMissionReward}
          onOpenParentCheck={
            missionCardStatus === "session_awaiting_parent" ? onOpenMissionParentCheck : undefined
          }
          onLongPressSetup={onMissionSetup}
        />
      )}

      {/* タスク追加エリア */}
      {isAdding ? (
        <TaskEditForm
          key={`add-${addMode}`}
          header={
            addMode === "special"
              ? "単発特別ミッション"
              : addMode === "today"
                ? "きょうだけのタスク"
                : "レギュラータスク"
          }
          hint={addMode === "special" ? "クリアするとレア以上のシールがもらえるよ（親の確認が必要）" : undefined}
          initialTitle=""
          initialEmoji={addMode === "special" ? "🎯" : "📝"}
          isSpecialMission={addMode === "special"}
          initialSpecialRewardFloor="rare"
          saveLabel="追加する"
          showWeekdays={addMode === "regular"}
          currentSession={session}
          customTaskEmojis={customTaskEmojis}
          onAddCustomTaskEmoji={onAddCustomTaskEmoji}
          onSave={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      ) : !interactionLocked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button onClick={() => startAdding("special")} style={{
            ...addBtnStyle,
            borderColor: `${theme.category.orange}66`,
            color: theme.category.orange,
            backgroundColor: `${theme.category.orange}10`,
          }}>
            <span style={{ fontSize: 18 }}>＋</span> 単発特別ミッション
          </button>
          <button onClick={onMissionSetup} style={{
            ...addBtnStyle,
            borderColor: `${theme.category.purple}66`,
            color: theme.category.purple,
            backgroundColor: `${theme.category.purple}10`,
          }}>
            <span style={{ fontSize: 18 }}>＋</span> {todayMission ? "特別ミッションを変更" : "特別ミッションを設定"}
          </button>
          <button onClick={() => startAdding("today")} style={addBtnStyle}>
            <span style={{ fontSize: 18 }}>＋</span> きょうだけのタスク
          </button>
          <button onClick={() => startAdding("regular")} style={{ ...addBtnStyle, borderColor: `${theme.accent.primary}55`, color: theme.text.secondary }}>
            <span style={{ fontSize: 18 }}>＋</span> レギュラータスク
          </button>
        </div>
      )}

      {actionSheetTask && (
        <TaskActionSheet
          task={actionSheetTask}
          onEdit={() => {
            setEditingTaskId(actionSheetTask.id);
            setActionSheetTaskId(null);
          }}
          onClose={() => setActionSheetTaskId(null)}
        />
      )}

      {editingTask && (
        <div
          data-modal-overlay
          onClick={() => setEditingTaskId(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 110,
            backgroundColor: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 480,
              maxHeight: "92dvh", overflowY: "auto",
              backgroundColor: theme.bg.editor,
              borderRadius: "20px 20px 0 0",
              padding: "16px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
              boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
            }}
          >
            <TaskEditForm
              key={`edit-${editingTask.id}`}
              header="タスクを編集"
              initialTitle={editingTask.title}
              initialEmoji={editingTask.emoji}
              isSpecialMission={(editingTask.scope ?? "regular") === "special"}
              initialSpecialRewardFloor={editingTask.specialRewardFloor ?? "rare"}
              initialWeekdays={editingTask.weekdays ?? ALL_WEEKDAYS}
              showWeekdays={(editingTask.scope ?? "regular") === "regular"}
              saveLabel="保存する"
              autoFocus={false}
              currentSession={session}
              initialSharedSessions={editingTask.sharedSessions}
              customTaskEmojis={customTaskEmojis}
              onAddCustomTaskEmoji={onAddCustomTaskEmoji}
              onSave={(title, emoji, weekdays, sharedSessions, specialRewardFloor) => {
                onEditTask(editingTask.id, title, emoji, weekdays, sharedSessions, specialRewardFloor);
                setEditingTaskId(null);
              }}
              onCancel={() => setEditingTaskId(null)}
              onDelete={() => {
                handleDeleteTask(editingTask.id);
                setEditingTaskId(null);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── Sortable Task Row ─────────────────────────────────

const SWIPE_DELETE_WIDTH = 72;
const SWIPE_LATER_WIDTH = 58;
const SWIPE_DONE_WIDTH = 62;
const SWIPE_ACTION_WIDTH = SWIPE_LATER_WIDTH + SWIPE_DONE_WIDTH;
const LONG_PRESS_MS = 500;
const GESTURE_SLOP = 10;

type GesturePhase = "idle" | "pending" | "swiping";

interface GestureState {
  phase: GesturePhase;
  startX: number;
  startY: number;
  startOffset: number;
  moved: boolean;
  lastOffset: number;
  pointerId: number;
}

function emptyGesture(): GestureState {
  return {
    phase: "idle",
    startX: 0,
    startY: 0,
    startOffset: 0,
    moved: false,
    lastOffset: 0,
    pointerId: -1,
  };
}

const addBtnStyle: CSSProperties = {
  width: "100%", padding: "11px", borderRadius: 12,
  border: `1.5px dashed ${theme.stroke.secondary}`, backgroundColor: "transparent",
  color: theme.text.tertiary, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
};

interface TaskRowProps {
  task: Task; isDone: boolean; isSkipped: boolean; isJustChecked: boolean; isActive: boolean; isNewRecord: boolean;
  floatColor: string; bestTime?: number; liveElapsed?: number; gamePlaySec?: number; isGameRow?: boolean;
  timerRunning: boolean; interactionLocked?: boolean;
  onSelect: () => void; onDelete: () => void; onSkip: () => void; onQuickComplete: () => void; onLongPress: () => void;
  swipeMode: SwipeMode | null; onSwipeOpen: (mode: SwipeMode) => void; onSwipeClose: () => void;
  onStartTimer: () => void; onPauseTimer: () => void; onCancelTask: () => void; onCompleteTask: () => void;
  confirmDeleteTime: boolean;
  onTimeBadgeTap: () => void; onConfirmDeleteTime: () => void; onCancelDeleteTime: () => void;
  sortable?: boolean;
}

function swipeSnapOffset(mode: SwipeMode | null) {
  if (mode === "delete") return -SWIPE_DELETE_WIDTH;
  if (mode === "skip") return SWIPE_ACTION_WIDTH;
  return 0;
}

function SortableTaskRow(props: TaskRowProps) {
  const {
    swipeMode, onSwipeOpen, onSwipeClose, onSelect, onDelete, onSkip, onQuickComplete, onLongPress, isSkipped,
    onStartTimer, onPauseTimer, onCancelTask, onCompleteTask, isActive, liveElapsed, timerRunning,
    interactionLocked = false,
    confirmDeleteTime, onTimeBadgeTap, onConfirmDeleteTime, onCancelDeleteTime,
    sortable = true,
    ...rowProps
  } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    disabled: !sortable,
  });
  const swipeRef = useRef<HTMLDivElement>(null);
  const gestureSurfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState>(emptyGesture());
  const suppressClickRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const snapOffset = swipeSnapOffset(swipeMode);
  const displayX = dragging ? offsetX : snapOffset;

  const clampOffset = (v: number) => Math.min(SWIPE_ACTION_WIDTH, Math.max(-SWIPE_DELETE_WIDTH, v));

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPressTimer(), []);

  const resetGesture = () => {
    clearLongPressTimer();
    gesture.current = emptyGesture();
    setDragging(false);
  };

  const releaseCapture = () => {
    const el = gestureSurfaceRef.current;
    const { pointerId, phase } = gesture.current;
    if (el && phase === "swiping" && pointerId >= 0) {
      try {
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      } catch { /* ignore */ }
    }
  };

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const blockScroll = (e: TouchEvent) => {
      if (gesture.current.phase === "swiping") e.preventDefault();
    };
    el.addEventListener("touchmove", blockScroll, { passive: false });
    return () => el.removeEventListener("touchmove", blockScroll);
  }, []);

  const beginGesture = (clientX: number, clientY: number, pointerId: number) => {
    if (interactionLocked) return;
    clearLongPressTimer();
    const startOffset = swipeSnapOffset(swipeMode);
    gesture.current = {
      phase: "pending",
      startX: clientX,
      startY: clientY,
      startOffset,
      moved: false,
      lastOffset: startOffset,
      pointerId,
    };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      if (gesture.current.phase !== "pending") return;
      gesture.current.moved = true;
      navigator.vibrate?.(10);
      resetGesture();
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const moveGesture = (clientX: number, clientY: number, target: HTMLElement) => {
    const g = gesture.current;
    if (g.phase === "idle") return;

    const dx = clientX - g.startX;
    const dy = clientY - g.startY;

    if (g.phase === "pending") {
      if (Math.abs(dx) > GESTURE_SLOP || Math.abs(dy) > GESTURE_SLOP) {
        clearLongPressTimer();
      }
      if (Math.abs(dy) > GESTURE_SLOP && Math.abs(dy) >= Math.abs(dx)) {
        resetGesture();
        return;
      }
      if (Math.abs(dx) > GESTURE_SLOP && Math.abs(dx) > Math.abs(dy)) {
        g.phase = "swiping";
        try {
          target.setPointerCapture(g.pointerId);
        } catch { /* ignore */ }
        setDragging(true);
        setOffsetX(g.startOffset);
      }
    }

    if (g.phase !== "swiping") return;

    if (Math.abs(dx) > GESTURE_SLOP) g.moved = true;
    g.lastOffset = clampOffset(g.startOffset + dx);
    setOffsetX(g.lastOffset);
  };

  const endGesture = () => {
    clearLongPressTimer();
    const g = gesture.current;
    if (g.phase === "swiping") {
      if (g.moved) suppressClickRef.current = true;
      if (g.lastOffset > SWIPE_ACTION_WIDTH / 2) onSwipeOpen("skip");
      else if (g.lastOffset < -SWIPE_DELETE_WIDTH / 2) onSwipeOpen("delete");
      else onSwipeClose();
    }
    releaseCapture();
    resetGesture();
  };

  const handleSelect = () => {
    if (interactionLocked) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (gesture.current.moved) {
      gesture.current.moved = false;
      return;
    }
    if (swipeMode) {
      onSwipeClose();
      return;
    }
    onSelect();
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex", alignItems: "stretch", gap: 6,
        transform: DndCSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : swipeMode ? 2 : "auto",
      }}
    >
      <div
        data-dnd-handle
        {...(sortable && !interactionLocked ? { ...attributes, ...listeners } : {})}
        style={{
          flexShrink: 0, width: 22, display: "flex", justifyContent: "center", alignItems: "center",
          cursor: sortable && !interactionLocked ? "grab" : "default",
          color: sortable ? theme.text.tertiary : "transparent",
          fontSize: 18,
          userSelect: "none", touchAction: sortable && !interactionLocked ? "none" : "auto",
          opacity: sortable && !interactionLocked ? 1 : 0,
        }}
      >
        ⠿
      </div>
      <div
        ref={swipeRef}
        data-task-swipe
        style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 14, touchAction: "pan-y" }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSkip(); }}
          aria-label={isSkipped ? "あとでをもどす" : "タスクをあとで"}
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: SWIPE_LATER_WIDTH,
            border: "none", cursor: "pointer",
            backgroundColor: theme.category.orange,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 2, padding: 0, color: "#fff", fontSize: 10, fontWeight: 800,
          }}
        >
          <span style={{ fontSize: 18 }}>{isSkipped ? "↩" : "⏭"}</span>
          {isSkipped ? "もどす" : "あとで"}
        </button>
        {!props.isDone && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onQuickComplete(); }}
            aria-label="タスクを完了"
            style={{
              position: "absolute", left: SWIPE_LATER_WIDTH, top: 0, bottom: 0, width: SWIPE_DONE_WIDTH,
              border: "none", cursor: "pointer",
              backgroundColor: theme.category.green,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 2, padding: 0, color: "#fff", fontSize: 10, fontWeight: 800,
            }}
          >
            <span style={{ fontSize: 18 }}>✓</span>
            完了
          </button>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="タスクを削除"
          style={{
            position: "absolute", right: 0, top: 0, bottom: 0, width: SWIPE_DELETE_WIDTH,
            border: "none", cursor: "pointer",
            backgroundColor: theme.category.pink,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, padding: 0,
          }}
        >
          🗑️
        </button>
        <div
          ref={gestureSurfaceRef}
          style={{
            transform: `translateX(${displayX}px)`,
            transition: dragging ? "none" : "transform 0.22s ease-out",
            backgroundColor: theme.bg.editor,
            position: "relative", zIndex: 1,
            touchAction: "pan-y",
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            beginGesture(e.clientX, e.clientY, e.pointerId);
          }}
          onPointerMove={(e) => {
            moveGesture(e.clientX, e.clientY, e.currentTarget);
          }}
          onPointerUp={() => endGesture()}
          onPointerCancel={() => endGesture()}
        >
          <TaskRow
            {...rowProps}
            isSkipped={isSkipped}
            isActive={isActive}
            interactionLocked={interactionLocked}
            onSelect={handleSelect}
            confirmDeleteTime={confirmDeleteTime}
            onTimeBadgeTap={onTimeBadgeTap}
            onConfirmDeleteTime={onConfirmDeleteTime}
            onCancelDeleteTime={onCancelDeleteTime}
          />
          {isActive && (
            <TaskTimerPanel
              elapsedMs={liveElapsed ?? 0}
              running={timerRunning}
              onStart={onStartTimer}
              onPause={onPauseTimer}
              onCancel={onCancelTask}
              onComplete={onCompleteTask}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function taskTimerBtnStyle(enabled: boolean, bg: string, color: string): CSSProperties {
  return {
    flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
    cursor: enabled ? "pointer" : "default",
    backgroundColor: enabled ? bg : theme.fill.secondary,
    color: enabled ? color : theme.text.tertiary,
    fontSize: 12, fontWeight: 700,
    opacity: enabled ? 1 : 0.55,
  };
}

function TaskTimerPanel({
  elapsedMs, running, onStart, onPause, onCancel, onComplete,
}: {
  elapsedMs: number; running: boolean;
  onStart: () => void; onPause: () => void; onCancel: () => void; onComplete: () => void;
}) {
  const canComplete = elapsedMs >= 1000;
  const canStart = !running;
  return (
    <div style={{
      padding: "10px 14px 12px", borderTop: `1px solid ${theme.stroke.tertiary}`,
      backgroundColor: `${theme.accent.primary}0A`,
    }}>
      <div style={{
        fontSize: 28, fontWeight: 900, textAlign: "center", color: theme.accent.primary,
        fontVariantNumeric: "tabular-nums", marginBottom: 10,
      }}>
        {fmtTaskTimeMs(elapsedMs)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onStart(); }}
          disabled={!canStart}
          style={taskTimerBtnStyle(canStart, theme.accent.primary, "#fff")}
        >
          スタート
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPause(); }}
          disabled={!running}
          style={taskTimerBtnStyle(running, theme.category.yellow, theme.text.primary)}
        >
          一時停止
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          disabled={!canComplete}
          style={taskTimerBtnStyle(canComplete, theme.category.green, "#fff")}
        >
          完了
        </button>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        style={{
          width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 10,
          border: `1px solid ${theme.stroke.secondary}`, cursor: "pointer",
          backgroundColor: "transparent", color: theme.text.tertiary,
          fontSize: 12, fontWeight: 600,
        }}
      >
        やめる
      </button>
    </div>
  );
}

function TaskRow({
  task, isDone, isSkipped, isJustChecked, isActive, isNewRecord, floatColor, bestTime, liveElapsed, gamePlaySec,
  isGameRow = false, interactionLocked = false, onSelect,
  confirmDeleteTime, onTimeBadgeTap, onConfirmDeleteTime, onCancelDeleteTime,
}: Pick<TaskRowProps, "task" | "isDone" | "isSkipped" | "isJustChecked" | "isActive" | "isNewRecord" | "floatColor" | "bestTime" | "liveElapsed" | "gamePlaySec" | "isGameRow" | "interactionLocked" | "confirmDeleteTime"> & {
  onSelect: () => void;
  onTimeBadgeTap: () => void; onConfirmDeleteTime: () => void; onCancelDeleteTime: () => void;
}) {
  if (isGameRow) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 14px", borderRadius: 14,
        backgroundColor: gamePlaySec ? `${theme.category.purple}12` : theme.fill.quaternary,
        border: `1.5px solid ${gamePlaySec ? `${theme.category.purple}44` : theme.stroke.tertiary}`,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>{task.emoji}</span>
        <span style={{
          fontSize: 15, fontWeight: 600, flex: 1, color: theme.text.primary,
        }}>
          {task.title}
        </span>
        {gamePlaySec !== undefined ? (
          <span style={{
            flexShrink: 0, fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums",
            color: theme.category.purple, padding: "4px 10px", borderRadius: 8,
            backgroundColor: `${theme.category.purple}18`,
          }}>
            ⏱ {fmtTaskTime(gamePlaySec)}
          </span>
        ) : (
          <span style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700, color: theme.text.tertiary,
          }}>
            まだ記録なし
          </span>
        )}
      </div>
    );
  }

  const resolved = isDone || isSkipped;
  const canTap = !isSkipped && !interactionLocked;

  return (
    <div
      onClick={canTap ? onSelect : undefined}
      className={isJustChecked ? "row-glow" : ""}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 14px", borderRadius: isActive ? "14px 14px 0 0" : 14,
        backgroundColor: isDone
          ? `${theme.category.green}16`
          : isSkipped
            ? `${theme.category.orange}14`
            : isActive
              ? `${theme.accent.primary}12`
              : theme.fill.quaternary,
        cursor: canTap ? "pointer" : "default",
        border: `1.5px solid ${
          isDone ? `${theme.category.green}44`
            : isSkipped ? `${theme.category.orange}55`
            : isActive ? `${theme.accent.primary}55`
            : theme.stroke.tertiary
        }`,
        position: "relative", overflow: "visible",
        opacity: isSkipped ? 0.82 : 1,
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1, filter: resolved ? "grayscale(40%)" : "none", transition: "filter 0.3s" }}>
        {task.emoji}
      </span>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          className={isJustChecked ? "check-pop" : ""}
          style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: isDone ? theme.category.green : isSkipped ? theme.category.orange : "transparent",
            border: resolved ? "none" : `2px solid ${theme.stroke.primary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {isDone && (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M1.5 6L5.5 10L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {isSkipped && !isDone && (
            <span style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>－</span>
          )}
        </div>
        {isJustChecked && (
          <div className="ring-out" style={{
            position: "absolute", top: 0, left: 0, width: 28, height: 28, borderRadius: 14,
            border: `3px solid ${theme.category.green}`, pointerEvents: "none", zIndex: 2,
          }} />
        )}
      </div>
      <span style={{
        fontSize: 15, fontWeight: resolved ? 400 : 600, flex: 1,
        color: resolved ? theme.text.tertiary : theme.text.primary,
        textDecoration: isDone ? "line-through" : "none",
      }}>
        {task.title}
        {isSkipped && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700, color: theme.category.orange,
            backgroundColor: `${theme.category.orange}22`, padding: "2px 6px", borderRadius: 6,
          }}>
            あとで
          </span>
        )}
        {task.scope === "special" && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700, color: theme.category.orange,
            backgroundColor: `${theme.category.orange}18`, padding: "2px 6px", borderRadius: 6,
          }}>
            特別
          </span>
        )}
        {task.scope === "today" && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700, color: theme.accent.primary,
            backgroundColor: `${theme.accent.primary}18`, padding: "2px 6px", borderRadius: 6,
          }}>
            きょう
          </span>
        )}
        {task.scope !== "today" && weekdayBadgeLabel(task.weekdays) && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700, color: theme.category.purple,
            backgroundColor: `${theme.category.purple}18`, padding: "2px 6px", borderRadius: 6,
          }}>
            {weekdayBadgeLabel(task.weekdays)}
          </span>
        )}
      </span>
      {isDone && !isActive && liveElapsed === undefined && (
        <span style={{
          flexShrink: 0, fontSize: 10, fontWeight: 700, color: theme.text.tertiary,
          padding: "3px 7px", borderRadius: 6, border: `1px solid ${theme.stroke.secondary}`,
        }}>
          もう一度
        </span>
      )}
      {liveElapsed !== undefined && (
        <span style={{
          flexShrink: 0, fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums",
          color: theme.accent.primary, display: "flex", alignItems: "center", gap: 3,
        }}>
          ⏱{fmtTaskTimeMs(liveElapsed)}
        </span>
      )}
      {liveElapsed === undefined && bestTime !== undefined && (
        <div
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onTimeBadgeTap}
            style={{
              border: "none", background: "none", cursor: "pointer", padding: "4px 6px",
              borderRadius: 8, fontSize: 12, fontWeight: 800, fontVariantNumeric: "tabular-nums",
              color: theme.category.orange, display: "flex", alignItems: "center", gap: 3,
              backgroundColor: confirmDeleteTime ? `${theme.category.orange}18` : "transparent",
            }}
          >
            🏆{fmtTaskTime(bestTime)}
          </button>
          {confirmDeleteTime && (
            <>
              <button
                type="button"
                onClick={onConfirmDeleteTime}
                style={{
                  border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 8,
                  fontSize: 11, fontWeight: 700, backgroundColor: theme.category.pink, color: "#fff",
                }}
              >
                けす
              </button>
              <button
                type="button"
                onClick={onCancelDeleteTime}
                aria-label="キャンセル"
                style={{
                  border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 8,
                  fontSize: 14, color: theme.text.tertiary, background: "transparent",
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}
      {isNewRecord && (
        <span className="record-badge-pop" style={{
          position: "absolute", right: 14, top: "-12px",
          fontSize: 13, fontWeight: 900, color: "#fff",
          backgroundColor: theme.category.orange, padding: "4px 10px", borderRadius: 10,
          pointerEvents: "none",
          boxShadow: `0 4px 16px ${theme.category.orange}88`,
          border: `2px solid ${theme.category.yellow}`,
        }}>
          🏆 新記録！
        </span>
      )}
      {isJustChecked && (
        <span className="float-label" style={{
          position: "absolute", right: 14, top: "-5%",
          fontSize: 32, fontWeight: 900,
          color: floatColor, textShadow: `0 0 12px ${floatColor}88`,
          pointerEvents: "none", zIndex: 3,
        }}>
          +1！
        </span>
      )}
    </div>
  );
}

// ── Hanamaru Stamp ────────────────────────────────────

function HanamaruStamp({ message }: { message: string }) {
  const STAMP_RED = "#C41230";
  const size = 200; const cx = size / 2;
  const outerR = cx - 7; const innerR = cx - 22;
  const midR = (outerR + innerR) / 2;
  const dotAngles = [...Array(10)].map((_, i) => (i * 36 * Math.PI) / 180);
  const msgFontSize = message.length <= 4 ? 36 : message.length <= 6 ? 28 : 22;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div className="ink-ripple"  style={{ position: "absolute", width: size,       height: size,       borderRadius: "50%", border: `4px solid ${STAMP_RED}` }} />
      <div className="ink-ripple2" style={{ position: "absolute", width: size * 0.8, height: size * 0.8, borderRadius: "50%", border: `2.5px solid ${STAMP_RED}` }} />
      <div className="stamp-press" style={{ transform: "scale(3) rotate(-18deg)" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: "drop-shadow(0 6px 18px rgba(196,18,48,0.45))" }}>
          <circle cx={cx} cy={cx} r={outerR} stroke={STAMP_RED} strokeWidth={6} fill={`${STAMP_RED}0C`} strokeOpacity={0.92} />
          <circle cx={cx} cy={cx} r={innerR} stroke={STAMP_RED} strokeWidth={2.5} fill="none" strokeOpacity={0.72} />
          {dotAngles.map((a, i) => (
            <circle key={i} cx={cx + Math.cos(a) * midR} cy={cx + Math.sin(a) * midR} r={2.5} fill={STAMP_RED} fillOpacity={0.55} />
          ))}
          <text x={cx} y={cx - 28} textAnchor="middle" fontSize={14} fill={STAMP_RED} fillOpacity={0.72} fontWeight={700} fontFamily="'Hiragino Kaku Gothic Pro', sans-serif" letterSpacing={4}>花まる</text>
          <text x={cx} y={cx + 16} textAnchor="middle" fontSize={msgFontSize} fill={STAMP_RED} fillOpacity={0.92} fontWeight={900} fontFamily="'Hiragino Kaku Gothic Pro', sans-serif" letterSpacing={1}>{message}</text>
          <text x={cx} y={cx + 48} textAnchor="middle" fontSize={12} fill={STAMP_RED} fillOpacity={0.55} fontFamily="sans-serif" letterSpacing={6}>◇ ◇ ◇</text>
        </svg>
      </div>
    </div>
  );
}

// ── Show Parent Screen ────────────────────────────────

function ShowParentScreen({
  context, approved, timerDuration, onSetDuration,
  onApprove, onReset, onGoTimer, onHome,
}: {
  context: { label: string; taskNames: string[]; completedAt: string };
  approved: boolean;
  timerDuration: number;
  onSetDuration: (m: number) => void;
  onApprove: () => void;
  onReset: () => void;
  onGoTimer: () => void;
  onHome: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "80vh" }}>
      {/* ホームボタン */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div onClick={onHome} style={{
          display: "flex", alignItems: "center", gap: 4,
          cursor: "pointer", color: theme.text.tertiary, fontSize: 13,
          padding: "4px 6px", borderRadius: 6,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 8L8 2L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 6V13H12V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          ホーム
        </div>
        <div style={{ fontSize: 12, color: theme.text.tertiary }}>{context.completedAt} 完了</div>
      </div>

      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: theme.text.primary }}>ぜんぶできたよ！</div>
        <div style={{ display: "inline-flex", marginTop: 6, padding: "3px 12px", borderRadius: 100, backgroundColor: theme.fill.secondary }}>
          <span style={{ fontSize: 12, color: theme.text.tertiary }}>{context.label}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {context.taskNames.map((name) => (
          <div key={name} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
            borderRadius: 12, backgroundColor: `${theme.category.green}14`,
            border: `1.5px solid ${theme.category.green}44`,
          }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.category.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontSize: 13, color: theme.text.secondary }}>{name}</span>
          </div>
        ))}
      </div>

      {approved && (
        <div className="approved-in" style={{
          padding: "11px 16px", borderRadius: 12,
          backgroundColor: `${theme.category.green}20`, border: `2px solid ${theme.category.green}66`,
          display: "flex", alignItems: "center", gap: 10, justifyContent: "center",
        }}>
          <div style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: theme.category.green, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <path d="M1.5 5L5 8.5L11.5 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: theme.category.green }}>親がかくにんしたよ！</span>
        </div>
      )}

      {/* ── 親のチェック（上に配置） */}
      <div style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${theme.stroke.secondary}`, backgroundColor: theme.fill.quaternary }}>
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 10, textAlign: "center" }}>ここは親がかくにんするところ</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div onClick={onApprove} style={{
            flex: 2, padding: "12px", borderRadius: 10, textAlign: "center",
            backgroundColor: approved ? `${theme.category.green}33` : theme.category.green,
            color: approved ? theme.category.green : "white",
            fontSize: 14, fontWeight: 700,
            cursor: approved ? "default" : "pointer",
            border: approved ? `1.5px solid ${theme.category.green}66` : "none",
          }}>
            {approved ? "かくにん済み ✓" : "はんこを押す！"}
          </div>
          {approved && (
            <div onClick={onReset} style={{
              flex: 1, padding: "12px", borderRadius: 10, textAlign: "center",
              backgroundColor: theme.fill.secondary, color: theme.text.tertiary,
              fontSize: 12, cursor: "pointer",
            }}>
              取り消す
            </div>
          )}
        </div>
      </div>

      <TimerDurationPanel
        duration={timerDuration}
        onSetDuration={onSetDuration}
        disabled={!approved}
        needsApprovalMessage={!approved}
        showStartButton
        onStart={onGoTimer}
      />
    </div>
  );
}

// ── Timer Screen ──────────────────────────────────────

function TimerScreen({
  secondsLeft, totalSeconds, elapsedSec, overtime, paused, timerRunning, timerDuration,
  onSetDuration, onStart, onPause, onResume, onCancel, onFinish, onBack, onHome,
}: {
  secondsLeft: number;
  totalSeconds: number;
  elapsedSec: number;
  overtime: boolean;
  paused: boolean;
  timerRunning: boolean;
  timerDuration: number;
  onSetDuration: (m: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onFinish: () => void;
  onBack: () => void;
  onHome: () => void;
}) {
  if (overtime && timerRunning) {
    const overtimeSec = Math.max(0, elapsedSec - totalSeconds);
    const minutes = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const overMin = Math.floor(overtimeSec / 60);
    const overSec = overtimeSec % 60;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "80vh", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <ScrollSafeBackButton onBack={onBack} />
          <div onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6V13H12V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ホーム
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 13, color: theme.category.orange, letterSpacing: 1, fontWeight: 700 }}>
            時間オーバー{paused ? "（とまってる）" : ""}
          </div>
          <div style={{ fontSize: 66, fontWeight: 900, color: theme.category.orange, fontVariantNumeric: "tabular-nums", letterSpacing: -3, lineHeight: 1 }}>
            {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </div>
          {overtimeSec > 0 && (
            <div style={{
              fontSize: 15, fontWeight: 800, color: theme.category.orange,
              padding: "8px 14px", borderRadius: 10, backgroundColor: `${theme.category.orange}18`,
            }}>
              +{overMin}:{String(overSec).padStart(2, "0")} オーバー
            </div>
          )}
          <div style={{ fontSize: 12, color: theme.text.tertiary, textAlign: "center", lineHeight: 1.6 }}>
            終わったら「終了して記録」をおしてね
          </div>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={paused ? onResume : onPause}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                backgroundColor: theme.accent.primary, color: "#fff", fontSize: 15, fontWeight: 700,
              }}
            >
              {paused ? "再開 ▶" : "一時停止 ⏸"}
            </button>
            <button
              type="button"
              onClick={onFinish}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                backgroundColor: theme.category.green, color: "#fff", fontSize: 15, fontWeight: 800,
              }}
            >
              終了して記録
            </button>
          </div>
        </div>
      </div>
    );
  }

  const displaySeconds = timerRunning ? secondsLeft : timerDuration * 60;
  const displayTotal   = timerRunning ? totalSeconds : timerDuration * 60;
  const progress   = displayTotal > 0 ? displaySeconds / displayTotal : 0;
  const minutes    = Math.floor(displaySeconds / 60);
  const secs       = displaySeconds % 60;
  const isWarning  = timerRunning && !paused && secondsLeft <= 60;
  const color      = !timerRunning ? theme.text.tertiary : paused ? theme.text.tertiary : isWarning ? theme.category.orange : theme.accent.primary;
  const totalDots  = 20;
  const activeDots = Math.ceil(progress * totalDots);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "80vh", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ScrollSafeBackButton onBack={onBack} />
        <div onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6V13H12V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ホーム
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ fontSize: 13, color: theme.text.tertiary, letterSpacing: 1 }}>
          ゲームのじかん
          {timerRunning && paused ? "（とまってる）" : !timerRunning ? "（まだスタートしてない）" : ""}
        </div>

        <div style={{ fontSize: 66, fontWeight: 900, color, fontVariantNumeric: "tabular-nums", letterSpacing: -3, lineHeight: 1 }}>
          {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>

        <div>
          <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", maxWidth: 260 }}>
            {[...Array(totalDots)].map((_, i) => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: i < activeDots ? color : theme.fill.secondary,
                border: i < activeDots ? "none" : `1px solid ${theme.stroke.tertiary}`,
              }} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: theme.text.tertiary }}>
            {!timerRunning ? "スタートボタンをおしてね" : paused ? "一時停止中" : `のこり ${minutes}分`}
          </div>
        </div>

        {isWarning && (
          <div style={{
            padding: "12px 24px", borderRadius: 12,
            backgroundColor: `${theme.category.orange}20`, border: `2px solid ${theme.category.orange}55`,
            fontSize: 15, color: theme.category.orange, fontWeight: 700, textAlign: "center",
          }}>
            もうすぐおわるよ！
          </div>
        )}

        {timerRunning && (
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              onClick={paused ? onResume : onPause}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                backgroundColor: theme.accent.primary, color: "#fff", fontSize: 15, fontWeight: 700,
              }}
            >
              {paused ? "再開 ▶" : "一時停止 ⏸"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
                backgroundColor: theme.fill.secondary, color: theme.text.secondary, fontSize: 15, fontWeight: 700,
              }}
            >
              取り消す
            </button>
          </div>
        )}
      </div>

      <TimerDurationPanel
        duration={timerDuration}
        onSetDuration={onSetDuration}
        compact
        showStartButton={!timerRunning}
        onStart={onStart}
      />
    </div>
  );
}

// ── Timer End Screen ──────────────────────────────────

function TimerEndScreen({
  streak, elapsedSec, plannedSec, paused, alarmRinging,
  onPause, onResume, onStopAlarm, onFinish, onBack, onHome,
}: {
  streak: number;
  elapsedSec: number;
  plannedSec: number;
  paused: boolean;
  alarmRinging: boolean;
  onPause: () => void;
  onResume: () => void;
  onStopAlarm: () => void;
  onFinish: () => void;
  onBack: () => void;
  onHome: () => void;
}) {
  const overtimeSec = Math.max(0, elapsedSec - plannedSec);
  const minutes = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const overMin = Math.floor(overtimeSec / 60);
  const overSec = overtimeSec % 60;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 20, textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ScrollSafeBackButton onBack={onBack} />
        <div onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6V13H12V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ホーム
        </div>
      </div>

      <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: `${theme.category.orange}18`, border: `3px solid ${theme.category.orange}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 36 }}>⏰</span>
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: theme.text.primary, marginBottom: 6 }}>時間が来たよ！</div>
        <div style={{ fontSize: 14, color: theme.text.secondary }}>遊んでいても時間はカウント中</div>
      </div>

      <div style={{ fontSize: 56, fontWeight: 900, color: theme.category.orange, fontVariantNumeric: "tabular-nums", letterSpacing: -2 }}>
        {String(minutes).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>

      {overtimeSec > 0 && (
        <div style={{
          fontSize: 15, fontWeight: 800, color: theme.category.orange,
          padding: "8px 14px", borderRadius: 10, backgroundColor: `${theme.category.orange}18`,
        }}>
          +{overMin}:{String(overSec).padStart(2, "0")} オーバー
        </div>
      )}

      {alarmRinging && (
        <button
          type="button"
          onClick={onStopAlarm}
          style={{
            width: "100%", maxWidth: 280, padding: "14px 0", borderRadius: 12, border: "none",
            cursor: "pointer", backgroundColor: theme.category.orange, color: "#fff",
            fontSize: 16, fontWeight: 800,
          }}
        >
          🔕 アラームをとめる
        </button>
      )}

      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 320 }}>
        <button
          type="button"
          onClick={paused ? onResume : onPause}
          style={{
            flex: 1, padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer",
            backgroundColor: theme.accent.primary, color: "#fff", fontSize: 15, fontWeight: 700,
          }}
        >
          {paused ? "再開 ▶" : "一時停止 ⏸"}
        </button>
        <button
          type="button"
          onClick={onFinish}
          style={{
            flex: 1, padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer",
            backgroundColor: theme.category.green, color: "#fff", fontSize: 15, fontWeight: 800,
          }}
        >
          終了して記録
        </button>
      </div>

      <div style={{ width: "80%", height: 1, backgroundColor: theme.stroke.tertiary }} />

      {streak >= 2 && (
        <div style={{
          fontSize: 13, color: theme.category.orange, padding: "10px 18px",
          borderRadius: 10, backgroundColor: `${theme.category.orange}11`, fontWeight: 700,
        }}>
          🔥 {streak}日連続！あした{streak + 1}日めをめざそう
        </div>
      )}
    </div>
  );
}

function AlarmSettingsScreen({
  settings, onChange, onTest, onBack,
}: {
  settings: AlarmSettings;
  onChange: (next: AlarmSettings) => void;
  onTest: () => void;
  onBack: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "80vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ScrollSafeBackButton onBack={onBack} />
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>アラーム設定</div>
      </div>
      <div style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.6 }}>
        タイマー終了時に鳴る音と振動の設定です。親が設定してね。
      </div>
      <AlarmSettingsPanel settings={settings} onChange={onChange} onTest={onTest} />
    </div>
  );
}
