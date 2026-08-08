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
   * 精錬の燃料（いずれか1つ）。石炭1／板材2／原木2 など。
   * ある場合は costs に燃料を含めず、こちらで支払う。
   */
  fuelOptions?: RecipeCost[];
  /**
   * このガチャが解放されていると表示。
   * 未指定は最初から表示。
   */
  requiresUnlock?: GachaId;
}

/** 精錬燃料の標準（石炭1、なければ板材2か原木2） */
export const SMELT_FUEL_OPTIONS: RecipeCost[] = [
  { material: "coal", amount: 1 },
  { material: "plank", amount: 2 },
  { material: "log", amount: 2 },
];

/** 持てる燃料を優先順（石炭→板材→原木）で選ぶ */
export function pickFuelOption(
  fuelOptions: RecipeCost[] | undefined,
  have: (id: MaterialId) => number,
): RecipeCost | null {
  if (!fuelOptions?.length) return null;
  for (const opt of fuelOptions) {
    if (have(opt.material) >= opt.amount) return opt;
  }
  return null;
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

  // 精錬（かまど＋燃料：石炭1 または 板材/原木2）
  {
    id: "smelt_iron",
    label: "鉄インゴット（精錬）",
    emoji: "⚙️",
    outputs: [{ material: "iron_ingot", amount: 1 }],
    costs: [{ material: "iron_ore", amount: 1 }],
    fuelOptions: SMELT_FUEL_OPTIONS,
    needsFurnace: true,
    requiresUnlock: "iron",
  },
  {
    id: "smelt_gold",
    label: "金インゴット（精錬）",
    emoji: "🥇",
    outputs: [{ material: "gold_ingot", amount: 1 }],
    costs: [{ material: "gold_ore", amount: 1 }],
    fuelOptions: SMELT_FUEL_OPTIONS,
    needsFurnace: true,
    requiresUnlock: "gold",
  },
  {
    id: "smelt_debris",
    label: "ネザライトの欠片（精錬）",
    emoji: "📎",
    outputs: [{ material: "netherite_scrap", amount: 1 }],
    costs: [{ material: "ancient_debris", amount: 1 }],
    fuelOptions: SMELT_FUEL_OPTIONS,
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
  armorRecipe("leggings_iron", "鉄のレギンス", "iron_ingot", 7, "iron"),
  armorRecipe("boots_iron", "鉄のブーツ", "iron_ingot", 4, "iron"),

  // 金（任意ルート）
  toolRecipe("sword_gold", "金の剣", "⚔️", "gold_ingot", 2, "gold"),
  toolRecipe("axe_gold", "金の斧", "🪓", "gold_ingot", 3, "gold"),
  toolRecipe("pickaxe_gold", "金のツルハシ", "⛏️", "gold_ingot", 3, "gold"),
  armorRecipe("helmet_gold", "金のヘルメット", "gold_ingot", 5, "gold"),
  armorRecipe("chest_gold", "金のむねあて", "gold_ingot", 8, "gold"),
  armorRecipe("leggings_gold", "金のレギンス", "gold_ingot", 7, "gold"),
  armorRecipe("boots_gold", "金のブーツ", "gold_ingot", 4, "gold"),

  // ダイヤ
  toolRecipe("sword_diamond", "ダイヤの剣", "⚔️", "diamond", 2, "diamond"),
  toolRecipe("axe_diamond", "ダイヤの斧", "🪓", "diamond", 3, "diamond"),
  toolRecipe("pickaxe_diamond", "ダイヤのツルハシ", "⛏️", "diamond", 3, "diamond"),
  armorRecipe("helmet_diamond", "ダイヤのヘルメット", "diamond", 5, "diamond"),
  armorRecipe("chest_diamond", "ダイヤのむねあて", "diamond", 8, "diamond"),
  armorRecipe("leggings_diamond", "ダイヤのレギンス", "diamond", 7, "diamond"),
  armorRecipe("boots_diamond", "ダイヤのブーツ", "diamond", 4, "diamond"),

  // ネザライト強化
  netheriteUpgrade("sword_netherite", "ネザライトの剣", "⚔️"),
  netheriteUpgrade("axe_netherite", "ネザライトの斧", "🪓"),
  netheriteUpgrade("pickaxe_netherite", "ネザライトのツルハシ", "⛏️"),
  netheriteUpgrade("helmet_netherite", "ネザライトのヘルメット", "🛡️"),
  netheriteUpgrade("chest_netherite", "ネザライトのむねあて", "🛡️"),
  netheriteUpgrade("leggings_netherite", "ネザライトのレギンス", "🛡️"),
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
  fuelOptions?: RecipeCost[],
): boolean {
  if (!costs.every((c) => have(c.material) >= c.amount)) return false;
  if (fuelOptions?.length) return pickFuelOption(fuelOptions, have) !== null;
  return true;
}

/** 解放状況に応じて表示するレシピ */
export function visibleRecipes(unlockedGachas: GachaId[]): MiningRecipe[] {
  const set = new Set(unlockedGachas);
  return MINING_RECIPES.filter((r) => !r.requiresUnlock || set.has(r.requiresUnlock));
}

/** 3×3クラフトの形を見せる用（操作はさせない）。精錬は null */
export function craftGridForRecipe(recipe: MiningRecipe): (MaterialId | null)[] | null {
  if (recipe.fuelOptions?.length) return null;
  const empty = (): (MaterialId | null)[] => Array.from({ length: 9 }, () => null);
  const id = String(recipe.id);
  const main = recipe.costs.find((c) => c.material !== "stick")?.material ?? null;
  const hasStick = recipe.costs.some((c) => c.material === "stick");

  if (id.startsWith("sword_") && main && hasStick) {
    const g = empty();
    g[1] = main;
    g[4] = main;
    g[7] = "stick";
    return g;
  }
  if (id.startsWith("pickaxe_") && main && hasStick) {
    const g = empty();
    g[0] = main;
    g[1] = main;
    g[2] = main;
    g[4] = "stick";
    g[7] = "stick";
    return g;
  }
  if (id.startsWith("axe_") && main && hasStick) {
    const g = empty();
    g[0] = main;
    g[1] = main;
    g[3] = main;
    g[4] = "stick";
    g[7] = "stick";
    return g;
  }
  if (id.startsWith("helmet_") && main) {
    const g = empty();
    g[0] = main;
    g[1] = main;
    g[2] = main;
    g[3] = main;
    g[5] = main;
    return g;
  }
  if (id.startsWith("chest_") && main) {
    const g = empty();
    g[0] = main;
    g[2] = main;
    g[3] = main;
    g[4] = main;
    g[5] = main;
    g[6] = main;
    g[7] = main;
    g[8] = main;
    return g;
  }
  if (id.startsWith("leggings_") && main) {
    const g = empty();
    g[0] = main;
    g[1] = main;
    g[2] = main;
    g[3] = main;
    g[5] = main;
    g[6] = main;
    g[8] = main;
    return g;
  }
  if (id.startsWith("boots_") && main) {
    const g = empty();
    g[3] = main;
    g[5] = main;
    g[6] = main;
    g[8] = main;
    return g;
  }
  if (recipe.id === "workbench") {
    const g = empty();
    g[0] = "plank";
    g[1] = "plank";
    g[3] = "plank";
    g[4] = "plank";
    return g;
  }
  if (recipe.id === "furnace") {
    const g = empty();
    for (const i of [0, 1, 2, 3, 5, 6, 7, 8]) g[i] = "cobble";
    return g;
  }
  if (recipe.id === "bed") {
    const g = empty();
    g[0] = "wool";
    g[1] = "wool";
    g[2] = "wool";
    g[3] = "plank";
    g[4] = "plank";
    g[5] = "plank";
    return g;
  }
  if (recipe.id === "plank_batch") {
    const g = empty();
    g[4] = "log";
    return g;
  }
  if (recipe.id === "stick_batch") {
    const g = empty();
    g[1] = "plank";
    g[4] = "plank";
    return g;
  }
  if (recipe.id === "diamond_from_shards") {
    return Array.from({ length: 9 }, () => "diamond_shard" as MaterialId);
  }
  if (recipe.id === "netherite_ingot_craft") {
    const g = empty();
    g[0] = "netherite_scrap";
    g[1] = "netherite_scrap";
    g[2] = "gold_ingot";
    g[3] = "netherite_scrap";
    g[4] = "netherite_scrap";
    g[5] = "gold_ingot";
    g[6] = "gold_ingot";
    g[8] = "gold_ingot";
    return g;
  }
  if (main && id.includes("netherite")) {
    const g = empty();
    g[4] = main;
    return g;
  }
  return null;
}
