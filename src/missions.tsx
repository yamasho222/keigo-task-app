import { useState } from "react";
import { theme } from "./theme";
import { MISSION_EMOJIS, MISSION_TEMPLATES, type MissionTemplate } from "./missionTemplates";
import { SESSION_SHORT_LABELS, type SessionId, type SpecialRewardFloor, specialRewardFloorParentHint } from "./sharedTasks";
import {
  type MissionCardStatus,
  type MissionOverallStatus,
  countParentApprovedPhases,
} from "./missionProgress";

export interface DailyMission {
  dateKey: string;
  title: string;
  emoji: string;
  source: "template" | "custom" | "favorite";
  rewardFloor?: SpecialRewardFloor;
}

export interface FavoriteMission {
  id: string;
  title: string;
  emoji: string;
  createdAt: string;
}

/** @deprecated use MissionOverallStatus from missionProgress */
export type MissionStatus = MissionOverallStatus;

export type { MissionCardStatus, MissionOverallStatus };

const MISSION_BRIEFING_KEY = "keigo-mission-briefing-v1";

function missionBriefingStorageKey(childId?: string) {
  return childId ? `${MISSION_BRIEFING_KEY}:${childId}` : `${MISSION_BRIEFING_KEY}:local`;
}

export function isMissionBriefingSeen(dateKey: string, childId?: string): boolean {
  try {
    const raw = localStorage.getItem(missionBriefingStorageKey(childId));
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && dateKey in (parsed as Record<string, boolean>)) {
      return !!(parsed as Record<string, boolean>)[dateKey];
    }
  } catch { /* ignore */ }
  return false;
}

export function markMissionBriefingSeen(dateKey: string, childId?: string): void {
  try {
    const key = missionBriefingStorageKey(childId);
    const raw = localStorage.getItem(key);
    const prev: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    prev[dateKey] = true;
    localStorage.setItem(key, JSON.stringify(prev));
  } catch { /* ignore */ }
}

