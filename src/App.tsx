import { useState, useRef, useEffect, type CSSProperties } from "react";
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
import { PullToRefresh } from "./PullToRefresh";
import { TimerDurationPanel } from "./TimerControls";
import { AlarmSettingsPanel } from "./AlarmSettingsPanel";
import {
  loadAlarmSettings, saveAlarmSettings, startAlarm, stopAlarm,
  unlockAudio, retryAlarmSound, setSoundBlockedListener,
  type AlarmSettings,
} from "./alarm";
import { RecordScreen, getStreak, isFullDay, getFullDayStreak } from "./RecordCalendar";
import {
  NewRecordOverlay, DailyTreatOverlay, WeeklyRewardOverlay,
  type NewRecordCelebration,
} from "./Rewards";

// ── Types & Data ──────────────────────────────────────

type SessionId = "morning" | "evening" | "home";
type ScreenId  = SessionId | "show_parent" | "timer" | "timer_end" | "alarm_settings" | "record" | "task_list";
type CelebType = "confetti" | "burst" | "stripes" | "bars" | "diagonal";
type TaskScope = "regular" | "today";
type SwipeMode = "delete" | "skip";

interface Task { id: number; title: string; emoji: string; scope?: TaskScope; weekdays?: number[]; }

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_WEEKDAY = [1, 2, 3, 4, 5];
const WEEKDAYS_WEEKEND = [0, 6];

function isTaskVisibleToday(task: Task, now = new Date()): boolean {
  if (task.scope === "today") return true;
  if (!task.weekdays?.length) return true;
  return task.weekdays.includes(now.getDay());
}

function visibleTasks(tasks: Task[], now = new Date()): Task[] {
  return tasks.filter((t) => isTaskVisibleToday(t, now));
}

function taskMatchesWeekdayFilter(task: Task, filterDow: number | null, now = new Date()): boolean {
  if (filterDow === null) return true;
  if (task.scope === "today") return filterDow === now.getDay();
  if (!task.weekdays?.length) return true;
  return task.weekdays.includes(filterDow);
}

function taskScheduleBadge(task: Task): string {
  if (task.scope === "today") return "きょう";
  return weekdayBadgeLabel(task.weekdays) ?? "毎日";
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

function reorderVisibleInAll(allTasks: Task[], reorderedVisible: Task[]): Task[] {
  let vi = 0;
  return allTasks.map((t) => {
    if (!isTaskVisibleToday(t)) return t;
    return reorderedVisible[vi++];
  });
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
];

const EVENING_TASKS_DEFAULT: Task[] = [
  { id: 1, title: "宿題",           emoji: "📚" },
  { id: 2, title: "歯みがき",       emoji: "🦷" },
  { id: 3, title: "お風呂",         emoji: "🛁" },
  { id: 4, title: "頭を乾かす",     emoji: "💨" },
  { id: 5, title: "パジャマを着る", emoji: "😴" },
];

const HOME_TASKS_DEFAULT: Task[] = [
  { id: 1, title: "大事なプリントなど机に出す", emoji: "📄" },
  { id: 2, title: "宿題",                       emoji: "📖" },
  { id: 3, title: "水筒をキッチンに出す",       emoji: "🧴" },
  { id: 4, title: "洗濯物の片付け",             emoji: "👕" },
];

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

interface DayHistory { morning: boolean; evening: boolean; home?: boolean; }

interface StoredState {
  date: string;
  morningDone: number[];
  eveningDone: number[];
  homeDone: number[];
  morningSkipped: number[];
  eveningSkipped: number[];
  homeSkipped: number[];
  morningApproved: boolean;
  eveningApproved: boolean;
  homeApproved: boolean;
  morningTasks: Task[];
  eveningTasks: Task[];
  homeTasks: Task[];
  history: Record<string, DayHistory>;
  bestTimes?: Record<string, number>;
  dailyTreatClaimed?: Record<string, boolean>;
  lastWeeklyRewardStreak?: number;
  stickerAlbum?: string[];
}

interface ActiveWorkTask { session: SessionId; taskId: number; }

function taskTimeKey(session: SessionId, taskId: number) {
  return `${session}-${taskId}`;
}

function isTaskResolved(done: Set<number>, skipped: Set<number>, id: number) {
  return done.has(id) || skipped.has(id);
}

function isAllResolved(tasks: Task[], done: Set<number>, skipped: Set<number>) {
  const visible = visibleTasks(tasks);
  return visible.length > 0 && visible.every((t) => isTaskResolved(done, skipped, t.id));
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
    const sec = bestTimes[taskTimeKey(session, t.id)];
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
  eveningTasks: Task[],
  homeTasks: Task[],
) {
  return {
    date: taskDayKey(),
    morningDone: [] as number[],
    eveningDone: [] as number[],
    homeDone: [] as number[],
    morningSkipped: [] as number[],
    eveningSkipped: [] as number[],
    homeSkipped: [] as number[],
    morningApproved: false,
    eveningApproved: false,
    homeApproved: false,
    morningTasks: stripTodayTasks(morningTasks),
    eveningTasks: stripTodayTasks(eveningTasks),
    homeTasks: stripTodayTasks(homeTasks),
  };
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => ({ ...t, scope: t.scope ?? "regular" }));
}

function stripTodayTasks(tasks: Task[]): Task[] {
  return normalizeTasks(tasks).filter((t) => t.scope !== "today");
}

