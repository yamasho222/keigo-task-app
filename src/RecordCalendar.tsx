import { useState, type CSSProperties } from "react";
import { theme } from "./theme";

export interface DayHistory { morning: boolean; evening: boolean; }

export type DayStatus = "none" | "morning" | "evening" | "both";

export function getDayStatus(day?: DayHistory): DayStatus {
  if (!day) return "none";
  if (day.morning && day.evening) return "both";
  if (day.morning) return "morning";
  if (day.evening) return "evening";
  return "none";
}

export function getStreak(history: Record<string, DayHistory>): number {
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

const WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function cellStyle(status: DayStatus, isToday: boolean): CSSProperties {
  const base: CSSProperties = {
    aspectRatio: "1",
    borderRadius: 8,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 13, fontWeight: 700,
    border: isToday ? `2px solid ${theme.accent.primary}` : `1px solid ${theme.stroke.tertiary}`,
  };
  switch (status) {
    case "both":
      return { ...base, backgroundColor: theme.category.green, color: "#fff" };
    case "morning":
      return {
        ...base,
        background: `linear-gradient(180deg, ${theme.category.yellow} 50%, ${theme.fill.secondary} 50%)`,
        color: theme.text.primary,
      };
    case "evening":
      return {
        ...base,
        background: `linear-gradient(180deg, ${theme.fill.secondary} 50%, ${theme.category.purple}88 50%)`,
        color: theme.text.primary,
      };
    default:
      return { ...base, backgroundColor: theme.fill.secondary, color: theme.text.tertiary };
  }
}

function cellIcon(status: DayStatus) {
  switch (status) {
    case "both": return "⭐";
    case "morning": return "🌅";
    case "evening": return "🌙";
    default: return "";
  }
}

interface Props {
  history: Record<string, DayHistory>;
  streak: number;
  onBack: () => void;
}

export function RecordScreen({ history, streak, onBack }: Props) {
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

  const monthBoth = Array.from({ length: lastDate }, (_, i) => {
    const key = dateKey(year, month, i + 1);
    return getDayStatus(history[key]) === "both";
  }).filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "80vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: theme.text.tertiary, fontSize: 13, padding: "4px 6px", borderRadius: 6 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          もどる
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary }}>れんぞくきろく</div>
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
          const status = getDayStatus(history[key]);
          const isToday = key === todayStr;
          return (
            <div key={key} style={cellStyle(status, isToday)}>
              {cellIcon(status) || <span style={{ fontSize: 11 }}>{day}</span>}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: theme.text.secondary, textAlign: "center" }}>
        この月 ぜんぶできた日: <strong>{monthBoth}</strong>日
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", fontSize: 11, color: theme.text.tertiary }}>
        <span>🌅 朝だけ</span>
        <span>🌙 夜だけ</span>
        <span>⭐ 両方</span>
      </div>
    </div>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

const navBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8, border: `1px solid ${theme.stroke.secondary}`,
  backgroundColor: theme.fill.secondary, cursor: "pointer", fontSize: 20,
  color: theme.text.secondary, display: "flex", alignItems: "center", justifyContent: "center",
};