export function MissionCard({
  mission,
  status,
  currentSession,
  activeSessions,
  doneSessions,
  approvedSessions,
  showEveningNudge = false,
  alignWithTaskRows = false,
  onDone,
  onUndoSession,
  onOpenReward,
  onOpenParentCheck,
  onLongPressSetup,
}: {
  mission: DailyMission;
  status: MissionCardStatus;
  currentSession: SessionId;
  activeSessions: SessionId[];
  doneSessions: SessionId[];
  approvedSessions: SessionId[];
  showEveningNudge?: boolean;
  alignWithTaskRows?: boolean;
  onDone: () => void;
  onUndoSession?: () => void;
  onOpenReward?: () => void;
  onOpenParentCheck?: () => void;
  onLongPressSetup?: () => void;
}) {
  const isDone = status === "done";
  const isAwaitingReward = status === "awaiting_reward";
  const isSessionAwaitingParent = status === "session_awaiting_parent";
  const isSessionComplete = status === "session_complete";
  const doneSet = new Set(doneSessions);
  const approvedSet = new Set(approvedSessions);
  const { approved, required: requiredParent } = countParentApprovedPhases(approvedSessions);

  const borderColor = isDone
    ? `${theme.category.green}44`
    : isAwaitingReward
      ? `${theme.category.orange}55`
      : isSessionAwaitingParent
        ? `${theme.category.orange}44`
        : `${theme.category.purple}44`;
  const bgColor = isDone
    ? `${theme.category.green}16`
    : isAwaitingReward
      ? `${theme.category.orange}14`
      : isSessionAwaitingParent
        ? `${theme.category.orange}10`
        : `${theme.category.purple}10`;

  const attachLongPress = (el: HTMLElement) => {
    if (!onLongPressSetup) return;
    const timer = window.setTimeout(() => onLongPressSetup(), 600);
    const clear = () => window.clearTimeout(timer);
    el.addEventListener("touchend", clear, { once: true });
    el.addEventListener("touchmove", clear, { once: true });
  };

  const row = (
    <div
      className={showEveningNudge && !isDone && !isAwaitingReward ? "mission-evening-nudge" : undefined}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        flex: 1,
        borderRadius: 14,
        border: `1.5px solid ${borderColor}`,
        backgroundColor: bgColor,
        padding: "13px 14px",
        opacity: isDone ? 0.72 : 1,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
        onTouchStart={(e) => attachLongPress(e.currentTarget)}
      >
        <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1, filter: isDone ? "grayscale(40%)" : "none" }}>
          {mission.emoji}
        </span>
        <span style={{
          fontSize: 15,
          fontWeight: isDone ? 400 : 600,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: isDone ? theme.text.tertiary : theme.text.primary,
          textDecoration: isDone ? "line-through" : "none",
        }}>
          {mission.title}
        </span>
        {!isDone && !isAwaitingReward && (
          <span style={{
            flexShrink: 0,
            fontSize: 10,
            fontWeight: 700,
            color: isSessionAwaitingParent ? theme.category.orange : theme.category.purple,
            backgroundColor: isSessionAwaitingParent ? `${theme.category.orange}18` : `${theme.category.purple}18`,
            padding: "2px 6px",
            borderRadius: 6,
            whiteSpace: "nowrap",
          }}>
            {isSessionAwaitingParent ? "親待ち" : `${approved}/${requiredParent}`}
          </span>
        )}
        {status === "pending" && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDone(); }}
            style={{
              flexShrink: 0,
              padding: "8px 12px",
              borderRadius: 10,
              border: "none",
              backgroundColor: theme.category.purple,
              color: "#fff",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            できた！
          </button>
        )}
        {isSessionAwaitingParent && onOpenParentCheck && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenParentCheck(); }}
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
            親チェック
          </button>
        )}
        {isSessionAwaitingParent && !onOpenParentCheck && (
          <span style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            color: theme.category.orange,
            whiteSpace: "nowrap",
          }}>
            親チェック待ち
          </span>
        )}
        {isSessionComplete && onUndoSession && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUndoSession(); }}
            aria-label="この時間帯の完了を取り消す"
            title="取り消す"
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 14,
              border: "none",
              padding: 0,
              backgroundColor: theme.category.green,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M1.5 6L5.5 10L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        {isAwaitingReward && onOpenReward && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenReward(); }}
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
            ごほうび！
          </button>
        )}
        {isDone && (
          <div style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: theme.category.green,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
              <path d="M1.5 6L5.5 10L12.5 1.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 4,
        marginTop: 8,
        paddingLeft: 34,
      }}>
        {activeSessions.map((sid) => {
          const parentDone = approvedSet.has(sid);
          const childDone = doneSet.has(sid);
          const isCurrent = sid === currentSession;
          const label = SESSION_SHORT_LABELS[sid];
          if (parentDone) {
            return (
              <span
                key={sid}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  color: theme.category.green,
                  backgroundColor: `${theme.category.green}20`,
                  border: `1px solid ${theme.category.green}55`,
                }}
              >
                ✓ {label}
              </span>
            );
          }
          if (childDone) {
            return (
              <span
                key={sid}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  color: theme.category.orange,
                  backgroundColor: `${theme.category.orange}15`,
                  border: `1px solid ${theme.category.orange}55`,
                }}
              >
                ⏳ {label}
              </span>
            );
          }
          if (isCurrent) {
            return (
              <span
                key={sid}
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  color: theme.category.purple,
                  backgroundColor: `${theme.category.purple}12`,
                  border: `1.5px solid ${theme.category.purple}66`,
                }}
              >
                {label} ←いま
              </span>
            );
          }
          return (
            <span
              key={sid}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 6,
                whiteSpace: "nowrap",
                color: theme.text.tertiary,
                backgroundColor: theme.fill.secondary,
                border: `1px solid ${theme.stroke.tertiary}`,
              }}
            >
              {label}
            </span>
          );
        })}
      </div>
      {isAwaitingReward && (
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: theme.category.orange,
          marginTop: 6,
          paddingLeft: 34,
        }}>
          全部の親チェック完了！ごほうびを開けよう
        </div>
      )}
      {showEveningNudge && !isDone && !isAwaitingReward && (
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: theme.category.orange,
          marginTop: 6,
          paddingLeft: 34,
        }}>
          まだ間に合うよ！
        </div>
      )}
    </div>
  );

  if (!alignWithTaskRows) return row;

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 6 }}>
      <div style={{ flexShrink: 0, width: 22 }} aria-hidden />
      {row}
    </div>
  );
}

