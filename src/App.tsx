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
import { RecordScreen, getStreak } from "./RecordCalendar";

// ── Types & Data ──────────────────────────────────────

type ScreenId  = "morning" | "evening" | "show_parent" | "timer" | "timer_end" | "alarm_settings" | "record";
type CelebType = "confetti" | "burst" | "stripes" | "bars" | "diagonal";
type TaskScope = "regular" | "today";

interface Task { id: number; title: string; emoji: string; scope?: TaskScope; }

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

interface DayHistory { morning: boolean; evening: boolean; }

interface StoredState {
  date: string;
  morningDone: number[];
  eveningDone: number[];
  morningApproved: boolean;
  eveningApproved: boolean;
  morningTasks: Task[];
  eveningTasks: Task[];
  history: Record<string, DayHistory>;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((t) => ({ ...t, scope: t.scope ?? "regular" }));
}

function stripTodayTasks(tasks: Task[]): Task[] {
  return normalizeTasks(tasks).filter((t) => t.scope !== "today");
}

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data: StoredState = JSON.parse(raw);
      if (data.date === todayKey()) {
        return {
          ...data,
          morningTasks: normalizeTasks(data.morningTasks ?? MORNING_TASKS_DEFAULT),
          eveningTasks: normalizeTasks(data.eveningTasks ?? EVENING_TASKS_DEFAULT),
        };
      }
      return {
        ...data,
        date: todayKey(),
        morningDone: [],
        eveningDone: [],
        morningApproved: false,
        eveningApproved: false,
        morningTasks: stripTodayTasks(data.morningTasks ?? MORNING_TASKS_DEFAULT),
        eveningTasks: stripTodayTasks(data.eveningTasks ?? EVENING_TASKS_DEFAULT),
      };
    }
  } catch { /* ignore */ }
  return {
    date: todayKey(),
    morningDone: [],
    eveningDone: [],
    morningApproved: false,
    eveningApproved: false,
    morningTasks: MORNING_TASKS_DEFAULT,
    eveningTasks: EVENING_TASKS_DEFAULT,
    history: {},
  };
}

