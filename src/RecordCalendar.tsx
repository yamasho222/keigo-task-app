import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import { REWARD_LOOKUP } from "./Rewards";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";

export interface DayHistory { morning: boolean; evening: boolean; home?: boolean; }

interface SessionFlags {
  morning: boolean;
  home: boolean;
  evening: boolean;
}

function getSessionFlags(day?: DayHistory): SessionFlags {
  return {
    morning: !!day?.morning,
    home: !!day?.home,
    evening: !!day?.evening,
  };
}

export function isFullDay(day?: DayHistory): boolean {
  const f = getSessionFlags(day);
  return f.morning && f.home && f.evening;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getFullDayStreak(history: Record<string, DayHistory>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (isFullDay(history[localDateKey(d)])) streak++;
    else break;
  }
  return streak;
}

function completedCount(flags: SessionFlags): number {
  return [flags.morning, flags.home, flags.evening].filter(Boolean).length;
}

export function getStreak(history: Record<string, DayHistory>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = history[localDateKey(d)];
    if (day && (day.morning || day.evening || day.home)) streak++;
    else break;
  }
  return streak;
}

const WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function cellStyle(flags: SessionFlags, isToday: boolean): CSSProperties {
  const count = completedCount(flags);
  const base: CSSProperties = {
    aspectRatio: "1",
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700,
    border: isToday ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.tertiary}`,
  };
  if (count === 0) {
    return { ...base, backgroundColor: theme.fill.secondary, color: theme.text.tertiary };
  }
  if (count === 3) {
    return { ...base, backgroundColor: theme.category.green, color: "#fff" };
  }
  const m = flags.morning ? theme.category.yellow : theme.fill.secondary;
  const h = flags.home ? theme.category.orange : theme.fill.secondary;
  const e = flags.evening ? `${theme.category.purple}88` : theme.fill.secondary;
  return {
    ...base,
    background: `linear-gradient(180deg, ${m} 0%, ${m} 33%, ${h} 33%, ${h} 66%, ${e} 66%, ${e} 100%)`,
    color: theme.text.primary,
  };
}

function cellIcon(flags: SessionFlags, day: number) {
  const count = completedCount(flags);
  if (count === 3) return "⭐";
  if (count === 2) return "✨";
  if (flags.morning) return "🌅";
  if (flags.home) return "🏠";
  if (flags.evening) return "🌙";
  return <span style={{ fontSize: 11 }}>{day}</span>;
}

interface Props {
  history: Record<string, DayHistory>;
  streak: number;
  stickerAlbum: string[];
  onBack: () => void;
}

export function RecordScreen({ history, streak, stickerAlbum, onBack }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const todayStr = todayKey();

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  };

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthFull = Array.from({ length: lastDate }, (_, i) => {
    const key = dateKey(year, month, i + 1);
    return isFullDay(history[key]);
  }).filter(Boolean).length;

  const fullDayStreak = getFullDayStreak(history);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "80vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ScrollSafeBackButton onBack={onBack} />
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>連続記録</div>
      </div>

      <div style={{
        padding: 16, borderRadius: 14, backgroundColor: `${theme.category.orange}18`,
        border: `1.5px solid ${theme.category.orange}44`, textAlign: "center",
      }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: theme.category.orange }}>
          {streak > 0 ? `🔥 ${streak}日` : "—"}
        </div>
        <div style={{ fontSize: 13, color: theme.text.secondary, marginTop: 4 }}>
          {streak >= 2 ? "れんぞくがんばってる！" : streak === 1 ? "きょうもがんばった！" : "きろくをためよう"}
        </div>
        {fullDayStreak >= 1 && (
          <div style={{ fontSize: 12, color: theme.category.green, marginTop: 6, fontWeight: 700 }}>
            3つ全部クリア {fullDayStreak}日連続 {fullDayStreak >= 7 ? "🎉" : ""}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" onClick={prevMonth} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.text.primary }}>
          {year}年 {month + 1}月
        </span>
        <button type="button" onClick={nextMonth} style={navBtnStyle}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {WEEK_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: theme.text.tertiary, padding: "4px 0" }}>
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const key = dateKey(year, month, day);
          const flags = getSessionFlags(history[key]);
          const isToday = key === todayStr;
          return (
            <div key={key} style={cellStyle(flags, isToday)}>
              {cellIcon(flags, day)}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: theme.text.secondary, textAlign: "center" }}>
        この月 3つともできた日: <strong>{monthFull}</strong>日
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", fontSize: 11, color: theme.text.tertiary }}>
        <span>🌅 朝</span>
        <span>🏠 帰宅後</span>
        <span>🌙 夜</span>
        <span>⭐ 3つとも</span>
      </div>

      {stickerAlbum.length > 0 && (
        <div style={{
          padding: 14, borderRadius: 14,
          backgroundColor: `${theme.accent.primary}0A`,
          border: `1.5px solid ${theme.accent.primary}33`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, marginBottom: 10, textAlign: "center" }}>
            集めたごほうび ({stickerAlbum.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {stickerAlbum.map((id) => {
              const item = REWARD_LOOKUP[id];
              if (!item) return null;
              return (
                <div key={id} title={item.label} style={{
                  width: 44, height: 44, borderRadius: 10,
                  backgroundColor: theme.fill.secondary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 24, border: `1px solid ${theme.stroke.secondary}`,
                }}>
                  {item.emoji}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function todayKey() {
  return localDateKey(new Date());
}

const navBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.stroke.secondary}`,
  backgroundColor: theme.fill.secondary, cursor: "pointer", fontSize: 20,
  color: theme.text.secondary, display: "flex", alignItems: "center", justifyContent: "center",
};