function hydrateStoredState(data: StoredState): StoredState {
  return {
    ...data,
    morningTasks: normalizeTasks(data.morningTasks ?? MORNING_TASKS_DEFAULT),
    eveningTasks: normalizeTasks(data.eveningTasks ?? EVENING_TASKS_DEFAULT),
    homeTasks: normalizeTasks(data.homeTasks ?? HOME_TASKS_DEFAULT),
    morningDone: data.morningDone ?? [],
    eveningDone: data.eveningDone ?? [],
    homeDone: data.homeDone ?? [],
    morningSkipped: data.morningSkipped ?? [],
    eveningSkipped: data.eveningSkipped ?? [],
    homeSkipped: data.homeSkipped ?? [],
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
        ...freshCompletionSlice(hydrated.morningTasks, hydrated.eveningTasks, hydrated.homeTasks),
      };
    }
  } catch { /* ignore */ }
  return {
    ...freshCompletionSlice(MORNING_TASKS_DEFAULT, EVENING_TASKS_DEFAULT, HOME_TASKS_DEFAULT),
    history: {},
  };
}

function getSessionScreen(): SessionId {
  const h = new Date().getHours();
  if (h < 12) return "morning";
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
      .chest-open    { animation: chestOpen 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      .treat-reveal  { animation: treatReveal 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards; }
    `}</style>
  );
}

// ── Main ──────────────────────────────────────────────

const QUICK_EMOJIS = ["📝", "✏️", "🎯", "⭐", "🎮", "📱", "🎵", "🏃", "🍽️", "🛒", "💊", "🐾"];

export default function KeigoTaskApp() {
  const stored = loadStoredState();

  const [screen,         setScreen]         = useState<ScreenId>(getInitialScreen());
  const [morningTasks,   setMorningTasks]   = useState<Task[]>(stored.morningTasks ?? MORNING_TASKS_DEFAULT);
  const [eveningTasks,   setEveningTasks]   = useState<Task[]>(stored.eveningTasks ?? EVENING_TASKS_DEFAULT);
  const [homeTasks,      setHomeTasks]      = useState<Task[]>(stored.homeTasks ?? HOME_TASKS_DEFAULT);
  const [morningDone,    setMorningDone]    = useState<Set<number>>(new Set(stored.morningDone));
  const [eveningDone,    setEveningDone]    = useState<Set<number>>(new Set(stored.eveningDone));
  const [homeDone,       setHomeDone]       = useState<Set<number>>(new Set(stored.homeDone));
  const [morningSkipped, setMorningSkipped] = useState<Set<number>>(new Set(stored.morningSkipped));
  const [eveningSkipped, setEveningSkipped] = useState<Set<number>>(new Set(stored.eveningSkipped));
  const [homeSkipped,    setHomeSkipped]    = useState<Set<number>>(new Set(stored.homeSkipped));
  const [morningApproved, setMorningApproved] = useState(stored.morningApproved);
  const [eveningApproved, setEveningApproved] = useState(stored.eveningApproved);
  const [homeApproved,    setHomeApproved]    = useState(stored.homeApproved);
  const [history,        setHistory]        = useState<Record<string, DayHistory>>(stored.history ?? {});
  const [bestTimes,      setBestTimes]      = useState<Record<string, number>>(stored.bestTimes ?? {});

  const [activeWorkTask, setActiveWorkTask] = useState<ActiveWorkTask | null>(null);
  const [workTimerElapsed, setWorkTimerElapsed] = useState(0);
  const [workTimerRunning, setWorkTimerRunning] = useState(false);
  const [newRecordTaskId, setNewRecordTaskId] = useState<number | null>(null);
  const [newRecordCelebration, setNewRecordCelebration] = useState<NewRecordCelebration | null>(null);
  const [newRecordCelebKey, setNewRecordCelebKey] = useState(0);
  const [dailyTreatOpen, setDailyTreatOpen] = useState(false);
  const [weeklyRewardOpen, setWeeklyRewardOpen] = useState(false);
  const [dailyTreatClaimed, setDailyTreatClaimed] = useState<Record<string, boolean>>(stored.dailyTreatClaimed ?? {});
  const [lastWeeklyRewardStreak, setLastWeeklyRewardStreak] = useState(stored.lastWeeklyRewardStreak ?? 0);
  const [stickerAlbum, setStickerAlbum] = useState<string[]>(stored.stickerAlbum ?? []);
  const taskDayRef = useRef(stored.date);
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
  const [prevScreen,   setPrevScreen]   = useState<ScreenId>("morning");
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
  const approved = parentSession === "morning"
    ? morningApproved
    : parentSession === "evening"
      ? eveningApproved
      : homeApproved;

  // ── localStorage save ──
  useEffect(() => {
    const state: StoredState = {
      date: taskDayKey(),
      morningDone:    [...morningDone],
      eveningDone:    [...eveningDone],
      homeDone:       [...homeDone],
      morningSkipped: [...morningSkipped],
      eveningSkipped: [...eveningSkipped],
      homeSkipped:    [...homeSkipped],
      morningApproved,
      eveningApproved,
      homeApproved,
      morningTasks,
      eveningTasks,
      homeTasks,
      history,
      bestTimes,
      dailyTreatClaimed,
      lastWeeklyRewardStreak,
      stickerAlbum,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [
    morningDone, eveningDone, homeDone,
    morningSkipped, eveningSkipped, homeSkipped,
    morningApproved, eveningApproved, homeApproved,
    morningTasks, eveningTasks, homeTasks,
    history, bestTimes,
    dailyTreatClaimed, lastWeeklyRewardStreak, stickerAlbum,
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
      startAlarm(alarmSettingsRef.current, () => setAlarmRinging(false));
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
      setEveningDone(new Set());
      setHomeDone(new Set());
      setMorningSkipped(new Set());
      setEveningSkipped(new Set());
      setHomeSkipped(new Set());
      setMorningApproved(false);
      setEveningApproved(false);
      setHomeApproved(false);
      setMorningTasks((t) => stripTodayTasks(t));
      setEveningTasks((t) => stripTodayTasks(t));
      setHomeTasks((t) => stripTodayTasks(t));
      setActiveWorkTask(null);
      resetWorkTimer();
      setJustChecked(null);
      setNewRecordCelebration(null);
      setStampVisible(false);
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
    const prev = history[today] ?? { morning: false, evening: false, home: false };
    if (session === "morning") {
      setMorningApproved(false);
      setHistory({ ...history, [today]: { ...prev, morning: false } });
    } else if (session === "evening") {
      setEveningApproved(false);
      setHistory({ ...history, [today]: { ...prev, evening: false } });
    } else {
      setHomeApproved(false);
      setHistory({ ...history, [today]: { ...prev, home: false } });
    }
    setStampVisible(false);
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
    tasks: Task[],
    done: Set<number>,
    skipped: Set<number>,
    label: string,
  ) => {
    const visible = visibleTasks(tasks);
    if (isAllResolved(tasks, done, skipped)) {
      const names = visible.map((t) => {
        if (skipped.has(t.id)) return `${t.title}（保留）`;
        return t.title;
      });
      setAnticipating(true);
      setTimeout(() => fireCelebration({ label, taskNames: names }, session), 750);
    }
  };

  const completeWorkTask = (
    session: SessionId,
    tasks: Task[],
    done: Set<number>,
    skipped: Set<number>,
    setDone: (s: Set<number>) => void,
    label: string,
  ) => {
    if (!activeWorkTask || activeWorkTask.session !== session) return;
    if (workTimerRunning) pauseWorkTimer();
    const totalSec = Math.floor(workTimerElapsed / 1000);
    if (totalSec < 1) return;

    const { taskId } = activeWorkTask;
    const key = taskTimeKey(session, taskId);
    const prevBest = bestTimes[key];
    if (prevBest === undefined || totalSec < prevBest) {
      setBestTimes((prev) => ({ ...prev, [key]: totalSec }));
      setNewRecordTaskId(taskId);
      setTimeout(() => setNewRecordTaskId(null), 4500);
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setNewRecordCelebKey((k) => k + 1);
        setNewRecordCelebration({ emoji: task.emoji, title: task.title, timeSec: totalSec });
        setShaking(true);
        setTimeout(() => setShaking(false), 520);
        navigator.vibrate?.(30);
      }
    }

    if (!done.has(taskId) && !skipped.has(taskId)) {
      const next = new Set(done);
      next.add(taskId);
      setDone(next);
      setFloatColor(FLOAT_COLORS[Math.floor(Math.random() * FLOAT_COLORS.length)]);
      setJustChecked(taskId);
      setTimeout(() => setJustChecked(null), 1350);
      maybeCelebrate(session, tasks, next, skipped, label);
    }
    resetWorkTimer();
    setActiveWorkTask(null);
  };

  // ── background timer（画面移動しても継続・一時停止対応）──
  useEffect(() => {
    const id = setInterval(() => {
      if (!timerEndRef.current || timerPaused) return;
      const rem = Math.ceil((timerEndRef.current - Date.now()) / 1000);
      if (rem <= 0) {
        timerEndRef.current = null;
        setTimerSecondsLeft(0);
        setTimerPaused(false);
        setTimerRunning(false);
        triggerTimerEndAlarm();
        setScreen((s) => (s === "timer" ? "timer_end" : s));
      } else {
        setTimerSecondsLeft(rem);
      }
    }, 500);
    return () => clearInterval(id);
  }, [timerPaused]);

  const startTimer = (minutes: number) => {
    void unlockAudio();
    const secs = minutes * 60;
    timerEndRef.current = Date.now() + secs * 1000;
    setTimerSecondsLeft(secs);
    setTimerSessionTotal(secs);
    setTimerDuration(minutes);
    setTimerPaused(false);
    setTimerRunning(true);
  };

  const pauseTimer = () => {
    if (!timerEndRef.current) return;
    const rem = Math.max(0, Math.ceil((timerEndRef.current - Date.now()) / 1000));
    timerEndRef.current = null;
    setTimerSecondsLeft(rem);
    setTimerPaused(true);
  };

  const resumeTimer = () => {
    if (!timerPaused || timerSecondsLeft <= 0) return;
    timerEndRef.current = Date.now() + timerSecondsLeft * 1000;
    setTimerPaused(false);
  };

  const cancelTimer = () => {
    timerEndRef.current = null;
    setTimerPaused(false);
    setTimerRunning(false);
    setTimerSecondsLeft(timerDuration * 60);
    setTimerSessionTotal(timerDuration * 60);
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
    setStickerAlbum((prev) => (prev.includes(rewardId) ? prev : [...prev, rewardId]));
  };

  const handleApprove = () => {
    if (approved) return;
    const today = todayKey();
    const prev = history[today] ?? { morning: false, evening: false, home: false };
    let updatedDay = { ...prev };
    if (parentSession === "morning") {
      setMorningApproved(true);
      updatedDay = { ...updatedDay, morning: true };
    } else if (parentSession === "evening") {
      setEveningApproved(true);
      updatedDay = { ...updatedDay, evening: true };
    } else {
      setHomeApproved(true);
      updatedDay = { ...updatedDay, home: true };
    }
    const newHistory = { ...history, [today]: updatedDay };
    setHistory(newHistory);
    triggerStamp();

    if (isFullDay(updatedDay)) {
      const fds = getFullDayStreak(newHistory);
      const weeklyMilestone = fds >= 7 && fds % 7 === 0 && fds > lastWeeklyRewardStreak;
      const needsDaily = !dailyTreatClaimed[today];
      setTimeout(() => {
        if (weeklyMilestone) {
          setWeeklyRewardOpen(true);
          setLastWeeklyRewardStreak(fds);
        } else if (needsDaily) {
          setDailyTreatOpen(true);
        }
        if (needsDaily) {
          setDailyTreatClaimed((c) => ({ ...c, [today]: true }));
        }
      }, 950);
    }
  };

  const resetApproval = () => {
    if (parentSession === "morning") setMorningApproved(false);
    else if (parentSession === "evening") setEveningApproved(false);
    else setHomeApproved(false);
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
    if (id === "timer") {
      goToTimer();
      return;
    }
    setScreen(id);
  };

  const goHome = () => {
    setScreen(getSessionScreen());
  };

  const addTask = (
    session: SessionId, title: string, emoji: string, scope: TaskScope, weekdays?: number[],
  ) => {
    if (!title.trim()) return;
    const base = session === "morning" ? morningTasks : session === "evening" ? eveningTasks : homeTasks;
    const setTasks = session === "morning" ? setMorningTasks : session === "evening" ? setEveningTasks : setHomeTasks;
    const maxId = base.reduce((m, t) => Math.max(m, t.id), 0);
    const task: Task = { id: maxId + 1, title: title.trim(), emoji, scope };
    if (scope === "regular") task.weekdays = normalizeWeekdaysForSave(weekdays ?? ALL_WEEKDAYS);
    setTasks([...base, task]);
  };

  const updateTask = (
    session: SessionId, id: number, title: string, emoji: string, weekdays?: number[],
  ) => {
    if (!title.trim()) return;
    const base = session === "morning" ? morningTasks : session === "evening" ? eveningTasks : homeTasks;
    const setTasks = session === "morning" ? setMorningTasks : session === "evening" ? setEveningTasks : setHomeTasks;
    setTasks(base.map((t) => {
      if (t.id !== id) return t;
      const updated: Task = { ...t, title: title.trim(), emoji };
      if (t.scope !== "today") {
        updated.weekdays = normalizeWeekdaysForSave(weekdays ?? ALL_WEEKDAYS);
      }
      return updated;
    }));
  };

  const clearBestTime = (session: SessionId, taskId: number) => {
    const key = taskTimeKey(session, taskId);
    setBestTimes((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const deleteTask = (session: SessionId, id: number) => {
    const base = session === "morning" ? morningTasks : session === "evening" ? eveningTasks : homeTasks;
    const setTasks = session === "morning" ? setMorningTasks : session === "evening" ? setEveningTasks : setHomeTasks;
    const setDone = session === "morning" ? setMorningDone : session === "evening" ? setEveningDone : setHomeDone;
    const setSkipped = session === "morning" ? setMorningSkipped : session === "evening" ? setEveningSkipped : setHomeSkipped;
    const doneSet = session === "morning" ? morningDone : session === "evening" ? eveningDone : homeDone;
    const skippedSet = session === "morning" ? morningSkipped : session === "evening" ? eveningSkipped : homeSkipped;
    setTasks(base.filter((t) => t.id !== id));
    const next = new Set(doneSet);
    next.delete(id);
    setDone(next);
    const nextSkipped = new Set(skippedSet);
    nextSkipped.delete(id);
    setSkipped(nextSkipped);
    const key = taskTimeKey(session, id);
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

  const skipTask = (
    session: SessionId,
    id: number,
    tasks: Task[],
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

    maybeCelebrate(session, tasks, nextDone, nextSkipped, label);
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
      {dailyTreatOpen && (
        <DailyTreatOverlay
          onClose={() => setDailyTreatOpen(false)}
          onCollect={collectSticker}
        />
      )}
      {weeklyRewardOpen && (
        <WeeklyRewardOverlay
          onClose={() => setWeeklyRewardOpen(false)}
          onCollect={collectSticker}
        />
      )}
      {stampVisible && screen === "show_parent" && (
        <HanamaruStamp key={stampKey} message={stampMessage} />
      )}

      {/* ── ハンバーガーボタン */}
      <button
        onClick={() => setShowMenu(true)}
        style={{
          position: "fixed", top: "max(env(safe-area-inset-top, 12px), 12px)", right: 16,
          zIndex: 80, width: 40, height: 40, borderRadius: 10,
          backgroundColor: theme.fill.secondary, border: `1px solid ${theme.stroke.secondary}`,
          cursor: "pointer", display: "flex", flexDirection: "column",
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
              paddingBottom: 24, gap: 0,
            }}
          >
            {/* メニューヘッダー */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px 20px" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: theme.text.primary }}>メニュー</span>
              <button onClick={() => setShowMenu(false)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: theme.text.tertiary, fontSize: 22, lineHeight: 1, padding: 4,
              }}>✕</button>
            </div>
            {/* メニュー項目 */}
            {[
              { icon: "🌅", label: "朝のタスク",    action: () => { setScreen("morning"); setShowMenu(false); } },
              { icon: "🏠", label: "帰宅後のタスク", action: () => { setScreen("home"); setShowMenu(false); } },
              { icon: "🌙", label: "夜のタスク",    action: () => { setScreen("evening"); setShowMenu(false); } },
              { icon: "📋", label: "タスク一覧", action: () => { setTaskListSession(getSessionScreen()); setScreen("task_list"); setShowMenu(false); } },
              { icon: "✅", label: "親チェック画面", action: () => { setScreen("show_parent"); setShowMenu(false); } },
              { icon: "⏱", label: "タイマー",
                action: () => {
                  if (approved) {
                    if (timerRunning) setScreen("timer");
                    else goToTimer();
                  } else {
                    setScreen("show_parent");
                  }
                  setShowMenu(false);
                },
              },
              { icon: "🔔", label: "アラーム設定", action: () => { setScreen("alarm_settings"); setShowMenu(false); } },
              { icon: "📅", label: "連続記録", action: () => { setScreen("record"); setShowMenu(false); } },
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
      )}

      {alarmRinging && alarmSoundBlocked && (
        <div
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

      <PullToRefresh
        className={shaking ? "phone-shake" : ""}
        disabled={anticipating || !!celebType || showMenu}
        style={{
          padding: "max(env(safe-area-inset-top, 16px), 16px) 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          pointerEvents: (anticipating || !!celebType) ? "none" : "auto",
        }}
      >
        {(screen === "morning" || screen === "evening" || screen === "home") && (
          <>
            <InAppTabs screen={screen} onSwitch={goToScreen} />
            {screen === "morning" && (
              <TaskScreen
                session="morning"
                label="朝のやること"
                timeLabel={`${dayLabel} 朝`}
                tasks={morningTasks}
                done={morningDone}
                skipped={morningSkipped}
                justChecked={justChecked}
                floatColor={floatColor}
                bestTimes={bestTimes}
                activeWorkTask={activeWorkTask}
                workTimerElapsed={workTimerElapsed}
                workTimerRunning={workTimerRunning}
                newRecordTaskId={newRecordTaskId}
                onReorder={setMorningTasks}
                onAddTask={(title, emoji, scope, weekdays) => addTask("morning", title, emoji, scope, weekdays)}
                onEditTask={(id, title, emoji, weekdays) => updateTask("morning", id, title, emoji, weekdays)}
                onDeleteTask={(id) => deleteTask("morning", id)}
                onSkipTask={(id) => skipTask("morning", id, morningTasks, morningDone, morningSkipped, setMorningDone, setMorningSkipped, "朝のやること")}
                onSelectTask={(id) => selectWorkTask("morning", id, morningDone, morningSkipped, setMorningDone)}
                onStartTimer={startWorkTimer}
                onPauseTimer={pauseWorkTimer}
                onCancelTask={cancelWorkTask}
                onCompleteTask={() => completeWorkTask("morning", morningTasks, morningDone, morningSkipped, setMorningDone, "朝のやること")}
                onClearBestTime={(id) => clearBestTime("morning", id)}
              />
            )}
            {screen === "home" && (
              <TaskScreen
                session="home"
                label="帰宅後のやること"
                timeLabel={`${dayLabel} 帰宅後`}
                tasks={homeTasks}
                done={homeDone}
                skipped={homeSkipped}
                justChecked={justChecked}
                floatColor={floatColor}
                bestTimes={bestTimes}
                activeWorkTask={activeWorkTask}
                workTimerElapsed={workTimerElapsed}
                workTimerRunning={workTimerRunning}
                newRecordTaskId={newRecordTaskId}
                onReorder={setHomeTasks}
                onAddTask={(title, emoji, scope, weekdays) => addTask("home", title, emoji, scope, weekdays)}
                onEditTask={(id, title, emoji, weekdays) => updateTask("home", id, title, emoji, weekdays)}
                onDeleteTask={(id) => deleteTask("home", id)}
                onSkipTask={(id) => skipTask("home", id, homeTasks, homeDone, homeSkipped, setHomeDone, setHomeSkipped, "帰宅後のやること")}
                onSelectTask={(id) => selectWorkTask("home", id, homeDone, homeSkipped, setHomeDone)}
                onStartTimer={startWorkTimer}
                onPauseTimer={pauseWorkTimer}
                onCancelTask={cancelWorkTask}
                onCompleteTask={() => completeWorkTask("home", homeTasks, homeDone, homeSkipped, setHomeDone, "帰宅後のやること")}
                onClearBestTime={(id) => clearBestTime("home", id)}
              />
            )}
            {screen === "evening" && (
              <TaskScreen
                session="evening"
                label="夜のやること"
                timeLabel={`${dayLabel} 夜`}
                tasks={eveningTasks}
                done={eveningDone}
                skipped={eveningSkipped}
                justChecked={justChecked}
                floatColor={floatColor}
                bestTimes={bestTimes}
                activeWorkTask={activeWorkTask}
                workTimerElapsed={workTimerElapsed}
                workTimerRunning={workTimerRunning}
                newRecordTaskId={newRecordTaskId}
                onReorder={setEveningTasks}
                onAddTask={(title, emoji, scope, weekdays) => addTask("evening", title, emoji, scope, weekdays)}
                onEditTask={(id, title, emoji, weekdays) => updateTask("evening", id, title, emoji, weekdays)}
                onDeleteTask={(id) => deleteTask("evening", id)}
                onSkipTask={(id) => skipTask("evening", id, eveningTasks, eveningDone, eveningSkipped, setEveningDone, setEveningSkipped, "夜のやること")}
                onSelectTask={(id) => selectWorkTask("evening", id, eveningDone, eveningSkipped, setEveningDone)}
                onStartTimer={startWorkTimer}
                onPauseTimer={pauseWorkTimer}
                onCancelTask={cancelWorkTask}
                onCompleteTask={() => completeWorkTask("evening", eveningTasks, eveningDone, eveningSkipped, setEveningDone, "夜のやること")}
                onClearBestTime={(id) => clearBestTime("evening", id)}
              />
            )}
          </>
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
            paused={timerPaused}
            timerRunning={timerRunning}
            timerDuration={timerDuration}
            onSetDuration={setTimerDurationOnly}
            onStart={() => startTimer(timerDuration)}
            onPause={pauseTimer}
            onResume={resumeTimer}
            onCancel={cancelTimer}
            onBack={() => setScreen(prevScreen)}
            onHome={goHome}
          />
        )}

        {screen === "timer_end" && (
          <TimerEndScreen
            streak={streak}
            alarmRinging={alarmRinging}
            onStopAlarm={stopAlarmNow}
            onBack={() => setScreen(prevScreen)}
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
            homeTasks={homeTasks}
            eveningTasks={eveningTasks}
            onSwitchSession={setTaskListSession}
            onBack={goHome}
            onEditTask={(sess, id, title, emoji, weekdays) => updateTask(sess, id, title, emoji, weekdays)}
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
      </PullToRefresh>
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
  return (
    <div
      onClick={onBack}
      style={{
        display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
        color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      もどる
    </div>
  );
}

function SessionTabs({ session, onSwitch }: { session: SessionId; onSwitch: (s: SessionId) => void }) {
  const tabs: { id: SessionId; label: string }[] = [
    { id: "morning", label: "☀️ 朝" },
    { id: "home",    label: "🏠 帰宅後" },
    { id: "evening", label: "🌙 夜" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, padding: "2px 0 4px" }}>
      {tabs.map((t) => {
        const active = session === t.id;
        return (
          <button key={t.id} type="button" onClick={() => onSwitch(t.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: active ? 800 : 600, fontSize: 12,
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

function TaskListScreen({
  session, morningTasks, homeTasks, eveningTasks,
  onSwitchSession, onBack, onEditTask,
}: {
  session: SessionId;
  morningTasks: Task[];
  homeTasks: Task[];
  eveningTasks: Task[];
  onSwitchSession: (s: SessionId) => void;
  onBack: () => void;
  onEditTask: (session: SessionId, id: number, title: string, emoji: string, weekdays?: number[]) => void;
}) {
  const [filterDow, setFilterDow] = useState<number | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);

  const allTasks = session === "morning" ? morningTasks : session === "home" ? homeTasks : eveningTasks;
  const filteredTasks = allTasks.filter((t) => taskMatchesWeekdayFilter(t, filterDow));
  const editingTask = editingTaskId !== null ? allTasks.find((t) => t.id === editingTaskId) : null;
  const todayVisibleCount = visibleTasks(allTasks).length;

  const summaryText = filterDow === null
    ? `${allTasks.length}件登録 · きょう ${todayVisibleCount}件`
    : `${filteredTasks.length}件 · ${WEEKDAY_LABELS[filterDow]}曜のタスク`;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: "80vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <BackLink onBack={onBack} />
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>タスク一覧</div>
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
              const visibleToday = isTaskVisibleToday(task);
              const showRestBadge = filterDow === null && !visibleToday;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setEditingTaskId(task.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "13px 14px", borderRadius: 14, border: `1.5px solid ${theme.stroke.tertiary}`,
                    backgroundColor: theme.fill.quaternary, cursor: "pointer",
                    textAlign: "left", width: "100%", fontFamily: "inherit",
                    opacity: showRestBadge ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{task.emoji}</span>
                  <span style={{
                    fontSize: 15, fontWeight: 600, flex: 1, color: theme.text.primary,
                  }}>
                    {task.title}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                    color: theme.category.purple,
                    backgroundColor: `${theme.category.purple}18`,
                    padding: "2px 6px", borderRadius: 6,
                  }}>
                    {taskScheduleBadge(task)}
                  </span>
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
              );
            })}
          </div>
        )}
      </div>

      {editingTask && (
        <div
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
              initialWeekdays={editingTask.weekdays ?? ALL_WEEKDAYS}
              showWeekdays={(editingTask.scope ?? "regular") !== "today"}
              saveLabel="保存する"
              autoFocus={false}
              onSave={(title, emoji, weekdays) => {
                onEditTask(session, editingTask.id, title, emoji, weekdays);
                setEditingTaskId(null);
              }}
              onCancel={() => setEditingTaskId(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function InAppTabs({ screen, onSwitch }: { screen: ScreenId; onSwitch: (s: ScreenId) => void }) {
  const tabs: { id: ScreenId; label: string }[] = [
    { id: "morning", label: "☀️ 朝" },
    { id: "home",    label: "🏠 帰宅後" },
    { id: "evening", label: "🌙 夜" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, padding: "2px 0 4px" }}>
      {tabs.map((t) => {
        const active = screen === t.id;
        return (
          <button key={t.id} onClick={() => onSwitch(t.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: active ? 800 : 600, fontSize: 12,
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

function TaskEditForm({
  header, initialTitle, initialEmoji, saveLabel, onSave, onCancel, autoFocus = true,
  showWeekdays = false, initialWeekdays,
}: {
  header?: string;
  initialTitle: string;
  initialEmoji: string;
  saveLabel: string;
  onSave: (title: string, emoji: string, weekdays?: number[]) => void;
  onCancel: () => void;
  autoFocus?: boolean;
  showWeekdays?: boolean;
  initialWeekdays?: number[];
}) {
  const [title, setTitle] = useState(initialTitle);
  const [emoji, setEmoji] = useState(initialEmoji);
  const [weekdays, setWeekdays] = useState<number[]>(initialWeekdays ?? ALL_WEEKDAYS);
  const [weekdayError, setWeekdayError] = useState(false);

  useEffect(() => {
    setTitle(initialTitle);
    setEmoji(initialEmoji);
    setWeekdays(initialWeekdays ?? ALL_WEEKDAYS);
    setWeekdayError(false);
  }, [initialTitle, initialEmoji, initialWeekdays]);

  const handleSave = () => {
    if (!title.trim()) return;
    if (showWeekdays && weekdays.length === 0) {
      setWeekdayError(true);
      return;
    }
    setWeekdayError(false);
    onSave(title, emoji, showWeekdays ? weekdays : undefined);
  };

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
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {QUICK_EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => setEmoji(e)} style={{
            width: 36, height: 36, borderRadius: 8,
            border: emoji === e ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.secondary}`,
            backgroundColor: emoji === e ? `${theme.accent.primary}18` : theme.fill.secondary,
            fontSize: 20, cursor: "pointer", padding: 0,
          }}>{e}</button>
        ))}
      </div>
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
  label: string; timeLabel: string;
  tasks: Task[]; done: Set<number>; skipped: Set<number>; justChecked: number | null;
  floatColor: string;
  bestTimes: Record<string, number>;
  activeWorkTask: ActiveWorkTask | null;
  workTimerElapsed: number;
  workTimerRunning: boolean;
  newRecordTaskId: number | null;
  onReorder: (tasks: Task[]) => void;
  onAddTask: (title: string, emoji: string, scope: TaskScope, weekdays?: number[]) => void;
  onEditTask: (id: number, title: string, emoji: string, weekdays?: number[]) => void;
  onDeleteTask: (id: number) => void;
  onSkipTask: (id: number) => void;
  onSelectTask: (id: number) => void;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onCancelTask: () => void;
  onCompleteTask: () => void;
  onClearBestTime: (id: number) => void;
}

