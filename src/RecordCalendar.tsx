import { useState, type CSSProperties } from "react";
import { theme } from "./theme";
import {
  REWARD_LOOKUP, TOTAL_REWARD_COUNT, dedupeStickerIds, getAlbumCategoryGroups,
  DUPLICATE_TOKEN_COSTS, DUPLICATE_TOKEN_EXCHANGE_TIERS, RARITY_LABELS,
  countUncollectedStickersByRarity,
  type DuplicateTokenExchangeTier,
} from "./stickerRewards";
import { ScrollSafeBackButton } from "./ScrollSafeBackButton";
import { RarityBadge, StickerFrameWithBadge, StickerImg } from "./Rewards";
import { RARITY_META } from "./rarityMeta";
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
  onRedeemDuplicateToken?: (tier: DuplicateTokenExchangeTier) => void;
  onBack: () => void;
  onSelectCatchUpDay?: (dateKey: string) => void;
}

export function RecordScreen({
  history, streak, stickerAlbum, duplicateTokens = 0, onRedeemDuplicateToken, onBack, onSelectCatchUpDay,
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

  const albumCellStyle: CSSProperties = {
    width: 52, height: 52, borderRadius: 10, padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    overflow: "hidden", flexShrink: 0,
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

      <div style={{
        padding: 14, borderRadius: 14,
        backgroundColor: `${theme.category.orange}0A`,
        border: `1.5px solid ${theme.category.orange}33`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: theme.category.orange, marginBottom: 4, textAlign: "center" }}>
          かぶりトークン
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: theme.text.primary, textAlign: "center", marginBottom: 6 }}>
          {duplicateTokens}
        </div>
        <div style={{ fontSize: 11, color: theme.text.tertiary, textAlign: "center", marginBottom: 12, lineHeight: 1.45 }}>
          かぶると1つたまる。使って未所持シールを確定でもらえるよ
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DUPLICATE_TOKEN_EXCHANGE_TIERS.map((tier) => {
            const cost = DUPLICATE_TOKEN_COSTS[tier];
            const remaining = countUncollectedStickersByRarity(uniqueAlbum, tier);
            const canAfford = duplicateTokens >= cost;
            const enabled = remaining > 0 && canAfford && !!onRedeemDuplicateToken;
            return (
              <button
                key={tier}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (!enabled || !onRedeemDuplicateToken) return;
                  if (!window.confirm(`${RARITY_LABELS[tier]}の未所持シールを1枚もらう？（${cost}トークン）`)) return;
                  onRedeemDuplicateToken(tier);
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "10px 12px", borderRadius: 10, cursor: enabled ? "pointer" : "default",
                  border: `1.5px solid ${enabled ? RARITY_META[tier].color : theme.stroke.secondary}`,
                  backgroundColor: enabled ? `${RARITY_META[tier].color}14` : theme.fill.quaternary,
                  color: enabled ? theme.text.primary : theme.text.tertiary,
                  opacity: remaining === 0 ? 0.55 : 1,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: enabled ? RARITY_META[tier].color : theme.text.tertiary }}>
                  {RARITY_LABELS[tier]}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {remaining === 0
                    ? "コンプ済み"
                    : canAfford
                      ? `${cost} → 未所持あと${remaining}`
                      : `${cost}必要（あと${cost - duplicateTokens}）`}
                </span>
              </button>
            );
          })}
        </div>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {group.rewards.map((reward) => {
                  const collected = uniqueAlbum.includes(reward.id);
                  const item = REWARD_LOOKUP[reward.id];
                  if (collected) {
                    return (
                      <button
                        key={reward.id}
                        type="button"
                        aria-label={`${item.label}を大きく見る`}
                        onClick={() => setPreviewId(reward.id)}
                        style={{
                          ...albumCellStyle,
                          backgroundColor: theme.fill.secondary,
                          border: `1px solid ${theme.stroke.secondary}`,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <StickerFrameWithBadge
                          rarity={item.rarity}
                          compact
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

      {previewItem && previewId && (
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
              width: "100%", maxWidth: 320, borderRadius: 24, padding: "28px 24px",
              backgroundColor: theme.bg.editor,
              boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
              textAlign: "center",
            }}
          >
            <StickerFrameWithBadge
              rarity={previewItem.rarity}
              style={{
                width: 220, height: 220, margin: "0 auto 16px", borderRadius: 20,
                backgroundColor: previewItem.emoji ? `${theme.category.green}14` : theme.fill.secondary,
                border: previewItem.emoji
                  ? `3px solid ${theme.category.green}55`
                  : `3px solid ${theme.accent.primary}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
                fontSize: previewItem.emoji ? 100 : undefined,
                boxShadow: `0 8px 32px ${theme.accent.primary}22`,
              }}
            >
              {previewItem.emoji ? (
                previewItem.emoji
              ) : (
                <StickerImg src={previewItem.image!} alt={previewItem.label} padding={16} objectFit={previewItem.imageFit ?? "contain"} />
              )}
            </StickerFrameWithBadge>
            <div style={{ fontSize: 20, fontWeight: 900, color: theme.text.primary, marginBottom: 6 }}>
              {previewItem.label}
            </div>
            <div style={{ marginBottom: 12 }}>
              <RarityBadge rarity={previewItem.rarity} />
            </div>
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              style={{
                width: "100%", marginTop: 8, padding: "14px", borderRadius: 12, border: "none",
                backgroundColor: theme.accent.primary, color: "#fff",
                fontSize: 15, fontWeight: 700, cursor: "pointer",
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
