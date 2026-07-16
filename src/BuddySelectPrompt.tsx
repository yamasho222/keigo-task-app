import { theme } from "./theme";
import {
  dedupeStickerIds, getAlbumCategoryGroups,
} from "./stickerRewards";
import { StickerFrameWithBadge, StickerImg } from "./Rewards";
import { BuddyFrame } from "./BuddyFrame";
import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";

interface Props {
  stickerAlbum: string[];
  buddyProgress?: BuddyProgressMap;
  /** すでに相棒がいるときは変更モードの文言になる */
  currentBuddyId?: string | null;
  onSelect: (stickerId: string) => void;
  onDismiss: () => void;
}

export function BuddySelectPrompt({
  stickerAlbum, buddyProgress, currentBuddyId = null, onSelect, onDismiss,
}: Props) {
  const isChange = Boolean(currentBuddyId);
  const owned = new Set(dedupeStickerIds(stickerAlbum));
  /** カテゴリ順・各カテゴリ内はレアリティ高い順（アルバムと同じ） */
  const groups = getAlbumCategoryGroups(stickerAlbum)
    .map((group) => ({
      ...group,
      rewards: group.rewards.filter((r) => owned.has(r.id)),
    }))
    .filter((group) => group.rewards.length > 0);

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
            {isChange ? "相棒をかえよう！" : "今日の相棒をえらぼう！"}
          </div>
          <div style={{ fontSize: 12, color: theme.text.secondary, marginTop: 6, lineHeight: 1.5 }}>
            {isChange ? (
              <>親がハンコを押すと、選んだシールが育つよ。<br />別のシールにかえられるよ。</>
            ) : (
              <>親がハンコを押すと、選んだシールが育つよ。<br />先に相棒をセットしよう！</>
            )}
          </div>
        </div>

        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          display: "flex", flexDirection: "column", gap: 14,
          padding: "10px 4px 8px",
        }}>
          {groups.map((group) => (
            <div key={group.category}>
              <div style={{
                fontSize: 11, fontWeight: 800, color: theme.text.secondary,
                marginBottom: 8, letterSpacing: 0.4,
              }}>
                {group.label}
              </div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 10,
                padding: "2px 2px 0",
              }}>
                {group.rewards.map((item) => {
                  const entry = getBuddyEntry(buddyProgress, item.id);
                  const isEmoji = item.kind === "emoji";
                  const isCurrent = currentBuddyId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item.id)}
                      style={{
                        width: 72, border: "none", background: "transparent",
                        cursor: "pointer", padding: 0, textAlign: "center",
                      }}
                    >
                      <div style={{ width: 72, height: 72 }}>
                        <BuddyFrame
                          level={entry.level}
                          size="cell"
                          isBuddy={isCurrent}
                          showLevelBadge
                          rarity={item.rarity}
                        >
                          <StickerFrameWithBadge
                            rarity={item.rarity}
                            compact
                            showBadge={false}
                            style={{
                              width: "100%", height: "100%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: isEmoji ? 28 : undefined,
                            }}
                          >
                            {isEmoji ? (
                              item.emoji
                            ) : (
                              <StickerImg
                                src={item.image}
                                alt={item.label}
                                padding={5}
                                objectFit={item.imageFit ?? "contain"}
                              />
                            )}
                          </StickerFrameWithBadge>
                        </BuddyFrame>
                      </div>
                      <div style={{
                        marginTop: 4, fontSize: 10, fontWeight: 700,
                        color: isCurrent ? theme.accent.primary : theme.text.secondary,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {isCurrent ? "いまの相棒" : item.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
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
          {isChange ? "やめる" : "あとで選ぶ"}
        </button>
      </div>
    </div>
  );
}
