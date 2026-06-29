import { theme } from "./theme";

export type StickerRarity =
  | "normal" | "rare" | "superRare" | "ultraRare" | "legendary";

export type RewardRarity = StickerRarity;

export const RARITY_ORDER: readonly StickerRarity[] = [
  "normal", "rare", "superRare", "ultraRare", "legendary",
];

export const RARITY_META: Record<StickerRarity, {
  label: string;
  compact: string;
  color: string;
  rank: number;
  tease: boolean;
  upgradeCutin: boolean;
}> = {
  normal: { label: "ノーマル", compact: "N", color: theme.category.green, rank: 0, tease: false, upgradeCutin: false },
  rare: { label: "レア", compact: "レア", color: theme.category.blue, rank: 1, tease: false, upgradeCutin: false },
  superRare: { label: "スーパーレア", compact: "SR", color: theme.category.purple, rank: 2, tease: true, upgradeCutin: true },
  ultraRare: { label: "ウルトラレア", compact: "UR", color: theme.category.orange, rank: 3, tease: true, upgradeCutin: true },
  legendary: { label: "レジェンドレア", compact: "LR", color: theme.category.yellow, rank: 4, tease: true, upgradeCutin: true },
};

/** 日次シール抽選（絵文字30%の後） */
export const TIER_WEIGHTS_DAILY: Record<StickerRarity, number> = {
  normal: 0.353,
  rare: 0.44,
  superRare: 0.15,
  ultraRare: 0.047,
  legendary: 0.01,
};

/** 1日全部クリアボーナス — レア以上確定 */
export const TIER_WEIGHTS_FULL_DAY: Record<"rare" | "superRare" | "ultraRare" | "legendary", number> = {
  rare: 0.50,
  superRare: 0.35,
  ultraRare: 0.12,
  legendary: 0.03,
};

/** 3日連続ごほうび — レア以上確定 */
export const TIER_WEIGHTS_THREE_DAY: Record<"rare" | "superRare" | "ultraRare" | "legendary", number> = {
  rare: 0.55,
  superRare: 0.32,
  ultraRare: 0.08,
  legendary: 0.05,
};

/** 20:50まで全部クリア — レア以上確定 */
export const TIER_WEIGHTS_DEADLINE_RARE_PLUS: Record<"rare" | "superRare" | "ultraRare" | "legendary", number> = {
  ...TIER_WEIGHTS_FULL_DAY,
};

/** 20:00まで全部クリア — UR以上確定 */
export const TIER_WEIGHTS_DEADLINE_UR_PLUS: Record<"ultraRare" | "legendary", number> = {
  ultraRare: 0.70,
  legendary: 0.30,
};

/** 20:30まで全部クリア — SR以上確定 */
export const TIER_WEIGHTS_DEADLINE_SR_PLUS: Record<"superRare" | "ultraRare" | "legendary", number> = {
  superRare: 0.65,
  ultraRare: 0.23,
  legendary: 0.12,
};

export const TIER_WEIGHTS_ONE_OFF_SPECIAL: Record<"rare" | "superRare" | "ultraRare", number> = {
  rare: 0.55,
  superRare: 0.30,
  ultraRare: 0.15,
};

/** 7日連続ごほうび — UR以上確定 */
export const TIER_WEIGHTS_WEEKLY: Record<"ultraRare" | "legendary", number> = {
  ultraRare: 0.60,
  legendary: 0.40,
};

export type LegendaryRevealMode = "cutin" | "direct";

export const LR_REVEAL_MODE_WEIGHTS = {
  cutin: 0.5,
  direct: 0.5,
} as const;

export function pickLegendaryRevealMode(
  isMissionStyle: boolean,
  force?: LegendaryRevealMode,
): LegendaryRevealMode {
  if (force) return force;
  if (isMissionStyle) return "direct";
  return Math.random() < LR_REVEAL_MODE_WEIGHTS.cutin ? "cutin" : "direct";
}

/** SR/UR: 期待演出（Tease）かカットイン昇格か — 同時には走らない */
export type SrUrRevealMode = "tease" | "cutin";

export const SR_UR_REVEAL_MODE_WEIGHTS = {
  tease: 0.5,
  cutin: 0.5,
} as const;

export function pickSrUrRevealMode(
  isMissionStyle: boolean,
  force?: SrUrRevealMode,
): SrUrRevealMode {
  if (force) return force;
  if (isMissionStyle) return "tease";
  return Math.random() < SR_UR_REVEAL_MODE_WEIGHTS.cutin ? "cutin" : "tease";
}

export const LR_RAINBOW_COLORS = [
  "#ff3366", "#ff8800", "#ffdd00", "#33dd66", "#3399ff", "#8844ff", "#ff44cc",
];
