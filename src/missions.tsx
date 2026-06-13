import { useState } from "react";
import { theme } from "./theme";
import { MISSION_EMOJIS, MISSION_TEMPLATES, type MissionTemplate } from "./missionTemplates";

export interface DailyMission {
  dateKey: string;
  title: string;
  emoji: string;
  source: "template" | "custom" | "favorite";
}

export interface FavoriteMission {
  id: string;
  title: string;
  emoji: string;
  createdAt: string;
}

export type MissionStatus = "pending" | "awaiting_parent" | "done";

export function getMissionStatus(
  mission: DailyMission | null,
  todayKey: string,
  childClaimed: boolean,
  approved: Record<string, boolean>,
): MissionStatus | null {
  if (!mission || mission.dateKey !== todayKey) return null;
  if (approved[todayKey]) return "done";
  if (childClaimed) return "awaiting_parent";
  return "pending";
}

const MISSION_BRIEFING_KEY = "keigo-mission-briefing-v1";

export function isMissionBriefingSeen(dateKey: string): boolean {
  try {
    const raw = localStorage.getItem(MISSION_BRIEFING_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && dateKey in (parsed as Record<string, boolean>)) {
      return !!(parsed as Record<string, boolean>)[dateKey];
    }
  } catch { /* ignore */ }
  return false;
}

export function markMissionBriefingSeen(dateKey: string): void {
  try {
    const raw = localStorage.getItem(MISSION_BRIEFING_KEY);
    const prev: Record<string, boolean> = raw ? JSON.parse(raw) : {};
    prev[dateKey] = true;
    localStorage.setItem(MISSION_BRIEFING_KEY, JSON.stringify(prev));
  } catch { /* ignore */ }
}

export function MissionCard({
  mission,
  status,
  showEveningNudge = false,
  onDone,
  onLongPressSetup,
}: {
  mission: DailyMission;
  status: MissionStatus;
  showEveningNudge?: boolean;
  onDone: () => void;
  onLongPressSetup?: () => void;
}) {
  const isDone = status === "done";
  const isAwaiting = status === "awaiting_parent";
  const borderColor = isDone
    ? theme.stroke.secondary
    : isAwaiting
      ? theme.category.yellow
      : theme.category.purple;
  const bgColor = isDone
    ? theme.fill.quaternary
    : isAwaiting
      ? `${theme.category.yellow}12`
      : `${theme.category.purple}10`;

  const statusIcon = isDone ? "⭐" : isAwaiting ? "⏳" : "🎯";
  const statusLabel = isDone ? "クリア！" : isAwaiting ? "確認してね" : "チャレンジ中";

  return (
    <div
      className={showEveningNudge && status === "pending" ? "mission-evening-nudge" : undefined}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        borderRadius: 16,
        border: `2px solid ${borderColor}`,
        backgroundColor: bgColor,
        padding: "14px 16px",
        opacity: isDone ? 0.72 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: theme.category.purple }}>⭐ とくべつミッション</span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: isDone ? theme.category.green : isAwaiting ? theme.category.orange : theme.category.purple,
          backgroundColor: isDone ? `${theme.category.green}18` : isAwaiting ? `${theme.category.orange}18` : `${theme.category.purple}18`,
          padding: "2px 8px", borderRadius: 8,
        }}>
          {statusIcon} {statusLabel}
        </span>
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
        onTouchStart={(e) => {
          if (!onLongPressSetup) return;
          const timer = window.setTimeout(() => onLongPressSetup(), 600);
          const clear = () => window.clearTimeout(timer);
          e.currentTarget.addEventListener("touchend", clear, { once: true });
          e.currentTarget.addEventListener("touchmove", clear, { once: true });
        }}
      >
        <span style={{ fontSize: 36, lineHeight: 1 }}>{mission.emoji}</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: theme.text.primary, lineHeight: 1.3 }}>
          {mission.title}
        </span>
      </div>

      <div style={{
        height: 1, backgroundColor: `${borderColor}44`, marginBottom: 10,
      }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: status === "pending" ? 12 : 0 }}>
        <span style={{ fontSize: 16 }}>🎁</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary }}>レア以上のシール</span>
      </div>

      {showEveningNudge && status === "pending" && (
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.category.orange, marginBottom: 10, marginTop: 8 }}>
          まだ間に合うよ！
        </div>
      )}

      {status === "pending" && (
        <button type="button" onClick={onDone} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "none",
          backgroundColor: theme.category.purple, color: "#fff",
          fontSize: 15, fontWeight: 800, cursor: "pointer",
        }}>
          できた！
        </button>
      )}
    </div>
  );
}

export function MissionConfirmDialog({
  mission,
  onConfirm,
  onCancel,
}: {
  mission: DailyMission;
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
          本当にできた？
        </div>
        <div style={{ fontSize: 14, color: theme.text.secondary, marginBottom: 20 }}>
          {mission.title}
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
          がんばったら レア以上の シール！
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
  const [addToFavorites, setAddToFavorites] = useState(false);

  const emojiOptions = [...new Set([...MISSION_EMOJIS, ...customTaskEmojis])];

  const pickTemplate = (t: MissionTemplate) => {
    onSave({ title: t.title, emoji: t.emoji, source: "template" }, false);
  };

  const pickFavorite = (f: FavoriteMission) => {
    onSave({ title: f.title, emoji: f.emoji, source: "favorite" }, false);
  };

  const saveCustom = () => {
    const title = customTitle.trim();
    if (!title) return;
    onSave({ title, emoji: customEmoji, source: "custom" }, addToFavorites);
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
  completedAt,
  approved,
  onApprove,
  onReset,
  onHome,
}: {
  mission: DailyMission;
  completedAt: string;
  approved: boolean;
  onApprove: () => void;
  onReset: () => void;
  onHome: () => void;
}) {
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
        <div style={{ fontSize: 12, color: theme.text.tertiary }}>{completedAt} 完了</div>
      </div>

      <div style={{ textAlign: "center", paddingTop: 4 }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: theme.text.primary }}>
          特別ミッション できたよ！
        </div>
        <div style={{
          display: "inline-flex", marginTop: 6, padding: "3px 12px", borderRadius: 100,
          backgroundColor: `${theme.category.purple}18`,
        }}>
          <span style={{ fontSize: 12, color: theme.category.purple, fontWeight: 700 }}>とくべつミッション</span>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
        borderRadius: 14, backgroundColor: `${theme.category.purple}14`,
        border: `1.5px solid ${theme.category.purple}44`,
      }}>
        <span style={{ fontSize: 32 }}>{mission.emoji}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: theme.text.primary }}>{mission.title}</span>
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

      <div style={{ padding: 14, borderRadius: 14, border: `1.5px solid ${theme.stroke.secondary}`, backgroundColor: theme.fill.quaternary }}>
        <div style={{ fontSize: 11, color: theme.text.tertiary, marginBottom: 10, textAlign: "center" }}>ここは親がかくにんするところ</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div onClick={onApprove} style={{
            flex: 2, padding: "12px", borderRadius: 10, textAlign: "center",
            backgroundColor: approved ? `${theme.category.green}33` : theme.category.green,
            color: approved ? theme.category.green : "#fff",
            fontSize: 14, fontWeight: 800, cursor: approved ? "default" : "pointer",
          }}>
            {approved ? "✓ 承認ずみ" : "はんこを押す！"}
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
