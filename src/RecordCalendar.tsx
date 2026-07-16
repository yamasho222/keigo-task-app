import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import {
  REWARD_LOOKUP, TOTAL_REWARD_COUNT, dedupeStickerIds, getAlbumCategoryGroups,
  DUPLICATE_TOKEN_LABEL,
} from "./stickerRewards";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";
import { RarityBadge, StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import {
  BUDDY_DAILY_XP_CAP, BUDDY_TRAIN_TOKEN_COST, getBuddyEntry, isBuddyMaxed,
  xpToNextLevel, type BuddyProgressMap,
} from "./buddyProgress";
import {
  completedSessionCount, isDaytimeSessionDay, isFullDayForDate, parseDateKey,
  requiredSessionCount,
} from "./japaneseCalendar";
import { formatCatchUpDateLabel, isCatchUpEligible } from "./catchUp";

export interface DayHistory { morning: boolean; daytime: boolean; home: boolean; evening: boolean; }

interface SessionFlags {
  morning: boolean;
  daytime: boolean;
  home: boolean;
  evening: boolean;
}

function getSessionFlags(day?: DayHistory): SessionFlags {
  return {
    morning: !!day?.morning,
    daytime: !!day?.daytime,
    home: !!day?.home,
    evening: !!day?.evening,
  };
}

export function isFullDay(day?: DayHistory, date: Date = new Date()): boolean {
  return isFullDayForDate(day, date);
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
    if (isFullDay(history[localDateKey(d)], d)) streak++;
    else break;
  }
  return streak;
}

/** 3日連続ごほうびのマイルストーン（3, 10, 17…） */
export function isThreeDayMilestoneStreak(fullDayStreak: number): boolean {
  return fullDayStreak >= 3 && (fullDayStreak - 3) % 7 === 0;
}

/** 7日連続ごほうびのマイルストーン（7, 14, 21…） */
export function isSevenDayMilestoneStreak(fullDayStreak: number): boolean {
  return fullDayStreak >= 7 && fullDayStreak % 7 === 0;
}

/** 次の3日連続ごほうびまでの日数（0 = きょうが対象日） */
export function daysUntilThreeDayMilestone(fullDayStreak: number): number {
  if (fullDayStreak <= 0) return 3;
  if (isThreeDayMilestoneStreak(fullDayStreak)) return 0;
  const posInBlock = ((fullDayStreak - 1) % 7) + 1;
  if (posInBlock < 3) return 3 - posInBlock;
  return 7 - posInBlock + 3;
}

/** 次の7日連続ごほうびまでの日数（0 = きょうが対象日） */
export function daysUntilSevenDayMilestone(fullDayStreak: number): number {
  if (fullDayStreak <= 0) return 7;
  if (isSevenDayMilestoneStreak(fullDayStreak)) return 0;
  const remainder = fullDayStreak % 7;
  return remainder === 0 ? 0 : 7 - remainder;
}

/** @deprecated daysUntilSevenDayMilestone を使用 */
export function daysUntilWeeklySpecialReward(fullDayStreak: number): number {
  return daysUntilSevenDayMilestone(fullDayStreak);
}

export type NearestStreakMilestone = {
  kind: "threeDay" | "sevenDay";
  daysUntil: number;
};

/** 次に近いストリークごほうび（3日 or 7日） */
export function getNearestStreakMilestone(fullDayStreak: number): NearestStreakMilestone {
  const threeDays = daysUntilThreeDayMilestone(fullDayStreak);
  const sevenDays = daysUntilSevenDayMilestone(fullDayStreak);
  if (sevenDays < threeDays) return { kind: "sevenDay", daysUntil: sevenDays };
  return { kind: "threeDay", daysUntil: threeDays };
}

export function getStreak(history: Record<string, DayHistory>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = history[localDateKey(d)];
    if (day && (day.morning || day.daytime || day.evening || day.home)) streak++;
    else break;
  }
  return streak;
}

const WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function cellStyle(flags: SessionFlags, isToday: boolean, date: Date): CSSProperties {
  const count = completedSessionCount(flags, date);
  const required = requiredSessionCount(date);
  const withDaytime = isDaytimeSessionDay(date);
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
  if (count === required) {
    return { ...base, backgroundColor: theme.category.green, color: "#fff" };
  }
  const m = flags.morning ? theme.category.yellow : theme.fill.secondary;
  const h = flags.home ? theme.category.orange : theme.fill.secondary;
  const e = flags.evening ? `${theme.category.purple}88` : theme.fill.secondary;
  if (!withDaytime) {
    return {
      ...base,
      background: `linear-gradient(180deg, ${m} 0%, ${m} 33%, ${h} 33%, ${h} 66%, ${e} 66%, ${e} 100%)`,
      color: theme.text.primary,
    };
  }
  const d = flags.daytime ? theme.category.blue : theme.fill.secondary;
  return {
    ...base,
    background: `linear-gradient(180deg, ${m} 0%, ${m} 25%, ${d} 25%, ${d} 50%, ${h} 50%, ${h} 75%, ${e} 75%, ${e} 100%)`,
    color: theme.text.primary,
  };
}

