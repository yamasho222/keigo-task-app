/** 本家準拠レシピ（木〜ネザライト） */

import type { CraftedGearId, GachaId, MaterialId } from "./miningTypes";

export interface RecipeCost {
  material: MaterialId;
  amount: number;
}

export type RecipeId =
  | CraftedGearId
  | "plank_batch"
  | "stick_batch"
  | "bed"
  | "diamond_from_shards"
  | "smelt_iron"
  | "smelt_gold"
  | "smelt_debris"
  | "netherite_ingot_craft";

export interface MiningRecipe {
  id: RecipeId;
  label: string;
  emoji: string;
  /** 成果物が設備・装備の場合 */
  craftFlag?: CraftedGearId;
  /** 成果で増える素材 */
  outputs?: RecipeCost[];
  /** ベッドを1つ増やす（パーティ枠+1） */
  grantsBed?: boolean;
  costs: RecipeCost[];
  /** 作業台が必要 */
  needsWorkbench?: boolean;
  /** かまどが必要 */
  needsFurnace?: boolean;
  /**
   * このガチャが解放されていると表示。
   * 未指定は最初から表示。
   */
  requiresUnlock?: GachaId;
}

function toolRecipe(
  id: Extract<CraftedGearId, `${"sword" | "axe" | "pickaxe"}_${string}`>,
  label: string,
  emoji: string,
  main: MaterialId,
  mainAmount: number,
  unlock: GachaId,
): MiningRecipe {
  const stickAmount = id.startsWith("sword_") ? 1 : 2;
  return {
    id,
    label,
    emoji,
    craftFlag: id,
    costs: [
      { material: main, amount: mainAmount },
      { material: "stick", amount: stickAmount },
    ],
    needsWorkbench: true,
    requiresUnlock: unlock,
  };
}

function armorRecipe(
  id: Extract<CraftedGearId, `${"helmet" | "chest" | "leggings" | "boots"}_${string}`>,
  label: string,
  main: MaterialId,
  amount: number,
  unlock: GachaId,
): MiningRecipe {
  return {
    id,
    label,
    emoji: "🛡️",
    craftFlag: id,
    costs: [{ material: main, amount: amount }],
    needsWorkbench: true,
    requiresUnlock: unlock,
  };
}

function netheriteUpgrade(
  id: CraftedGearId,
  label: string,
  emoji: string,
): MiningRecipe {
  return {
    id,
    label,
    emoji,
    craftFlag: id,
    costs: [{ material: "netherite_ingot", amount: 1 }],
    needsWorkbench: true,
    requiresUnlock: "nether",
  };
}

export const NETHERITE_UPGRADE_REQUIRES: Partial<Record<CraftedGearId, CraftedGearId>> = {
  sword_netherite: "sword_diamond",
  axe_netherite: "axe_diamond",
  pickaxe_netherite: "pickaxe_diamond",
  helmet_netherite: "helmet_diamond",
  chest_netherite: "chest_diamond",
  leggings_netherite: "leggings_diamond",
  boots_netherite: "boots_diamond",
};

