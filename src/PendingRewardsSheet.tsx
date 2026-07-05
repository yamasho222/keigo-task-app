import { theme } from "./theme";
import type { PendingRewardItem } from "./pendingRewards";

const KIND_EMOJI: Record<PendingRewardItem["kind"], string> = {
  daily: "🎁",
  deadline: "⏰",
  threeDay: "🎉",
  weekly: "🎊",
  specialMission: "⭐",
  oneOffSpecial: "🎯",
  fullDayBonus: "🌟",
};

interface Props {
  items: PendingRewardItem[];
  onClaim: (item: PendingRewardItem) => void;
  onClose: () => void;
}

export function PendingRewardsSheet({ items, onClaim, onClose }: Props) {
  return (
    <div
      data-modal-overlay
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 125,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, maxHeight: "80dvh",
          borderRadius: "20px 20px 0 0",
          backgroundColor: theme.bg.editor,
          padding: "20px 16px max(env(safe-area-inset-bottom, 16px), 16px)",
          overflowY: "auto",
        }}
      >
        <div style={{
          fontSize: 18, fontWeight: 800, color: theme.text.primary,
          textAlign: "center", marginBottom: 4,
        }}>
          もらえるごほうび
        </div>
        <div style={{
          fontSize: 12, color: theme.text.tertiary, textAlign: "center", marginBottom: 16,
        }}>
          {items.length}こ あるよ
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 14,
                backgroundColor: theme.fill.quaternary,
                border: `1.5px solid ${theme.stroke.secondary}`,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{KIND_EMOJI[item.kind]}</span>
              <span style={{
                flex: 1, fontSize: 14, fontWeight: 700, color: theme.text.primary,
                minWidth: 0,
              }}>
                {item.label}
              </span>
              <button
                type="button"
                onClick={() => onClaim(item)}
                style={{
                  flexShrink: 0, padding: "8px 14px", borderRadius: 10, border: "none",
                  backgroundColor: theme.accent.primary, color: "#fff",
                  fontSize: 13, fontWeight: 800, cursor: "pointer",
                }}
              >
                もらう！
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%", marginTop: 14, padding: "13px 0", borderRadius: 12,
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

export function PendingRewardsBanner({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 12, border: "none",
        backgroundColor: `${theme.category.green}18`,
        borderWidth: 1.5,
        borderStyle: "solid",
        borderColor: `${theme.category.green}55`,
        display: "flex", alignItems: "center", gap: 8,
        cursor: "pointer", textAlign: "left",
      }}
    >
      <span style={{ fontSize: 18 }}>🎁</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: theme.category.green }}>
        もらえるごほうびが {count} こある！
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: theme.text.secondary }}>タップ</span>
    </button>
  );
}

export function DeferRewardHintToast({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", left: 16, right: 16,
        bottom: "max(env(safe-area-inset-bottom, 72px), 72px)",
        zIndex: 130, padding: "12px 16px", borderRadius: 12,
        backgroundColor: theme.text.primary,
        color: "#fff", fontSize: 13, fontWeight: 600,
        textAlign: "center", boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        cursor: "pointer",
      }}
    >
      あとで、メニュー（≡）か上のバナーからもらえるよ
    </div>
  );
}