function cellIcon(flags: SessionFlags, day: number, date: Date) {
  const count = completedSessionCount(flags, date);
  const required = requiredSessionCount(date);
  if (count === required) return "⭐";
  if (count >= Math.max(2, required - 1)) return "✨";
  if (flags.morning) return "🌅";
  if (flags.daytime) return "🌤";
  if (flags.home) return "🏠";
  if (flags.evening) return "🌙";
  return <span style={{ fontSize: 11 }}>{day}</span>;
}

interface Props {
  history: Record<string, DayHistory>;
  streak: number;
  stickerAlbum: string[];
  duplicateTokens?: number;
  buddyId?: string | null;
  buddyProgress?: BuddyProgressMap;
  buddyXpEarnedToday?: number;
  onSelectBuddy?: (stickerId: string) => void;
  onTrainBuddy?: (stickerId: string) => void;
  /** 今日の相棒を選ぶ／変えるシートを開く */
  onOpenBuddySelect?: () => void;
  onBack: () => void;
  onSelectCatchUpDay?: (dateKey: string) => void;
}

export function RecordScreen({
  history, streak, stickerAlbum, duplicateTokens = 0,
  buddyId = null, buddyProgress, buddyXpEarnedToday = 0,
  onSelectBuddy, onTrainBuddy, onOpenBuddySelect,
  onBack, onSelectCatchUpDay,
}: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmCatchUpKey, setConfirmCatchUpKey] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const todayStr = todayKey();
  const todayRequired = requiredSessionCount(now);

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
    return isFullDay(history[key], parseDateKey(key));
  }).filter(Boolean).length;

  const fullDayStreak = getFullDayStreak(history);
  const nearestMilestone = fullDayStreak >= 1 ? getNearestStreakMilestone(fullDayStreak) : null;
  const uniqueAlbum = dedupeStickerIds(stickerAlbum);
  const albumGroups = getAlbumCategoryGroups(stickerAlbum);
  const previewItem = previewId ? REWARD_LOOKUP[previewId] : null;
  const previewBuddy = previewId ? getBuddyEntry(buddyProgress, previewId) : null;
  const activeBuddyItem = buddyId && uniqueAlbum.includes(buddyId) ? REWARD_LOOKUP[buddyId] : null;
  const activeBuddyEntry = buddyId ? getBuddyEntry(buddyProgress, buddyId) : null;
  const todayXpShown = Math.min(BUDDY_DAILY_XP_CAP, Math.max(0, buddyXpEarnedToday));

  const albumCellStyle: CSSProperties = {
    width: 52, height: 52, borderRadius: 10, padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    /* 枠隅のレアバッジがはみ出せるよう hidden にしない */
    overflow: "visible", flexShrink: 0,
  };

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
            全部クリア {fullDayStreak}日連続 {fullDayStreak >= 7 ? "🎉" : ""}
          </div>
        )}
        {nearestMilestone && (
          <div style={{
            fontSize: 12,
            marginTop: 4,
            fontWeight: 700,
            color: nearestMilestone.kind === "sevenDay" ? theme.category.purple : theme.category.blue,
          }}>
            {nearestMilestone.daysUntil === 0
              ? nearestMilestone.kind === "sevenDay"
                ? "きょう、7日連続ごほうびのチャンス！"
                : "きょう、3日連続ごほうびのチャンス！"
              : nearestMilestone.kind === "sevenDay"
                ? `7日ごほうびまで あと${nearestMilestone.daysUntil}日`
                : `3日ごほうびまで あと${nearestMilestone.daysUntil}日`}
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
          const cellDate = parseDateKey(key);
          const flags = getSessionFlags(history[key]);
          const isToday = key === todayStr;
          const catchUpEligible = !!onSelectCatchUpDay && isCatchUpEligible(key, history);
          const baseStyle = cellStyle(flags, isToday, cellDate);
          return (
            <div
              key={key}
              role={catchUpEligible ? "button" : undefined}
              tabIndex={catchUpEligible ? 0 : undefined}
              onClick={catchUpEligible ? () => setConfirmCatchUpKey(key) : undefined}
              onKeyDown={catchUpEligible ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setConfirmCatchUpKey(key);
                }
              } : undefined}
              style={{
                ...baseStyle,
                cursor: catchUpEligible ? "pointer" : undefined,
                outline: catchUpEligible ? `2px dashed ${theme.accent.primary}66` : undefined,
                outlineOffset: catchUpEligible ? -1 : undefined,
              }}
            >
              {cellIcon(flags, day, cellDate)}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: theme.text.secondary, textAlign: "center" }}>
        この月 全部クリアした日: <strong>{monthFull}</strong>日
      </div>

      {onSelectCatchUpDay && (
        <div style={{ fontSize: 11, color: theme.text.tertiary, textAlign: "center" }}>
          点線の日をタップ → やり直し
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", fontSize: 11, color: theme.text.tertiary }}>
        <span>🌅 朝</span>
        <span>🌤 昼（土日・祝日）</span>
        <span>🏠 帰宅後</span>
        <span>🌙 夜</span>
        <span>⭐ きょうは{todayRequired}つ全部</span>
      </div>

      {/* 今日の相棒 */}
      <div style={{
        padding: 14, borderRadius: 14,
        backgroundColor: `${theme.accent.primary}0C`,
        border: `1.5px solid ${theme.accent.primary}44`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: theme.accent.primary, marginBottom: 10, textAlign: "center" }}>
          今日の相棒
        </div>
        {activeBuddyItem && activeBuddyEntry && buddyId ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              type="button"
              onClick={() => setPreviewId(buddyId)}
              style={{
                width: "100%", border: "none", background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: 0,
              }}
            >
              <div style={{ width: 72, height: 72, flexShrink: 0 }}>
                <BuddyFrame level={activeBuddyEntry.level} size="card" isBuddy showLevelBadge rarity={activeBuddyItem.rarity}>
                  <StickerFrameWithBadge
                    rarity={activeBuddyItem.rarity}
                    compact
                    showBadge={false}
                    style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {activeBuddyItem.emoji ? (
                      <span style={{ fontSize: 32 }}>{activeBuddyItem.emoji}</span>
                    ) : (
                      <StickerImg
                        src={activeBuddyItem.image!}
                        alt={activeBuddyItem.label}
                        padding={6}
                        objectFit={activeBuddyItem.imageFit ?? "contain"}
                      />
                    )}
                  </StickerFrameWithBadge>
                </BuddyFrame>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: theme.text.primary }}>{activeBuddyItem.label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary, marginTop: 2 }}>
                  Lv{activeBuddyEntry.level}
                  {!isBuddyMaxed(activeBuddyEntry) && (
                    <span style={{ marginLeft: 6, fontWeight: 600 }}>
                      次まで {xpToNextLevel(activeBuddyEntry.level) - activeBuddyEntry.xp}XP
                    </span>
                  )}
                  {isBuddyMaxed(activeBuddyEntry) && <span style={{ marginLeft: 6, color: theme.category.orange }}>MAX</span>}
                </div>
                {!isBuddyMaxed(activeBuddyEntry) && (
                  <div style={{
                    marginTop: 6, height: 8, borderRadius: 999, background: theme.fill.secondary, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 999,
                      width: `${Math.min(100, (activeBuddyEntry.xp / Math.max(1, xpToNextLevel(activeBuddyEntry.level))) * 100)}%`,
                      background: theme.accent.primary,
                    }} />
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.text.tertiary, marginTop: 6 }}>
                  きょうの成長 {"●".repeat(todayXpShown)}{"○".repeat(BUDDY_DAILY_XP_CAP - todayXpShown)} {todayXpShown}/{BUDDY_DAILY_XP_CAP}
                </div>
                <div style={{ fontSize: 11, color: theme.text.tertiary, marginTop: 2 }}>
                  親がハンコを押すと育つよ · 🪙{DUPLICATE_TOKEN_LABEL} {duplicateTokens}
                </div>
              </div>
            </button>
            {onOpenBuddySelect && uniqueAlbum.length > 0 && (
              <button
                type="button"
                onClick={onOpenBuddySelect}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 12,
                  border: `1.5px solid ${theme.accent.primary}66`,
                  backgroundColor: `${theme.accent.primary}14`,
                  color: theme.accent.primary,
                  fontSize: 13, fontWeight: 800, cursor: "pointer",
                }}
              >
                相棒をかえる
              </button>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.55, marginBottom: onOpenBuddySelect && uniqueAlbum.length > 0 ? 10 : 0 }}>
              まだ相棒がいないよ
              {!onOpenBuddySelect && (
                <>
                  <br />
                  <span style={{ fontSize: 12, color: theme.text.tertiary }}>下のアルバムから選んでね</span>
                </>
              )}
            </div>
            {onOpenBuddySelect && uniqueAlbum.length > 0 && (
              <button
                type="button"
                onClick={onOpenBuddySelect}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 12,
                  border: "none",
                  backgroundColor: theme.accent.primary,
                  color: "#fff",
                  fontSize: 13, fontWeight: 800, cursor: "pointer",
                }}
              >
                相棒をえらぶ
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{
        padding: 14, borderRadius: 14,
        backgroundColor: `${theme.accent.primary}0A`,
        border: `1.5px solid ${theme.accent.primary}33`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, marginBottom: 10, textAlign: "center" }}>
          集めたごほうび ({uniqueAlbum.length}/{TOTAL_REWARD_COUNT})
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {albumGroups.map((group) => (
            <div key={group.category}>
              <div style={{
                fontSize: 11, fontWeight: 800, color: theme.text.secondary,
                marginBottom: 8, letterSpacing: 0.5,
              }}>
                {group.label} ({group.collectedCount}/{group.totalCount})
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "4px 2px 2px" }}>
                {group.rewards.map((reward) => {
                  const collected = uniqueAlbum.includes(reward.id);
                  const item = REWARD_LOOKUP[reward.id];
                  if (collected) {
                    const entry = getBuddyEntry(buddyProgress, reward.id);
                    const isActiveBuddy = buddyId === reward.id;
                    return (
                      <button
                        key={reward.id}
                        type="button"
                        aria-label={`${item.label}を大きく見る`}
                        onClick={() => setPreviewId(reward.id)}
                        style={{
                          ...albumCellStyle,
                          backgroundColor: "transparent",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <BuddyFrame level={entry.level} size="cell" isBuddy={isActiveBuddy} showLevelBadge rarity={item.rarity}>
                          <StickerFrameWithBadge
                            rarity={item.rarity}
                            compact
                            showBadge={false}
                            style={{
                              width: "100%", height: "100%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: item.emoji ? 26 : undefined,
                            }}
                          >
                            {item.emoji ? (
                              item.emoji
                            ) : (
                              <StickerImg src={item.image!} alt={item.label} padding={5} objectFit={item.imageFit ?? "contain"} />
                            )}
                          </StickerFrameWithBadge>
                        </BuddyFrame>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={reward.id}
                      aria-label="まだ集めていないごほうび"
                      title="まだ集めていないごほうび"
                      style={{
                        ...albumCellStyle,
                        backgroundColor: theme.fill.quaternary,
                        border: `1.5px dashed ${theme.stroke.secondary}`,
                        color: theme.text.tertiary,
                        fontSize: 22, fontWeight: 800,
                      }}
                    >
                      ?
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: theme.text.tertiary, textAlign: "center", marginTop: 10 }}>
          ？＝まだ集めていないごほうび
        </div>
      </div>

      {confirmCatchUpKey && onSelectCatchUpDay && (
        <div
          data-modal-overlay
          onClick={() => setConfirmCatchUpKey(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 120,
            backgroundColor: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 340, borderRadius: 20, padding: "24px 20px",
              backgroundColor: theme.bg.editor,
              boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: theme.text.primary, marginBottom: 8, textAlign: "center" }}>
              {formatCatchUpDateLabel(confirmCatchUpKey)} のやり直し
            </div>
            <div style={{ fontSize: 13, color: theme.text.secondary, lineHeight: 1.6, marginBottom: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>きょう限定・特別ミッションは復元できません</li>
                <li>日次・締切・1日ボーナスのごほうびは出ません</li>
                <li>連続記録がつながった場合のみ 3日/7日ボーナスがあります</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmCatchUpKey(null)}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 12,
                  border: `1.5px solid ${theme.stroke.secondary}`,
                  backgroundColor: theme.fill.secondary, color: theme.text.secondary,
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectCatchUpDay(confirmCatchUpKey);
                  setConfirmCatchUpKey(null);
                }}
                style={{
                  flex: 1, padding: "13px 0", borderRadius: 12, border: "none",
                  backgroundColor: theme.accent.primary, color: "#fff",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                やり直す
              </button>
            </div>
          </div>
        </div>
      )}

      {previewItem && previewId && previewBuddy && (
        <div
          data-modal-overlay
          onClick={() => setPreviewId(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 120,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 320, borderRadius: 24, padding: "24px 20px",
              backgroundColor: theme.bg.editor,
              boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
              textAlign: "center",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ width: 220, height: 220, margin: "0 auto 14px" }}>
              <BuddyFrame
                level={previewBuddy.level}
                size="preview"
                isBuddy={buddyId === previewId}
                showLevelBadge
                rarity={previewItem.rarity}
              >
                <StickerFrameWithBadge
                  rarity={previewItem.rarity}
                  showBadge={false}
                  style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                    fontSize: previewItem.emoji ? 100 : undefined,
                    backgroundColor: previewItem.emoji ? `${theme.category.green}14` : "transparent",
                  }}
                >
                  {previewItem.emoji ? (
                    previewItem.emoji
                  ) : (
                    <StickerImg src={previewItem.image!} alt={previewItem.label} padding={16} objectFit={previewItem.imageFit ?? "contain"} />
                  )}
                </StickerFrameWithBadge>
              </BuddyFrame>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: theme.text.primary, marginBottom: 6 }}>
              {previewItem.label}
            </div>
            <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
              <RarityBadge rarity={previewItem.rarity} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: theme.text.secondary, marginBottom: 6 }}>
              Lv{previewBuddy.level}
              {isBuddyMaxed(previewBuddy)
                ? " · MAX"
                : ` · ${previewBuddy.xp}/${xpToNextLevel(previewBuddy.level)} XP`}
            </div>
            {!isBuddyMaxed(previewBuddy) && (
              <div style={{
                height: 10, borderRadius: 999, background: theme.fill.secondary,
                overflow: "hidden", marginBottom: 14,
              }}>
                <div style={{
                  height: "100%", borderRadius: 999,
                  width: `${Math.min(100, (previewBuddy.xp / Math.max(1, xpToNextLevel(previewBuddy.level))) * 100)}%`,
                  background: `linear-gradient(90deg, ${theme.accent.primary}, ${theme.category.purple})`,
                }} />
              </div>
            )}
            {buddyId === previewId ? (
              <div style={{
                width: "100%", padding: "12px", borderRadius: 12, marginBottom: 8,
                border: `1.5px solid ${theme.accent.primary}`,
                backgroundColor: `${theme.accent.primary}14`,
                color: theme.accent.primary,
                fontSize: 14, fontWeight: 800,
              }}>
                相棒中
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectBuddy?.(previewId)}
                disabled={!onSelectBuddy}
                style={{
                  width: "100%", marginBottom: 8, padding: "14px", borderRadius: 12, border: "none",
                  backgroundColor: theme.accent.primary, color: "#fff",
                  fontSize: 15, fontWeight: 800, cursor: onSelectBuddy ? "pointer" : "default",
                  opacity: onSelectBuddy ? 1 : 0.5,
                }}
              >
                今日の相棒にする
              </button>
            )}
            {!isBuddyMaxed(previewBuddy) && onTrainBuddy && (
              <button
                type="button"
                disabled={duplicateTokens < BUDDY_TRAIN_TOKEN_COST}
                onClick={() => onTrainBuddy(previewId)}
                style={{
                  width: "100%", marginBottom: 8, padding: "12px", borderRadius: 12,
                  border: `1.5px solid ${duplicateTokens >= BUDDY_TRAIN_TOKEN_COST ? theme.category.orange : theme.stroke.secondary}`,
                  backgroundColor: duplicateTokens >= BUDDY_TRAIN_TOKEN_COST ? `${theme.category.orange}14` : theme.fill.quaternary,
                  color: duplicateTokens >= BUDDY_TRAIN_TOKEN_COST ? theme.category.orange : theme.text.tertiary,
                  fontSize: 14, fontWeight: 800,
                  cursor: duplicateTokens >= BUDDY_TRAIN_TOKEN_COST ? "pointer" : "default",
                }}
              >
                🪙{BUDDY_TRAIN_TOKEN_COST}{DUPLICATE_TOKEN_LABEL}で +1XP（残り {duplicateTokens}）
              </button>
            )}
            <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 10, lineHeight: 1.45 }}>
              {buddyId === previewId
                ? "親がハンコを押すと、この相棒が育つよ"
                : `所持シールならどれでも${DUPLICATE_TOKEN_LABEL}で育てられるよ`}
            </div>
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              style={{
                width: "100%", padding: "12px", borderRadius: 12,
                border: `1.5px solid ${theme.stroke.secondary}`,
                backgroundColor: theme.fill.secondary, color: theme.text.secondary,
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              とじる
            </button>
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
