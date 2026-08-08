import type { CSSProperties } from "react";
import {
  GEAR_IMAGE,
  MATERIAL_META,
  BED_IMAGE,
  type CraftedGearId,
  type MaterialId,
} from "./miningTypes";

interface Props {
  material?: MaterialId;
  gear?: CraftedGearId;
  /** ベッド画像 */
  bed?: boolean;
  /** 絵文字フォールバック */
  emoji?: string;
  size?: number;
  alt?: string;
  style?: CSSProperties;
}

/** 採掘アイテム画像。なければ絵文字を出す */
export function MiningItemIcon({
  material,
  gear,
  bed,
  emoji,
  size = 24,
  alt = "",
  style,
}: Props) {
  const src = bed
    ? BED_IMAGE
    : material
      ? MATERIAL_META[material].image
      : gear
        ? GEAR_IMAGE[gear]
        : undefined;
  const fallback = bed
    ? (emoji ?? "🛏️")
    : material
      ? MATERIAL_META[material].emoji
      : (emoji ?? "📦");

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          imageRendering: "pixelated",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(12, size * 0.72),
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {fallback}
    </span>
  );
}