function getInitialScreen(): ScreenId {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? "morning" : "evening";
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
  const [morningDone,    setMorningDone]    = useState<Set<number>>(new Set(stored.morningDone));
  const [eveningDone,    setEveningDone]    = useState<Set<number>>(new Set(stored.eveningDone));
  const [morningApproved, setMorningApproved] = useState(stored.morningApproved);
  const [eveningApproved, setEveningApproved] = useState(stored.eveningApproved);
  const [history,        setHistory]        = useState<Record<string, DayHistory>>(stored.history ?? {});

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
  const [parentSession, setParentSession] = useState<"morning" | "evening">("morning");
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
  const approved   = parentSession === "morning" ? morningApproved : eveningApproved;

  // ── localStorage save ──
  useEffect(() => {
    const state: StoredState = {
      date: todayKey(),
      morningDone:    [...morningDone],
      eveningDone:    [...eveningDone],
      morningApproved,
      eveningApproved,
      morningTasks,
      eveningTasks,
      history,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [morningDone, eveningDone, morningApproved, eveningApproved, morningTasks, eveningTasks, history]);

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
    session: "morning" | "evening",
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

  const handleApprove = () => {
    if (approved) return;
    const today = todayKey();
    const prev = history[today] ?? { morning: false, evening: false };
    if (parentSession === "morning") {
      setMorningApproved(true);
      setHistory({ ...history, [today]: { ...prev, morning: true } });
    } else {
      setEveningApproved(true);
      setHistory({ ...history, [today]: { ...prev, evening: true } });
    }
    triggerStamp();
  };

  const resetApproval = () => {
    if (parentSession === "morning") setMorningApproved(false);
    else setEveningApproved(false);
    setStampVisible(false);
  };

  const handleToggle = (
    done: Set<number>,
    setDone: (s: Set<number>) => void,
    tasks: Task[],
    label: string,
    session: "morning" | "evening",
    id: number,
  ) => {
    if (celebType || anticipating) return;
    const next = new Set(done);
    const adding = !next.has(id);
    adding ? next.add(id) : next.delete(id);
    setDone(next);
    if (adding) {
      setFloatColor(FLOAT_COLORS[Math.floor(Math.random() * FLOAT_COLORS.length)]);
      setJustChecked(id);
      setTimeout(() => setJustChecked(null), 1350);
      if (next.size === tasks.length) {
        setAnticipating(true);
        setTimeout(
          () => fireCelebration({ label, taskNames: tasks.map((t) => t.title) }, session),
          750,
        );
      }
    }
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
    const h = new Date().getHours();
    setScreen(h >= 5 && h < 12 ? "morning" : "evening");
  };

  const addTask = (session: "morning" | "evening", title: string, emoji: string, scope: TaskScope) => {
    if (!title.trim()) return;
    const base = session === "morning" ? morningTasks : eveningTasks;
    const setTasks = session === "morning" ? setMorningTasks : setEveningTasks;
    const maxId = base.reduce((m, t) => Math.max(m, t.id), 0);
    setTasks([...base, { id: maxId + 1, title: title.trim(), emoji, scope }]);
  };

  const deleteTask = (session: "morning" | "evening", id: number) => {
    const base = session === "morning" ? morningTasks : eveningTasks;
    const setTasks = session === "morning" ? setMorningTasks : setEveningTasks;
    const setDone = session === "morning" ? setMorningDone : setEveningDone;
    const doneSet = session === "morning" ? morningDone : eveningDone;
    setTasks(base.filter((t) => t.id !== id));
    const next = new Set(doneSet);
    next.delete(id);
    setDone(next);
  };

  const dayLabel = getDayLabel();

  return (
    <div style={{ width: "100%", minHeight: "100dvh", backgroundColor: theme.bg.editor, position: "relative", overflow: "hidden" }}>
      <AnimStyles />

      {anticipating && <AnticipationOverlay />}
      {celebType && <CelebrationOverlay key={celebKey} type={celebType} celebKey={celebKey} />}
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
              { icon: "🌙", label: "夜のタスク",    action: () => { setScreen("evening"); setShowMenu(false); } },
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
              { icon: "📅", label: "れんぞくきろく", action: () => { setScreen("record"); setShowMenu(false); } },
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
        {(screen === "morning" || screen === "evening") && (
          <>
            <InAppTabs screen={screen} onSwitch={goToScreen} />
            {screen === "morning" && (
              <TaskScreen
                label="朝のやること"
                timeLabel={`${dayLabel} 朝`}
                tasks={morningTasks}
                done={morningDone}
                justChecked={justChecked}
                floatColor={floatColor}
                onReorder={setMorningTasks}
                onAddTask={(title, emoji, scope) => addTask("morning", title, emoji, scope)}
                onDeleteTask={(id) => deleteTask("morning", id)}
                toggle={(id) =>
                  handleToggle(morningDone, setMorningDone, morningTasks, "朝のやること", "morning", id)
                }
              />
            )}
            {screen === "evening" && (
              <TaskScreen
                label="夜のやること"
                timeLabel={`${dayLabel} 夜`}
                tasks={eveningTasks}
                done={eveningDone}
                justChecked={justChecked}
                floatColor={floatColor}
                onReorder={setEveningTasks}
                onAddTask={(title, emoji, scope) => addTask("evening", title, emoji, scope)}
                onDeleteTask={(id) => deleteTask("evening", id)}
                toggle={(id) =>
                  handleToggle(eveningDone, setEveningDone, eveningTasks, "夜のやること", "evening", id)
                }
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
          <RecordScreen history={history} streak={streak} onBack={goHome} />
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

function StepProgress({ tasks, done, justChecked }: { tasks: Task[]; done: Set<number>; justChecked: number | null }) {
  const total      = tasks.length;
  const doneCount  = done.size;
  const allDone    = doneCount === total;
  const activeIdx  = tasks.findIndex((t) => !done.has(t.id));
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
          const isDone   = done.has(task.id);
          const isActive = idx === activeIdx;
          const isJust   = justChecked === task.id;
          const isFuture = !isDone && !isActive;
          const prevDone = idx > 0 && done.has(tasks[idx - 1].id);
          return (
            <div key={task.id} style={{ display: "flex", alignItems: "center" }}>
              {idx > 0 && (
                <div style={{
                  width: lineW, height: 3, borderRadius: 2, flexShrink: 0,
                  backgroundColor: isDone || (isActive && prevDone) ? theme.category.green : theme.fill.secondary,
                }} />
              )}
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div
                  className={isJust ? "step-just" : isActive ? "step-active" : ""}
                  style={{
                    width: circleSize, height: circleSize, borderRadius: circleSize / 2,
                    backgroundColor: isDone ? theme.category.green : isActive ? theme.accent.primary : "transparent",
                    border: isFuture ? `2px solid ${theme.stroke.secondary}` : isActive ? `2px solid ${theme.accent.primary}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", zIndex: 1,
                  }}
                >
                  {isDone ? (
                    <svg width={iconSize} height={iconSize * 0.82} viewBox="0 0 12 10" fill="none">
                      <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
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

// ── InApp Tabs ────────────────────────────────────────

function InAppTabs({ screen, onSwitch }: { screen: ScreenId; onSwitch: (s: ScreenId) => void }) {
  const tabs: { id: ScreenId; label: string }[] = [
    { id: "morning", label: "☀️ 朝" },
    { id: "evening", label: "🌙 夜" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, padding: "2px 0 4px" }}>
      {tabs.map((t) => {
        const active = screen === t.id;
        return (
          <button key={t.id} onClick={() => onSwitch(t.id)} style={{
            flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
            fontWeight: active ? 800 : 600, fontSize: 14,
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

// ── Task Screen ───────────────────────────────────────

interface TaskScreenProps {
  label: string; timeLabel: string;
  tasks: Task[]; done: Set<number>; justChecked: number | null;
  floatColor: string;
  onReorder: (tasks: Task[]) => void;
  onAddTask: (title: string, emoji: string, scope: TaskScope) => void;
  onDeleteTask: (id: number) => void;
  toggle: (id: number) => void;
}

function TaskScreen({ label, timeLabel, tasks, done, justChecked, floatColor, onReorder, onAddTask, onDeleteTask, toggle }: TaskScreenProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<TaskScope>("today");
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("📝");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = tasks.findIndex((t) => t.id === active.id);
      const newIdx = tasks.findIndex((t) => t.id === over.id);
      onReorder(arrayMove(tasks, oldIdx, newIdx));
    }
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAddTask(newTitle, newEmoji, addMode);
    setNewTitle("");
    setNewEmoji("📝");
    setIsAdding(false);
  };

  const startAdding = (mode: TaskScope) => {
    setAddMode(mode);
    setIsAdding(true);
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

      <StepProgress tasks={tasks} done={done} justChecked={justChecked} />
      <div style={{ height: 1, backgroundColor: theme.stroke.tertiary }} />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {tasks.map((task) => (
              <SortableTaskRow
                key={task.id}
                task={task}
                isDone={done.has(task.id)}
                isJustChecked={justChecked === task.id}
                floatColor={floatColor}
                onToggle={() => toggle(task.id)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* タスク追加エリア */}
      {isAdding ? (
        <div style={{ padding: "10px 12px", borderRadius: 14, border: `1.5px solid ${theme.accent.primary}44`, backgroundColor: `${theme.accent.primary}08`, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary }}>
            {addMode === "today" ? "きょうだけのタスク" : "レギュラータスク"}
          </div>
          {/* 絵文字選択 */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUICK_EMOJIS.map((e) => (
              <button key={e} onClick={() => setNewEmoji(e)} style={{
                width: 36, height: 36, borderRadius: 8, border: newEmoji === e ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.secondary}`,
                backgroundColor: newEmoji === e ? `${theme.accent.primary}18` : theme.fill.secondary,
                fontSize: 20, cursor: "pointer", padding: 0,
              }}>{e}</button>
            ))}
          </div>
          {/* タイトル入力 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>{newEmoji}</span>
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="タスク名を入力..."
              style={{
                flex: 1, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${theme.stroke.secondary}`,
                fontSize: 15, outline: "none", backgroundColor: theme.bg.editor, color: theme.text.primary,
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleAdd} style={{
              flex: 2, padding: "10px", borderRadius: 10, border: "none",
              backgroundColor: theme.accent.primary, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>追加する</button>
            <button onClick={() => { setIsAdding(false); setNewTitle(""); }} style={{
              flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${theme.stroke.secondary}`,
              backgroundColor: "transparent", color: theme.text.tertiary, fontSize: 13, cursor: "pointer",
            }}>キャンセル</button>
          </div>
        </div>
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
    </>
  );
}

// ── Sortable Task Row ─────────────────────────────────

const addBtnStyle: CSSProperties = {
  width: "100%", padding: "11px", borderRadius: 12,
  border: `1.5px dashed ${theme.stroke.secondary}`, backgroundColor: "transparent",
  color: theme.text.tertiary, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
};

interface TaskRowProps {
  task: Task; isDone: boolean; isJustChecked: boolean;
  floatColor: string; onToggle: () => void; onDelete: () => void;
}

function SortableTaskRow(props: TaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        transform: DndCSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : "auto",
      }}
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          flexShrink: 0, width: 22, display: "flex", justifyContent: "center",
          cursor: "grab", color: theme.text.tertiary, fontSize: 18,
          userSelect: "none", touchAction: "none", paddingTop: 2,
        }}
      >
        ⠿
      </div>
      <div style={{ flex: 1 }}>
        <TaskRow {...props} />
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); props.onDelete(); }}
        aria-label="タスクを削除"
        style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 8, border: "none",
          backgroundColor: "transparent", color: theme.text.tertiary, cursor: "pointer",
          fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        ✕
      </button>
    </div>
  );
}

function TaskRow({ task, isDone, isJustChecked, floatColor, onToggle }: TaskRowProps) {
  return (
    <div
      onClick={onToggle}
      className={isJustChecked ? "row-glow" : ""}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 14px", borderRadius: 14,
        backgroundColor: isDone ? `${theme.category.green}16` : theme.fill.quaternary,
        cursor: "pointer",
        border: `1.5px solid ${isDone ? `${theme.category.green}44` : theme.stroke.tertiary}`,
        position: "relative", overflow: "visible",
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1, filter: isDone ? "grayscale(40%)" : "none", transition: "filter 0.3s" }}>
        {task.emoji}
      </span>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div
          className={isJustChecked ? "check-pop" : ""}
          style={{
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: isDone ? theme.category.green : "transparent",
            border: isDone ? "none" : `2px solid ${theme.stroke.primary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {isDone && (
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M1.5 6L5.5 10L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
        fontSize: 15, fontWeight: isDone ? 400 : 600, flex: 1,
        color: isDone ? theme.text.tertiary : theme.text.primary,
        textDecoration: isDone ? "line-through" : "none",
      }}>
        {task.title}
        {task.scope === "today" && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 700, color: theme.accent.primary,
            backgroundColor: `${theme.accent.primary}18`, padding: "2px 6px", borderRadius: 6,
          }}>
            きょう
          </span>
        )}
      </span>
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
