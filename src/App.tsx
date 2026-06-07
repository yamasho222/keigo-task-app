import { useState, useEffect, type CSSProperties } from "react";
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

// ── Types & Data ──────────────────────────────────────

type ScreenId  = "morning" | "evening" | "show_parent" | "timer" | "timer_end";
type CelebType = "confetti" | "burst" | "stripes" | "bars" | "diagonal";

interface Task { id: number; title: string; emoji: string; }

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

const WEEK_DAYS   = ["月", "火", "水", "木", "金", "土", "日"];
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

function loadStoredState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data: StoredState = JSON.parse(raw);
      if (data.date === todayKey()) return data;
      return {
        ...data,
        date: todayKey(),
        morningDone: [],
        eveningDone: [],
        morningApproved: false,
        eveningApproved: false,
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

function getWeekStamps(history: Record<string, DayHistory>): boolean[] {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const day = history[d.toISOString().slice(0, 10)];
    return day ? (day.morning || day.evening) : false;
  });
}

function getStreak(history: Record<string, DayHistory>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = history[d.toISOString().slice(0, 10)];
    if (day && (day.morning || day.evening)) streak++;
    else break;
  }
  return streak;
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

// ── Audio Alarm ───────────────────────────────────────

function playAlarm() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    [[0, 880], [0.55, 1100], [1.1, 880], [1.65, 1320]].forEach(([t, freq]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + t + 0.45);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.5);
    });
  } catch { /* 音声未対応環境では無視 */ }
}

const QUICK_EMOJIS = ["📝", "✏️", "🎯", "⭐", "🎮", "📱", "🎵", "🏃", "🍽️", "🛒", "💊", "🐾"];