export const MINING_RECIPES: MiningRecipe[] = [
  {
    id: "plank_batch",
    label: "板材",
    emoji: "🟫",
    outputs: [{ material: "plank", amount: 4 }],
    costs: [{ material: "log", amount: 1 }],
  },
  {
    id: "stick_batch",
    label: "棒",
    emoji: "🥢",
    outputs: [{ material: "stick", amount: 4 }],
    costs: [{ material: "plank", amount: 2 }],
  },
  {
    id: "workbench",
    label: "作業台",
    emoji: "🪵",
    craftFlag: "workbench",
    costs: [{ material: "plank", amount: 4 }],
  },
  {
    id: "bed",
    label: "ベッド",
    emoji: "🛏️",
    grantsBed: true,
    costs: [
      { material: "wool", amount: 3 },
      { material: "plank", amount: 3 },
    ],
    needsWorkbench: true,
  },
  {
    id: "furnace",
    label: "かまど",
    emoji: "🔥",
    craftFlag: "furnace",
    costs: [{ material: "cobble", amount: 8 }],
    needsWorkbench: true,
  },

  // 木
  toolRecipe("sword_wood", "木の剣", "⚔️", "plank", 2, "wood"),
  toolRecipe("axe_wood", "木の斧", "🪓", "plank", 3, "wood"),
  toolRecipe("pickaxe_wood", "木のツルハシ", "⛏️", "plank", 3, "wood"),

  // 石
  toolRecipe("sword_stone", "石の剣", "⚔️", "cobble", 2, "stone"),
  toolRecipe("axe_stone", "石の斧", "🪓", "cobble", 3, "stone"),
  toolRecipe("pickaxe_stone", "石のツルハシ", "⛏️", "cobble", 3, "stone"),

  // 精錬
  {
    id: "smelt_iron",
    label: "鉄インゴット（精錬）",
    emoji: "⚙️",
    outputs: [{ material: "iron_ingot", amount: 1 }],
    costs: [
      { material: "iron_ore", amount: 1 },
      { material: "plank", amount: 1 },
    ],
    needsFurnace: true,
    requiresUnlock: "iron",
  },
  {
    id: "smelt_gold",
    label: "金インゴット（精錬）",
    emoji: "🥇",
    outputs: [{ material: "gold_ingot", amount: 1 }],
    costs: [
      { material: "gold_ore", amount: 1 },
      { material: "plank", amount: 1 },
    ],
    needsFurnace: true,
    requiresUnlock: "gold",
  },
  {
    id: "smelt_debris",
    label: "ネザライトの欠片（精錬）",
    emoji: "📎",
    outputs: [{ material: "netherite_scrap", amount: 1 }],
    costs: [
      { material: "ancient_debris", amount: 1 },
      { material: "plank", amount: 1 },
    ],
    needsFurnace: true,
    requiresUnlock: "nether",
  },
  {
    id: "netherite_ingot_craft",
    label: "ネザライトインゴット",
    emoji: "🛡️",
    outputs: [{ material: "netherite_ingot", amount: 1 }],
    costs: [
      { material: "netherite_scrap", amount: 4 },
      { material: "gold_ingot", amount: 4 },
    ],
    needsWorkbench: true,
    requiresUnlock: "nether",
  },
  {
    id: "diamond_from_shards",
    label: "ダイヤ（欠片から）",
    emoji: "💠",
    outputs: [{ material: "diamond", amount: 1 }],
    costs: [{ material: "diamond_shard", amount: 9 }],
    needsWorkbench: true,
    requiresUnlock: "diamond",
  },

  // 鉄
  toolRecipe("sword_iron", "鉄の剣", "⚔️", "iron_ingot", 2, "iron"),
  toolRecipe("axe_iron", "鉄の斧", "🪓", "iron_ingot", 3, "iron"),
  toolRecipe("pickaxe_iron", "鉄のツルハシ", "⛏️", "iron_ingot", 3, "iron"),
  armorRecipe("helmet_iron", "鉄のヘルメット", "iron_ingot", 5, "iron"),
  armorRecipe("chest_iron", "鉄のむねあて", "iron_ingot", 8, "iron"),
  armorRecipe("leggings_iron", "鉄のすねあて", "iron_ingot", 7, "iron"),
  armorRecipe("boots_iron", "鉄のブーツ", "iron_ingot", 4, "iron"),

  // 金（任意ルート）
  toolRecipe("sword_gold", "金の剣", "⚔️", "gold_ingot", 2, "gold"),
  toolRecipe("axe_gold", "金の斧", "🪓", "gold_ingot", 3, "gold"),
  toolRecipe("pickaxe_gold", "金のツルハシ", "⛏️", "gold_ingot", 3, "gold"),
  armorRecipe("helmet_gold", "金のヘルメット", "gold_ingot", 5, "gold"),
  armorRecipe("chest_gold", "金のむねあて", "gold_ingot", 8, "gold"),
  armorRecipe("leggings_gold", "金のすねあて", "gold_ingot", 7, "gold"),
  armorRecipe("boots_gold", "金のブーツ", "gold_ingot", 4, "gold"),

  // ダイヤ
  toolRecipe("sword_diamond", "ダイヤの剣", "⚔️", "diamond", 2, "diamond"),
  toolRecipe("axe_diamond", "ダイヤの斧", "🪓", "diamond", 3, "diamond"),
  toolRecipe("pickaxe_diamond", "ダイヤのツルハシ", "⛏️", "diamond", 3, "diamond"),
  armorRecipe("helmet_diamond", "ダイヤのヘルメット", "diamond", 5, "diamond"),
  armorRecipe("chest_diamond", "ダイヤのむねあて", "diamond", 8, "diamond"),
  armorRecipe("leggings_diamond", "ダイヤのすねあて", "diamond", 7, "diamond"),
  armorRecipe("boots_diamond", "ダイヤのブーツ", "diamond", 4, "diamond"),

  // ネザライト強化
  netheriteUpgrade("sword_netherite", "ネザライトの剣", "⚔️"),
  netheriteUpgrade("axe_netherite", "ネザライトの斧", "🪓"),
  netheriteUpgrade("pickaxe_netherite", "ネザライトのツルハシ", "⛏️"),
  netheriteUpgrade("helmet_netherite", "ネザライトのヘルメット", "🛡️"),
  netheriteUpgrade("chest_netherite", "ネザライトのむねあて", "🛡️"),
  netheriteUpgrade("leggings_netherite", "ネザライトのすねあて", "🛡️"),
  netheriteUpgrade("boots_netherite", "ネザライトのブーツ", "🛡️"),
];

export function recipeProgress(
  costs: RecipeCost[],
  have: (id: MaterialId) => number,
): { cost: RecipeCost; have: number; need: number; ok: boolean }[] {
  return costs.map((cost) => {
    const h = have(cost.material);
    return {
      cost,
      have: h,
      need: Math.max(0, cost.amount - h),
      ok: h >= cost.amount,
    };
  });
}

export function canAffordRecipe(
  costs: RecipeCost[],
  have: (id: MaterialId) => number,
): boolean {
  return costs.every((c) => have(c.material) >= c.amount);
}

/** 解放状況に応じて表示するレシピ */
export function visibleRecipes(unlockedGachas: GachaId[]): MiningRecipe[] {
  const set = new Set(unlockedGachas);
  return MINING_RECIPES.filter((r) => !r.requiresUnlock || set.has(r.requiresUnlock));
}
