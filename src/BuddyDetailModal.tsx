import { theme } from "./theme";
import { DUPLICATE_TOKEN_LABEL, REWARD_LOOKUP } from "./stickerRewards";
import { RarityBadge, StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import {
  BUDDY_TRAIN_TOKEN_COST, isBuddyMaxed, xpToNextLevel, type BuddyEntry,
} from "./buddyProgress";

interface Props {
  stickerId: string;
  entry: BuddyEntry;
  /** このシールが今日の相棒なら true */
  isBuddy: boolean;
  duplicateTokens: number;
  /** 未指定なら「今日の相棒にする」ボタンを出さない */
  onSelectBuddy?: (stickerId: string) => void;
  onTrainBuddy?: (stickerId: string) => void;
  onClose: () => void;
}

/** シールの詳細（レベル・XP・ダブりコイン育成）を表示するモーダル */
export function BuddyDetailModal({
  stickerId, entry, isBuddy, duplicateTokens, onSelectBuddy, onTrainBuddy, onClose,
}: Props) {
  const item = REWARD_LOOKUP[stickerId];
  if (!item) return null;

  return (
    <div
      data-modal-overlay
      onClick={onClose}
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
            level={entry.level}
            size="preview"
            isBuddy={isBuddy}
            showLevelBadge
            rarity={item.rarity}
          >
            <StickerFrameWithBadge
              rarity={item.rarity}
              showBadge={false}
              style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <StickerImg src={item.image} alt={item.label} padding={16} objectFit={item.imageFit ?? "contain"} />
            </StickerFrameWithBadge>
          </BuddyFrame>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, color: theme.text.primary, marginBottom: 6 }}>
          {item.label}
        </div>
        <div style={{ marginBottom: 8, display: "flex", justifyContent: "center", gap: 8, alignItems: "center" }}>
          <RarityBadge rarity={item.rarity} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: theme.text.secondary, marginBottom: 6 }}>
          Lv{entry.level}
          {isBuddyMaxed(entry)
            ? " · MAX"
            : ` · ${entry.xp}/${xpToNextLevel(entry.level)} XP`}
        </div>
        {!isBuddyMaxed(entry) && (
          <div style={{
            height: 10, borderRadius: 999, background: theme.fill.secondary,
            overflow: "hidden", marginBottom: 14,
          }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${Math.min(100, (entry.xp / Math.max(1, xpToNextLevel(entry.level))) * 100)}%`,
              background: `linear-gradient(90deg, ${theme.accent.primary}, ${theme.category.purple})`,
            }} />
          </div>
        )}
        {isBuddy ? (
          <div style={{
            width: "100%", padding: "12px", borderRadius: 12, marginBottom: 8,
            border: `1.5px solid ${theme.accent.primary}`,
            backgroundColor: `${theme.accent.primary}14`,
            color: theme.accent.primary,
            fontSize: 14, fontWeight: 800,
          }}>
            相棒中
          </div>
        ) : onSelectBuddy ? (
          <button
            type="button"
            onClick={() => onSelectBuddy(stickerId)}
            style={{
              width: "100%", marginBottom: 8, padding: "14px", borderRadius: 12, border: "none",
              backgroundColor: theme.accent.primary, color: "#fff",
              fontSize: 15, fontWeight: 800, cursor: "pointer",
            }}
          >
            今日の相棒にする
          </button>
        ) : null}
        {!isBuddyMaxed(entry) && onTrainBuddy && (
          <button
            type="button"
            disabled={duplicateTokens < BUDDY_TRAIN_TOKEN_COST}
            onClick={() => onTrainBuddy(stickerId)}
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
          {isBuddy
            ? "親がハンコを押すと、この相棒が育つよ"
            : `所持シールならどれでも${DUPLICATE_TOKEN_LABEL}で育てられるよ`}
        </div>
        <button
          type="button"
          onClick={onClose}
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
  );
}
