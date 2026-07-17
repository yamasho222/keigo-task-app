import { theme } from "./theme";
import {
  DUPLICATE_TOKEN_COSTS,
  DUPLICATE_TOKEN_EXCHANGE_TIERS,
  DUPLICATE_TOKEN_LABEL,
  RARITY_LABELS,
  countUncollectedStickersByRarity,
  dedupeStickerIds,
  type DuplicateTokenExchangeTier,
} from "./stickerRewards";
import { RARITY_META } from "./rarityMeta";
import { BUDDY_TRAIN_TOKEN_COST } from "./buddyProgress";

interface Props {
  duplicateTokens: number;
  stickerAlbum: string[];
  onRedeem: (tier: DuplicateTokenExchangeTier) => void;
  onClose: () => void;
}

export function DuplicateTokenShop({
  duplicateTokens, stickerAlbum, onRedeem, onClose,
}: Props) {
  const uniqueAlbum = dedupeStickerIds(stickerAlbum);

  return (
    <div
      data-modal-overlay
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 130,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 400, maxHeight: "85vh",
          borderRadius: 20, padding: "20px 18px 18px",
          backgroundColor: theme.bg.editor,
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: theme.category.orange }}>
            🪙 {DUPLICATE_TOKEN_LABEL}交換所
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none", background: "none", cursor: "pointer",
              fontSize: 22, color: theme.text.tertiary, lineHeight: 1, padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: 32, fontWeight: 900, color: theme.text.primary, textAlign: "center", margin: "8px 0 4px" }}>
          {duplicateTokens}
        </div>
        <div style={{ fontSize: 12, color: theme.text.tertiary, textAlign: "center", marginBottom: 14, lineHeight: 1.5 }}>
          同じシールがかぶると、レア度に応じてコインがたまるよ。<br />
          N1 / レア2 / SR3 / UR4 / LR5<br />
          まだ持っていないシールと交換したり、相棒を育てたり（{BUDDY_TRAIN_TOKEN_COST}こで+1XP）できるよ。
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DUPLICATE_TOKEN_EXCHANGE_TIERS.map((tier) => {
            const cost = DUPLICATE_TOKEN_COSTS[tier];
            const remaining = countUncollectedStickersByRarity(uniqueAlbum, tier);
            const canAfford = duplicateTokens >= cost;
            const enabled = remaining > 0 && canAfford;
            return (
              <button
                key={tier}
                type="button"
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) return;
                  if (!window.confirm(
                    `${RARITY_LABELS[tier]}の未所持シールを1枚もらう？（${cost}${DUPLICATE_TOKEN_LABEL}）`,
                  )) return;
                  onRedeem(tier);
                }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                  padding: "12px 14px", borderRadius: 12,
                  cursor: enabled ? "pointer" : "default",
                  border: `1.5px solid ${enabled ? RARITY_META[tier].color : theme.stroke.secondary}`,
                  backgroundColor: enabled ? `${RARITY_META[tier].color}14` : theme.fill.quaternary,
                  color: enabled ? theme.text.primary : theme.text.tertiary,
                  opacity: remaining === 0 ? 0.55 : 1,
                }}
              >
                <span style={{
                  fontSize: 14, fontWeight: 800,
                  color: enabled ? RARITY_META[tier].color : theme.text.tertiary,
                }}>
                  {RARITY_LABELS[tier]}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
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

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%", marginTop: 14, padding: "13px", borderRadius: 12, border: "none",
            backgroundColor: theme.accent.primary, color: "#fff",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
          }}
        >
          とじる
        </button>
      </div>
    </div>
  );
}