export function MissionConfirmDialog({
  mission,
  sessionLabel,
  onConfirm,
  onCancel,
}: {
  mission: DailyMission;
  sessionLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div data-modal-overlay style={{
      position: "fixed", inset: 0, zIndex: 80,
      backgroundColor: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 320, borderRadius: 20, padding: "24px 20px",
        backgroundColor: theme.bg.editor, textAlign: "center",
        boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{mission.emoji}</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: theme.text.primary, marginBottom: 6 }}>
          {sessionLabel ? `${sessionLabel}のチャレンジ、できた？` : "本当にできた？"}
        </div>
        <div style={{ fontSize: 13, color: theme.text.secondary, marginBottom: 20 }}>
          {mission.title}
          {sessionLabel && (
            <span style={{ display: "block", marginTop: 6, fontSize: 12 }}>
              親がハンコを押したら、次の時間帯もチャレンジしよう
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: "12px", borderRadius: 12,
            border: `1px solid ${theme.stroke.secondary}`,
            backgroundColor: theme.fill.secondary, fontSize: 14, fontWeight: 700,
            color: theme.text.secondary, cursor: "pointer",
          }}>
            まだ
          </button>
          <button type="button" onClick={onConfirm} style={{
            flex: 1, padding: "12px", borderRadius: 12, border: "none",
            backgroundColor: theme.category.purple, color: "#fff",
            fontSize: 14, fontWeight: 800, cursor: "pointer",
          }}>
            うん！
          </button>
        </div>
      </div>
    </div>
  );
}

export function MissionBriefingOverlay({
  mission,
  onDismiss,
}: {
  mission: DailyMission;
  onDismiss: () => void;
}) {
  return (
    <div data-modal-overlay style={{
      position: "fixed", inset: 0, zIndex: 75,
      backgroundColor: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="treat-reveal" style={{
        width: "100%", maxWidth: 320, borderRadius: 24, padding: "28px 24px",
        backgroundColor: theme.bg.editor, textAlign: "center",
        boxShadow: "0 12px 48px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: theme.category.purple, marginBottom: 16 }}>
          きょうの とくべつミッション！
        </div>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }}>{mission.emoji}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: theme.text.primary, marginBottom: 12 }}>
          {mission.title}
        </div>
        <div style={{ fontSize: 14, color: theme.text.secondary, marginBottom: 24 }}>
          すべての時間（朝・帰宅・夜など）で親のハンコがそろったら、レア以上のごほうび！
        </div>
        <button type="button" onClick={onDismiss} style={{
          width: "100%", padding: "14px", borderRadius: 12, border: "none",
          backgroundColor: theme.category.purple, color: "#fff",
          fontSize: 16, fontWeight: 800, cursor: "pointer",
        }}>
          がんばる！
        </button>
      </div>
    </div>
  );
}