// ── Main ──────────────────────────────────────────────

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
  const [parentSession, setParentSession] = useState<"morning" | "evening">("morning");
  const [parentCtx, setParentCtx] = useState<{ label: string; taskNames: string[]; completedAt: string }>({
    label: "朝のやること",
    taskNames: MORNING_TASKS_DEFAULT.map((t) => t.title),
    completedAt: "",
  });
  const [timerSeconds, setTimerSeconds] = useState(20 * 60);
  const [timerDuration, setTimerDuration] = useState(20); // 分単位

  // ── computed ──
  const weekStamps = getWeekStamps(history);
  const streak     = getStreak(history);
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

  // ── timer countdown ──
  useEffect(() => {
    if (screen !== "timer") return;
    const id = setInterval(() => {
      setTimerSeconds((s) => {
        if (s <= 1) {
          setTimeout(() => { playAlarm(); setScreen("timer_end"); }, 0);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [screen]);

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

  const goToScreen = (id: ScreenId) => {
    if (id === "timer") {
      setPrevScreen(screen);
      setTimerSeconds(timerDuration * 60);
    }
    setScreen(id);
  };

  const goHome = () => {
    const h = new Date().getHours();
    setScreen(h >= 5 && h < 12 ? "morning" : "evening");
  };

  const addTask = (session: "morning" | "evening", title: string, emoji: string) => {
    if (!title.trim()) return;
    const base = session === "morning" ? morningTasks : eveningTasks;
    const setTasks = session === "morning" ? setMorningTasks : setEveningTasks;
    const maxId = base.reduce((m, t) => Math.max(m, t.id), 0);
    setTasks([...base, { id: maxId + 1, title: title.trim(), emoji }]);
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

      <div
        className={shaking ? "phone-shake" : ""}
        style={{
          minHeight: "100dvh",
          overflowY: "auto",
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
                stamps={weekStamps}
                streak={streak}
                onReorder={setMorningTasks}
                onAddTask={(title, emoji) => addTask("morning", title, emoji)}
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
                stamps={weekStamps}
                streak={streak}
                onReorder={setEveningTasks}
                onAddTask={(title, emoji) => addTask("evening", title, emoji)}
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
            onGoTimer={() => goToScreen("timer")}
            onHome={goHome}
          />
        )}

        {screen === "timer" && (
          <TimerScreen
            secondsLeft={timerSeconds}
            onBack={() => setScreen(prevScreen)}
            onHome={goHome}
          />
        )}

        {screen === "timer_end" && (
          <TimerEndScreen
            streak={streak}
            stamps={weekStamps}
            onBack={() => setScreen(prevScreen)}
            onHome={goHome}
          />
        )}
      </div>
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

// ── Week Stamps ───────────────────────────────────────

interface WeekStampsProps { stamps: boolean[]; streak: number; }

function WeekStamps({ stamps, streak }: WeekStampsProps) {
  const dayColors = [
    theme.category.blue, theme.category.green, theme.category.yellow,
    theme.category.orange, theme.category.pink, theme.category.purple,
    theme.category.blue,
  ];
  const doneCount = stamps.filter(Boolean).length;
  return (
    <div style={{ padding: "10px 0 4px" }}>
      <div style={{ display: "flex", gap: 4, justifyContent: "center", marginBottom: 8 }}>
        {stamps.map((done, i) => (
          <div key={i} className={done ? "stamp-day" : ""} style={{
            width: 36, height: 36, borderRadius: 18, flexShrink: 0,
            backgroundColor: done ? dayColors[i] : theme.fill.secondary,
            border: `2px solid ${done ? dayColors[i] : theme.stroke.secondary}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {done ? (
              <svg width="16" height="13" viewBox="0 0 16 13" fill="none">
                <path d="M1.5 6.5L5.5 10.5L14.5 1.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <span style={{ fontSize: 10, color: theme.text.tertiary, fontWeight: 700 }}>
                {WEEK_DAYS[i]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: theme.text.secondary }}>
          今週 <span style={{ fontWeight: 700, color: theme.text.primary }}>{doneCount}/7</span> 日達成！
        </span>
        {streak >= 2 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: theme.category.orange }}>
            🔥 {streak}日連続
          </span>
        )}
      </div>
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
  floatColor: string; stamps: boolean[]; streak: number;
  onReorder: (tasks: Task[]) => void;
  onAddTask: (title: string, emoji: string) => void;
  toggle: (id: number) => void;
}

function TaskScreen({ label, timeLabel, tasks, done, justChecked, floatColor, stamps, streak, onReorder, onAddTask, toggle }: TaskScreenProps) {
  const [isAdding, setIsAdding] = useState(false);
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
    onAddTask(newTitle, newEmoji);
    setNewTitle("");
    setNewEmoji("📝");
    setIsAdding(false);
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

      <WeekStamps stamps={stamps} streak={streak} />
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* タスク追加エリア */}
      {isAdding ? (
        <div style={{ padding: "10px 12px", borderRadius: 14, border: `1.5px solid ${theme.accent.primary}44`, backgroundColor: `${theme.accent.primary}08`, display: "flex", flexDirection: "column", gap: 10 }}>
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
        <button onClick={() => setIsAdding(true)} style={{
          width: "100%", padding: "11px", borderRadius: 12,
          border: `1.5px dashed ${theme.stroke.secondary}`, backgroundColor: "transparent",
          color: theme.text.tertiary, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <span style={{ fontSize: 18 }}>＋</span> きょうだけのタスクを追加
        </button>
      )}
    </>
  );
}

// ── Sortable Task Row ─────────────────────────────────

interface TaskRowProps {
  task: Task; isDone: boolean; isJustChecked: boolean;
  floatColor: string; onToggle: () => void;
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
  const [customMin, setCustomMin] = useState("");
  const presets = [10, 15, 20, 30, 45, 60];

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

      {/* ゲームタイマー */}
      <div style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${theme.stroke.secondary}`, backgroundColor: theme.fill.quaternary }}>
        <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 8 }}>🎮 ゲームのじかん</div>
        {/* プリセット */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {presets.map((m) => (
            <button key={m} onClick={() => { onSetDuration(m); setCustomMin(""); }} style={{
              padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
              backgroundColor: timerDuration === m && !customMin ? theme.accent.primary : theme.fill.secondary,
              color: timerDuration === m && !customMin ? "#fff" : theme.text.secondary,
              fontWeight: timerDuration === m && !customMin ? 700 : 400,
              fontSize: 13,
            }}>{m}分</button>
          ))}
        </div>
        {/* カスタム入力 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <input
            type="number"
            min={1} max={180}
            value={customMin}
            onChange={(e) => {
              setCustomMin(e.target.value);
              const v = parseInt(e.target.value);
              if (v > 0 && v <= 180) onSetDuration(v);
            }}
            placeholder="自由に入力（分）"
            style={{
              flex: 1, padding: "8px 12px", borderRadius: 8,
              border: customMin ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.secondary}`,
              fontSize: 14, outline: "none", backgroundColor: theme.bg.editor, color: theme.text.primary,
              fontFamily: "inherit",
            }}
          />
        </div>
        <button onClick={onGoTimer} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "none", cursor: "pointer",
          backgroundColor: theme.accent.primary, color: "#fff", fontSize: 15, fontWeight: 700,
        }}>
          {timerDuration}分スタート 🎮
        </button>
      </div>

      <div style={{ marginTop: "auto", padding: 14, borderRadius: 14, border: `1.5px solid ${theme.stroke.secondary}`, backgroundColor: theme.fill.quaternary }}>
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
    </div>
  );
}

// ── Timer Screen ──────────────────────────────────────

function TimerScreen({ secondsLeft, onBack, onHome }: { secondsLeft: number; onBack: () => void; onHome: () => void }) {
  const progress   = secondsLeft / (20 * 60);
  const minutes    = Math.floor(secondsLeft / 60);
  const secs       = secondsLeft % 60;
  const isWarning  = secondsLeft <= 60;
  const color      = isWarning ? theme.category.orange : theme.accent.primary;
  const totalDots  = 20;
  const activeDots = Math.ceil(progress * totalDots);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 22, position: "relative" }}>
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

      <div style={{ fontSize: 13, color: theme.text.tertiary, letterSpacing: 1 }}>ゲームのじかん</div>

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
        <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: theme.text.tertiary }}>のこり {minutes}分</div>
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

      <div style={{ fontSize: 12, color: theme.text.tertiary, textAlign: "center" }}>
        タイマーがおわったら<br />やめようね
      </div>
    </div>
  );
}

// ── Timer End Screen ──────────────────────────────────

function TimerEndScreen({
  streak, stamps, onBack, onHome,
}: {
  streak: number; stamps: boolean[]; onBack: () => void; onHome: () => void;
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

      <div style={{ width: "80%", height: 1, backgroundColor: theme.stroke.tertiary }} />

      {streak >= 2 && (
        <div style={{
          fontSize: 13, color: theme.category.orange, padding: "10px 18px",
          borderRadius: 10, backgroundColor: `${theme.category.orange}11`, fontWeight: 700,
        }}>
          🔥 {streak}日連続！あした{streak + 1}日めをめざそう
        </div>
      )}

      <WeekStamps stamps={stamps} streak={streak} />
    </div>
  );
}
