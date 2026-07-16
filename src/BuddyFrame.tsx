import type { CSSProperties, ReactNode } from "react";
import { BUDDY_MAX_LEVEL } from "./buddyProgress";
import { RarityBadgeCorner } from "./Rewards";
import type { RewardRarity } from "./stickerRewards";

export type BuddyFrameSize = "cell" | "preview" | "card";

interface Props {
  level: number;
  size?: BuddyFrameSize;
  isBuddy?: boolean;
  showLevelBadge?: boolean;
  /** 指定時はフレーム左上隅にレアバッジ（画像の上には載せない） */
  rarity?: RewardRarity;
  maxed?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

function clampLevel(level: number): number {
  return Math.min(BUDDY_MAX_LEVEL, Math.max(1, Math.floor(level || 1)));
}

/** 絆レベルに応じた外側フレーム。画像色は変更しない。 */
export function BuddyFrame({
  level,
  size = "cell",
  isBuddy = false,
  showLevelBadge = true,
  rarity,
  maxed,
  children,
  style,
  className = "",
}: Props) {
  const lv = clampLevel(level);
  const isMax = maxed ?? lv >= BUDDY_MAX_LEVEL;
  const sizeClass = `buddy-frame--${size}`;
  const compactRarity = size === "cell";

  return (
    <div
      className={`buddy-frame buddy-frame--lv${lv} ${sizeClass} ${isBuddy ? "buddy-frame--active" : ""} ${className}`}
      style={style}
    >
      {rarity && (
        <div className="buddy-frame__rarity">
          <RarityBadgeCorner rarity={rarity} compact={compactRarity} />
        </div>
      )}
      {lv >= 9 && lv < 10 && (
        <div className="buddy-frame__sparks" aria-hidden>
          <i /><i /><i /><i /><i /><i /><i /><i />
          <b /><b /><b /><b />
        </div>
      )}
      <div className="buddy-frame__shell">
        <div className="buddy-frame__plate">
          {showLevelBadge && (
            <span className="buddy-frame__lv">Lv{lv}</span>
          )}
          {isMax && size !== "cell" && (
            <span className="buddy-frame__max">MAX</span>
          )}
          {(lv >= 5) && <div className="buddy-frame__sheen" aria-hidden />}
          <div className="buddy-frame__content">{children}</div>
        </div>
      </div>
      {isBuddy && <span className="buddy-frame__buddy-dot" aria-label="今日の相棒" />}
    </div>
  );
}