function TaskScreen({
  session, label, timeLabel, tasks, done, skipped, justChecked, floatColor,
  bestTimes, activeWorkTask, workTimerElapsed, workTimerRunning, newRecordTaskId,
  onReorder, onAddTask, onEditTask, onDeleteTask, onSkipTask, onSelectTask, onStartTimer, onPauseTimer, onCancelTask, onCompleteTask,
  onClearBestTime,
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

  const shownTasks = visibleTasks(tasks);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = shownTasks.findIndex((t) => t.id === active.id);
      const newIdx = shownTasks.findIndex((t) => t.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      onReorder(reorderVisibleInAll(tasks, arrayMove(shownTasks, oldIdx, newIdx)));
    }
  };

  const handleAdd = (title: string, emoji: string, weekdays?: number[]) => {
    onAddTask(title, emoji, addMode, weekdays);
    setIsAdding(false);
  };

  const startAdding = (mode: TaskScope) => {
    setAddMode(mode);
    setIsAdding(true);
  };

  const handleLongPress = (taskId: number) => {
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

      <StepProgress tasks={shownTasks} done={done} skipped={skipped} justChecked={justChecked} />
      <BestTimeSummary session={session} tasks={shownTasks} bestTimes={bestTimes} />
      <div style={{ height: 1, backgroundColor: theme.stroke.tertiary }} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={shownTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {shownTasks.map((task) => {
              const isActive = activeWorkTask?.session === session && activeWorkTask.taskId === task.id;
              const isSkipped = skipped.has(task.id);
              const swipeMode = openSwipe?.id === task.id ? openSwipe.mode : null;
              return (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  isDone={done.has(task.id)}
                  isSkipped={isSkipped}
                  isJustChecked={justChecked === task.id}
                  isActive={isActive}
                  isNewRecord={newRecordTaskId === task.id}
                  floatColor={floatColor}
                  bestTime={bestTimes[taskTimeKey(session, task.id)]}
                  liveElapsed={isActive ? workTimerElapsed : undefined}
                  timerRunning={isActive && workTimerRunning}
                  swipeMode={swipeMode}
                  onSwipeOpen={(mode) => setOpenSwipe({ id: task.id, mode })}
                  onSwipeClose={() => setOpenSwipe(null)}
                  onSelect={() => onSelectTask(task.id)}
                  onDelete={() => { onDeleteTask(task.id); setOpenSwipe(null); }}
                  onSkip={() => { onSkipTask(task.id); setOpenSwipe(null); }}
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

      {/* タスク追加エリア */}
      {isAdding ? (
        <TaskEditForm
          key={`add-${addMode}`}
          header={addMode === "today" ? "きょうだけのタスク" : "レギュラータスク"}
          initialTitle=""
          initialEmoji="📝"
          saveLabel="追加する"
          showWeekdays={addMode === "regular"}
          onSave={handleAdd}
          onCancel={() => setIsAdding(false)}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
              initialWeekdays={editingTask.weekdays ?? ALL_WEEKDAYS}
              showWeekdays={(editingTask.scope ?? "regular") !== "today"}
              saveLabel="保存する"
              autoFocus={false}
              onSave={(title, emoji, weekdays) => {
                onEditTask(editingTask.id, title, emoji, weekdays);
                setEditingTaskId(null);
              }}
              onCancel={() => setEditingTaskId(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── Sortable Task Row ─────────────────────────────────

const SWIPE_DELETE_WIDTH = 72;
const SWIPE_SKIP_WIDTH = 80;
const LONG_PRESS_MS = 500;

const addBtnStyle: CSSProperties = {
  width: "100%", padding: "11px", borderRadius: 12,
  border: `1.5px dashed ${theme.stroke.secondary}`, backgroundColor: "transparent",
  color: theme.text.tertiary, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
};

interface TaskRowProps {
  task: Task; isDone: boolean; isSkipped: boolean; isJustChecked: boolean; isActive: boolean; isNewRecord: boolean;
  floatColor: string; bestTime?: number; liveElapsed?: number; timerRunning: boolean;
  onSelect: () => void; onDelete: () => void; onSkip: () => void; onLongPress: () => void;
  swipeMode: SwipeMode | null; onSwipeOpen: (mode: SwipeMode) => void; onSwipeClose: () => void;
  onStartTimer: () => void; onPauseTimer: () => void; onCancelTask: () => void; onCompleteTask: () => void;
  confirmDeleteTime: boolean;
  onTimeBadgeTap: () => void; onConfirmDeleteTime: () => void; onCancelDeleteTime: () => void;
}

function swipeSnapOffset(mode: SwipeMode | null) {
  if (mode === "delete") return -SWIPE_DELETE_WIDTH;
  if (mode === "skip") return SWIPE_SKIP_WIDTH;
  return 0;
}

function SortableTaskRow(props: TaskRowProps) {
  const {
    swipeMode, onSwipeOpen, onSwipeClose, onSelect, onDelete, onSkip, onLongPress, isSkipped,
    onStartTimer, onPauseTimer, onCancelTask, onCompleteTask, isActive, liveElapsed, timerRunning,
    confirmDeleteTime, onTimeBadgeTap, onConfirmDeleteTime, onCancelDeleteTime,
    ...rowProps
  } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  const swipeRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({ startX: 0, startY: 0, startOffset: 0, swiping: false, moved: false, lastOffset: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const snapOffset = swipeSnapOffset(swipeMode);
  const displayX = dragging ? offsetX : snapOffset;

  const clampOffset = (v: number) => Math.min(SWIPE_SKIP_WIDTH, Math.max(-SWIPE_DELETE_WIDTH, v));

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPressTimer(), []);

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const blockScroll = (e: TouchEvent) => {
      if (gesture.current.swiping) e.preventDefault();
    };
    el.addEventListener("touchmove", blockScroll, { passive: false });
    return () => el.removeEventListener("touchmove", blockScroll);
  }, []);

  const beginGesture = (clientX: number, clientY: number) => {
    clearLongPressTimer();
    const startOffset = swipeSnapOffset(swipeMode);
    gesture.current = { startX: clientX, startY: clientY, startOffset, swiping: false, moved: false, lastOffset: startOffset };
    setDragging(true);
    setOffsetX(startOffset);
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      gesture.current.moved = true;
      navigator.vibrate?.(10);
      onLongPress();
    }, LONG_PRESS_MS);
  };

  const moveGesture = (clientX: number, clientY: number) => {
    const g = gesture.current;
    const dx = clientX - g.startX;
    const dy = clientY - g.startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPressTimer();
    if (!g.swiping && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      g.swiping = true;
    }
    if (!g.swiping) return;
    if (Math.abs(dx) > 8) g.moved = true;
    g.lastOffset = clampOffset(g.startOffset + dx);
    setOffsetX(g.lastOffset);
  };

  const endGesture = () => {
    clearLongPressTimer();
    const g = gesture.current;
    setDragging(false);
    if (!g.swiping) return;
    if (g.lastOffset > SWIPE_SKIP_WIDTH / 2) onSwipeOpen("skip");
    else if (g.lastOffset < -SWIPE_DELETE_WIDTH / 2) onSwipeOpen("delete");
    else onSwipeClose();
  };

  const handleSelect = () => {
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
        {...attributes}
        {...listeners}
        style={{
          flexShrink: 0, width: 22, display: "flex", justifyContent: "center", alignItems: "center",
          cursor: "grab", color: theme.text.tertiary, fontSize: 18,
          userSelect: "none", touchAction: "none",
        }}
      >
        ⠿
      </div>
      <div
        ref={swipeRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", borderRadius: 14, touchAction: "pan-y" }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSkip(); }}
          aria-label={isSkipped ? "保留をもどす" : "タスクを保留"}
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0, width: SWIPE_SKIP_WIDTH,
            border: "none", cursor: "pointer",
            backgroundColor: theme.category.orange,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 2, padding: 0, color: "#fff", fontSize: 11, fontWeight: 800,
          }}
        >
          <span style={{ fontSize: 18 }}>{isSkipped ? "↩" : "⏭"}</span>
          {isSkipped ? "もどす" : "保留"}
        </button>
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
          style={{
            transform: `translateX(${displayX}px)`,
            transition: dragging ? "none" : "transform 0.22s ease-out",
            backgroundColor: theme.bg.editor,
            position: "relative", zIndex: 1,
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            beginGesture(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            moveGesture(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (!dragging) return;
            endGesture();
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => {
            if (!dragging) return;
            endGesture();
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
        >
          <TaskRow
            {...rowProps}
            isSkipped={isSkipped}
            isActive={isActive}
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
  task, isDone, isSkipped, isJustChecked, isActive, isNewRecord, floatColor, bestTime, liveElapsed, onSelect,
  confirmDeleteTime, onTimeBadgeTap, onConfirmDeleteTime, onCancelDeleteTime,
}: Pick<TaskRowProps, "task" | "isDone" | "isSkipped" | "isJustChecked" | "isActive" | "isNewRecord" | "floatColor" | "bestTime" | "liveElapsed" | "confirmDeleteTime"> & {
  onSelect: () => void;
  onTimeBadgeTap: () => void; onConfirmDeleteTime: () => void; onCancelDeleteTime: () => void;
}) {
  const resolved = isDone || isSkipped;
  const canTap = !isSkipped;

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
            保留
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
  secondsLeft, totalSeconds, paused, timerRunning, timerDuration,
  onSetDuration, onStart, onPause, onResume, onCancel, onBack, onHome,
}: {
  secondsLeft: number;
  totalSeconds: number;
  paused: boolean;
  timerRunning: boolean;
  timerDuration: number;
  onSetDuration: (m: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onBack: () => void;
  onHome: () => void;
}) {
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
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          もどる
        </div>
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
  streak, alarmRinging, onStopAlarm, onBack, onHome,
}: {
  streak: number; alarmRinging: boolean;
  onStopAlarm: () => void; onBack: () => void; onHome: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 20, textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          もどる
        </div>
        <div onClick={onHome} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L8 2L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6V13H12V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ホーム
        </div>
      </div>

      <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.fill.secondary, border: `3px solid ${theme.stroke.primary}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <rect x="9" y="7" width="4" height="16" rx="2" fill={theme.text.secondary} />
          <rect x="17" y="7" width="4" height="16" rx="2" fill={theme.text.secondary} />
        </svg>
      </div>

      <div>
        <div style={{ fontSize: 24, fontWeight: 800, color: theme.text.primary, marginBottom: 6 }}>おわったよ！</div>
        <div style={{ fontSize: 14, color: theme.text.secondary }}>きょうもよくがんばった</div>
      </div>

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
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          もどる
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>アラーム設定</div>
      </div>
      <div style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.6 }}>
        タイマー終了時に鳴る音と振動の設定です。親が設定してね。
      </div>
      <AlarmSettingsPanel settings={settings} onChange={onChange} onTest={onTest} />
    </div>
  );
}