export function MissionSetupSheet({
  favorites,
  currentMission,
  customTaskEmojis,
  onSave,
  onClear,
  onClose,
}: {
  favorites: FavoriteMission[];
  currentMission: DailyMission | null;
  customTaskEmojis: string[];
  onSave: (mission: Omit<DailyMission, "dateKey">, addToFavorites: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [customTitle, setCustomTitle] = useState(currentMission?.source === "custom" ? currentMission.title : "");
  const [customEmoji, setCustomEmoji] = useState(currentMission?.source === "custom" ? currentMission.emoji : "⭐");
  const [rewardFloor, setRewardFloor] = useState<SpecialRewardFloor>(currentMission?.rewardFloor ?? "rare");
  const [addToFavorites, setAddToFavorites] = useState(false);

  const emojiOptions = [...new Set([...MISSION_EMOJIS, ...customTaskEmojis])];

  const pickTemplate = (t: MissionTemplate) => {
    onSave({ title: t.title, emoji: t.emoji, source: "template", rewardFloor }, false);
  };

  const pickFavorite = (f: FavoriteMission) => {
    onSave({ title: f.title, emoji: f.emoji, source: "favorite", rewardFloor }, false);
  };

  const saveCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    onSave({ title, emoji: customEmoji, source: "custom", rewardFloor }, addToFavorites);
  };

  return (
    <div data-modal-overlay onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 85,
      backgroundColor: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto",
          borderRadius: "20px 20px 0 0",
          backgroundColor: theme.bg.editor,
          padding: "20px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, color: theme.text.primary, marginBottom: 4 }}>
          きょうの特別ミッション
        </div>
        <div style={{ fontSize: 12, color: theme.text.tertiary, marginBottom: 16 }}>
          親と一緒に決めよう
        </div>
        <div style={{
          display: "flex", gap: 8, marginBottom: 16,
          padding: 10, borderRadius: 12,
          border: `1px solid ${theme.stroke.tertiary}`,
          backgroundColor: theme.fill.quaternary,
        }}>
          <button
            type="button"
            onClick={() => setRewardFloor("rare")}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              border: rewardFloor === "rare" ? `2px solid ${theme.category.purple}` : `1px solid ${theme.stroke.secondary}`,
              backgroundColor: rewardFloor === "rare" ? `${theme.category.purple}16` : theme.bg.editor,
              color: rewardFloor === "rare" ? theme.category.purple : theme.text.secondary,
              fontSize: 12, fontWeight: 800, cursor: "pointer",
            }}
          >
            レア以上
          </button>
          <button
            type="button"
            onClick={() => setRewardFloor("superRare")}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: 10,
              border: rewardFloor === "superRare" ? `2px solid ${theme.category.purple}` : `1px solid ${theme.stroke.secondary}`,
              backgroundColor: rewardFloor === "superRare" ? `${theme.category.purple}16` : theme.bg.editor,
              color: rewardFloor === "superRare" ? theme.category.purple : theme.text.secondary,
              fontSize: 12, fontWeight: 800, cursor: "pointer",
            }}
          >
            スーパーレア以上
          </button>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, marginBottom: 8 }}>
          テンプレート
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {MISSION_TEMPLATES.map((t) => (
            <button key={t.id} type="button" onClick={() => pickTemplate(t)} style={{
              padding: "12px 10px", borderRadius: 12,
              border: `1.5px solid ${theme.stroke.secondary}`,
              backgroundColor: theme.fill.quaternary, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, textAlign: "left",
            }}>
              <span style={{ fontSize: 24 }}>{t.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: theme.text.primary }}>{t.title}</span>
            </button>
          ))}
        </div>

        {favorites.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, marginBottom: 8 }}>
              前に一緒に決めたミッション
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {favorites.map((f) => (
                <button key={f.id} type="button" onClick={() => pickFavorite(f)} style={{
                  padding: "8px 12px", borderRadius: 20,
                  border: `1.5px solid ${theme.category.purple}44`,
                  backgroundColor: `${theme.category.purple}10`, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ fontSize: 18 }}>{f.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: theme.text.primary }}>{f.title}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text.secondary, marginBottom: 8 }}>
          自由入力
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {emojiOptions.map((e) => (
            <button key={e} type="button" onClick={() => setCustomEmoji(e)} style={{
              width: 40, height: 40, borderRadius: 10, fontSize: 20,
              border: customEmoji === e ? `2px solid ${theme.category.purple}` : `1px solid ${theme.stroke.secondary}`,
              backgroundColor: customEmoji === e ? `${theme.category.purple}18` : theme.fill.quaternary,
              cursor: "pointer",
            }}>
              {e}
            </button>
          ))}
        </div>
        <input
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value.slice(0, 12))}
          placeholder="例: お手伝い30分"
          maxLength={12}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12, marginBottom: 10,
            border: `1.5px solid ${theme.stroke.secondary}`, fontSize: 15,
            boxSizing: "border-box",
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={addToFavorites}
            onChange={(e) => setAddToFavorites(e.target.checked)}
          />
          <span style={{ fontSize: 13, color: theme.text.secondary }}>お気に入りに追加</span>
        </label>
        <button type="button" onClick={saveCustom} disabled={!customTitle.trim()} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "none", marginBottom: 16,
          backgroundColor: customTitle.trim() ? theme.category.purple : theme.fill.secondary,
          color: customTitle.trim() ? "#fff" : theme.text.tertiary,
          fontSize: 14, fontWeight: 700, cursor: customTitle.trim() ? "pointer" : "default",
        }}>
          きょうのミッションにする
        </button>

        {currentMission && (
          <button type="button" onClick={onClear} style={{
            width: "100%", padding: "12px", borderRadius: 12, marginBottom: 8,
            border: `1px solid ${theme.stroke.secondary}`,
            backgroundColor: "transparent", color: theme.text.tertiary,
            fontSize: 14, cursor: "pointer",
          }}>
            きょうはミッションなし
          </button>
        )}
        <button type="button" onClick={onClose} style={{
          width: "100%", padding: "12px", borderRadius: 12,
          border: `1px solid ${theme.stroke.secondary}`,
          backgroundColor: "transparent", color: theme.text.tertiary,
          fontSize: 14, cursor: "pointer",
        }}>
          閉じる
        </button>
      </div>
    </div>
  );
}

