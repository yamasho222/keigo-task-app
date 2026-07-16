import { theme } from "./theme";
import {
  REWARD_LOOKUP, dedupeStickerIds,
} from "./stickerRewards";
import { StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";

interface Props {
  stickerAlbum: string[];
  buddyProgress?: BuddyProgressMap;
  onSelect: (stickerId: string) => void;
  onDismiss: () => void;
}

export function BuddySelectPrompt({
  stickerAlbum, buddyProgress, onSelect, onDismiss,
}: Props) {
  const owned = dedupeStickerIds(stickerAlbum).filter((id) => REWARD_LOOKUP[id]);

  return (
    <div
      data-modal-overlay
      style={{
        position: "fixed", inset: 0, zIndex: 140,
        backgroundColor: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 360, maxHeight: "88vh",
          borderRadius: 22, padding: "22px 16px 16px",
          backgroundColor: theme.bg.editor,
          boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
          display: "flex", flexDirection: "column",
          minHeight: 0,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 6, flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: theme.text.primary }}>
            今日の相棒をえらぼう！
          </div>
          <div style={{ fontSize: 12, color: theme.text.secondary, marginTop: 6, lineHeight: 1.5 }}>
            親がハンコを押すと、選んだシールが育つよ。<br />
            先に相棒をセットしよう！
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-start",
          padding: "10px 4px 8px",
        }}>
          {owned.map((id) => {
            const item = REWARD_LOOKUP[id];
            const entry = getBuddyEntry(buddyProgress, id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                style={{
                  width: 72, border: "none", background: "transparent",
                  cursor: "pointer", padding: 0, textAlign: "center",
                }}
              >
                <div style={{ width: 72, height: 72 }}>
                  <BuddyFrame level={entry.level} size="cell" showLevelBadge rarity={item.rarity}>
                    <StickerFrameWithBadge
                      rarity={item.rarity}
                      compact
                      showBadge={false}
                      style={{
                        width: "100%", height: "100%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: item.emoji ? 28 : undefined,
                      }}
                    >
                      {item.emoji ? (
                        item.emoji
                      ) : (
                        <StickerImg
                          src={item.image!}
                          alt={item.label}
                          padding={5}
                          objectFit={item.imageFit ?? "contain"}
                        />
                      )}
                    </StickerFrameWithBadge>
                  </BuddyFrame>
                </div>
                <div style={{
                  marginTop: 4, fontSize: 10, fontWeight: 700, color: theme.text.secondary,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {item.label}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          style={{
            width: "100%", marginTop: 8, padding: "12px", borderRadius: 12, flexShrink: 0,
            border: `1.5px solid ${theme.stroke.secondary}`,
            backgroundColor: theme.fill.secondary, color: theme.text.secondary,
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          あとで選ぶ
        </button>
      </div>
    </div>
  );
}