export function ShowParentMissionScreen({
  mission,
  phaseSession,
  phaseLabel,
  completedAt,
  phaseApproved,
  activeSessions,
  doneSessions,
  approvedSessions,
  onApprove,
  onReset,
  onHome,
}: {
  mission: DailyMission;
  phaseSession: SessionId;
  phaseLabel: string;
  completedAt: string;
  phaseApproved: boolean;
  activeSessions: SessionId[];
  doneSessions: SessionId[];
  approvedSessions: SessionId[];
  onApprove: () => void;
  onReset: () => void;
  onHome: () => void;
}) {
  const doneSet = new Set(doneSessions);
  const approvedSet = new Set(approvedSessions);
  const childDoneThisPhase = doneSet.has(phaseSession);
  const canApprove = childDoneThisPhase && !phaseApproved;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "80vh" }}>
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
        <div style={{ fontSize: 12, color: theme.text.tertiary }}>
          {completedAt ? `${completedAt} 完了` : ""}
        </div>
      </div>

      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: theme.text.primary }}>
          {phaseLabel}の特別ミッション
        </div>
        <div style={{
          display: "inline-flex", marginTop: 6, padding: "3px 12px", borderRadius: 100,
          backgroundColor: `${theme.category.purple}18`,
        }}>
          <span style={{ fontSize: 12, color: theme.category.purple, fontWeight: 700 }}>親チェック</span>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        width: "100%", boxSizing: "border-box",
        borderRadius: 14, backgroundColor: `${theme.category.purple}14`,
        border: `1.5px solid ${theme.category.purple}44`,
      }}>
        <span style={{ fontSize: 32 }}>{mission.emoji}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.text.primary }}>{mission.title}</span>
      </div>

      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center",
        padding: "10px 12px", borderRadius: 12,
        backgroundColor: theme.fill.quaternary,
        border: `1px solid ${theme.stroke.tertiary}`,
      }}>
        {activeSessions.map((sid) => {
          const parentDone = approvedSet.has(sid);
          const childDone = doneSet.has(sid);
          const isThis = sid === phaseSession;
          return (
            <span key={sid} style={{
              fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 8,
              color: parentDone ? theme.category.green : childDone ? theme.category.orange : theme.text.tertiary,
              backgroundColor: parentDone ? `${theme.category.green}18` : childDone ? `${theme.category.orange}15` : theme.fill.secondary,
              border: `1px solid ${parentDone ? `${theme.category.green}55` : isThis ? `${theme.category.purple}66` : theme.stroke.tertiary}`,
            }}>
              {parentDone ? "✓ " : childDone ? "⏳ " : ""}{SESSION_SHORT_LABELS[sid]}
            </span>
          );
        })}
      </div>

      {phaseApproved && (
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
          <span style={{ fontSize: 14, fontWeight: 700, color: theme.category.green }}>{phaseLabel}のハンコ OK！</span>
        </div>
      )}

      <div style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${theme.stroke.secondary}`, backgroundColor: theme.fill.quaternary }}>
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 10, textAlign: "center" }}>
          {phaseLabel}のチャレンジを親がかくにん
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div
            onClick={canApprove ? onApprove : undefined}
            style={{
            flex: 2, padding: "12px", borderRadius: 10, textAlign: "center",
            backgroundColor: phaseApproved ? `${theme.category.green}33` : canApprove ? theme.category.green : theme.fill.secondary,
            color: phaseApproved ? theme.category.green : canApprove ? "#fff" : theme.text.tertiary,
            fontSize: 14, fontWeight: 800, cursor: canApprove ? "pointer" : "default",
            opacity: canApprove || phaseApproved ? 1 : 0.7,
          }}>
            {phaseApproved ? "✓ 承認ずみ" : canApprove ? "はんこを押す！" : "まだ承認できません"}
          </div>
          <div onClick={onReset} style={{
            flex: 1, padding: "12px", borderRadius: 10, textAlign: "center",
            border: `1px solid ${theme.stroke.secondary}`,
            color: theme.text.tertiary, fontSize: 13, cursor: "pointer",
          }}>
            やりなおし
          </div>
        </div>
      </div>
    </div>
  );
}

export function ShowParentOneOffScreen({
  emoji,
  title,
  phaseLabel,
  rewardFloor = "rare",
  completedAt,
  approved,
  onApprove,
  onReset,
  onHome,
}: {
  emoji: string;
  title: string;
  phaseLabel: string;
  rewardFloor?: SpecialRewardFloor;
  completedAt: string;
  approved: boolean;
  onApprove: () => void;
  onReset: () => void;
  onHome: () => void;
}) {
  const canApprove = !approved;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: "80vh" }}>
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
        <div style={{ fontSize: 12, color: theme.text.tertiary }}>
          {completedAt ? `${completedAt} 完了` : ""}
        </div>
      </div>

      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: theme.text.primary }}>
          {phaseLabel}の単発特別ミッション
        </div>
        <div style={{
          display: "inline-flex", marginTop: 6, padding: "3px 12px", borderRadius: 100,
          backgroundColor: `${theme.category.orange}18`,
        }}>
          <span style={{ fontSize: 12, color: theme.category.orange, fontWeight: 700 }}>親チェック</span>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        width: "100%", boxSizing: "border-box",
        borderRadius: 14, backgroundColor: `${theme.category.orange}14`,
        border: `1.5px solid ${theme.category.orange}44`,
      }}>
        <span style={{ fontSize: 32 }}>{emoji}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.text.primary }}>{title}</span>
      </div>

      <div style={{
        padding: "10px 14px", borderRadius: 12, textAlign: "center",
        backgroundColor: theme.fill.quaternary, border: `1px solid ${theme.stroke.tertiary}`,
        fontSize: 13, color: theme.text.secondary,
      }}>
        {specialRewardFloorParentHint(rewardFloor)}
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
          <span style={{ fontSize: 14, fontWeight: 700, color: theme.category.green }}>ハンコ OK！</span>
        </div>
      )}

      <div style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${theme.stroke.secondary}`, backgroundColor: theme.fill.quaternary }}>
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 10, textAlign: "center" }}>
          親がミッションをかくにん
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div
            onClick={canApprove ? onApprove : undefined}
            style={{
            flex: 2, padding: "12px", borderRadius: 10, textAlign: "center",
            backgroundColor: approved ? `${theme.category.green}33` : canApprove ? theme.category.green : theme.fill.secondary,
            color: approved ? theme.category.green : canApprove ? "#fff" : theme.text.tertiary,
            fontSize: 14, fontWeight: 800, cursor: canApprove ? "pointer" : "default",
            opacity: canApprove || approved ? 1 : 0.7,
          }}>
            {approved ? "✓ 承認ずみ" : canApprove ? "はんこを押す！" : "まだ承認できません"}
          </div>
          <div onClick={onReset} style={{
            flex: 1, padding: "12px", borderRadius: 10, textAlign: "center",
            border: `1px solid ${theme.stroke.secondary}`,
            color: theme.text.tertiary, fontSize: 13, cursor: "pointer",
          }}>
            やりなおし
          </div>
        </div>
      </div>
    </div>
  );
}
