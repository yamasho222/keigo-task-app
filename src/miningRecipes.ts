/** 本家準拠レシピ（木〜ネザライト） */

import type { CraftedGearId, GachaId, MaterialId } from "./miningTypes";

export interface RecipeCost {
  material: MaterialId;
  amount: number;
  /** この燃料1つで何回精錬できるか。未指定は1 */
  crafts?: number;
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
  | "netherite_ingot_craft"
  | "netherite_upgrade_dupe"
  | "paper_batch"
  | "book_craft"
  | "obsidian_craft";

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
  /** エンチャントテーブルが必要 */
  needsEnchantingTable?: boolean;
  /** 鍛冶台が必要 */
  needsSmithingTable?: boolean;
  /**
   * 精錬の燃料（いずれか1つ）。石炭1で2回／板材2／原木2 など。
   * ある場合は costs に燃料を含めず、こちらで支払う。
   */
  fuelOptions?: RecipeCost[];
  /**
   * このガチャが解放されていると表示。
   * 未指定は最初から表示。
   */
  requiresUnlock?: GachaId;
}

/** 精錬燃料の標準（石炭1で2回、なければ板材2か原木2） */
export const SMELT_FUEL_OPTIONS: RecipeCost[] = [
  { material: "coal", amount: 1, crafts: 2 },
  { material: "plank", amount: 2 },
  { material: "log", amount: 2 },
];

export function fuelCraftsPerUnit(fuel: RecipeCost): number {
  return Math.max(1, Math.floor(fuel.crafts ?? 1));
}

/** 精錬 times 回に必要な燃料の個数 */
export function fuelAmountForTimes(fuel: RecipeCost, times: number): number {
  const n = Math.max(1, Math.floor(times));
  return Math.ceil((n * fuel.amount) / fuelCraftsPerUnit(fuel));
}

/** 石炭は1つで2回なので、個数の増減も2こずつ */
export function smeltQtyStep(fuel: RecipeCost | null | undefined): number {
  return fuel?.material === "coal" ? 2 : 1;
}

export function alignCraftTimes(times: number, maxTimes: number, step: number): number {
  const max = Math.max(0, Math.floor(maxTimes));
  if (max < 1) return 1;
  if (step <= 1) return Math.max(1, Math.min(Math.floor(times), max));
  if (max < step) return Math.max(1, Math.min(Math.floor(times), max));
  const steppedMax = max - (max % step);
  const raw = Math.floor(times);
  const aligned = raw - (raw % step);
  return Math.max(step, Math.min(aligned || step, steppedMax));
}

/** 石炭せいれんで素材が1こ／奇数のときの注意 */
export function coalSmeltRemainderWarning(oreCount: number): string | null {
  if (oreCount < 1) return null;
  if (oreCount === 1) return "石炭は1つで2こせいれんできるよ。1こだけだと石炭がもったいないよ";
  if (oreCount % 2 === 1) return "石炭は2こずつせいれんできるよ。1こ余るよ";
  return null;
}

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
  opts?: { needsEnchantingTable?: boolean },
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
    needsEnchantingTable: opts?.needsEnchantingTable,
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
    costs: [
      { material: "netherite_ingot", amount: 1 },
      { material: "netherite_upgrade", amount: 1 },
    ],
    needsSmithingTable: true,
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
  {
    id: "paper_batch",
    label: "紙",
    emoji: "📄",
    outputs: [{ material: "paper", amount: 3 }],
    costs: [{ material: "sugar_cane", amount: 3 }],
    requiresUnlock: "farm",
  },
  {
    id: "book_craft",
    label: "本",
    emoji: "📖",
    outputs: [{ material: "book", amount: 1 }],
    costs: [
      { material: "paper", amount: 3 },
      { material: "leather", amount: 1 },
    ],
    needsWorkbench: true,
    requiresUnlock: "ranch",
  },
  {
    id: "bucket_iron",
    label: "鉄のバケツ",
    emoji: "🪣",
    craftFlag: "bucket_iron",
    costs: [{ material: "iron_ingot", amount: 3 }],
    needsWorkbench: true,
    requiresUnlock: "iron",
  },
  {
    id: "obsidian_craft",
    label: "黒曜石",
    emoji: "⬛",
    outputs: [{ material: "obsidian", amount: 1 }],
    costs: [
      { material: "water", amount: 1 },
      { material: "lava", amount: 1 },
    ],
    requiresUnlock: "lava_cave",
  },
  {
    id: "enchanting_table",
    label: "エンチャントテーブル",
    emoji: "✨",
    craftFlag: "enchanting_table",
    costs: [
      { material: "obsidian", amount: 4 },
      { material: "diamond", amount: 2 },
      { material: "book", amount: 1 },
    ],
    needsWorkbench: true,
    requiresUnlock: "diamond",
  },
  {
    id: "smithing_table",
    label: "鍛冶台",
    emoji: "🛠️",
    craftFlag: "smithing_table",
    costs: [
      { material: "iron_ingot", amount: 4 },
      { material: "plank", amount: 2 },
    ],
    needsWorkbench: true,
    requiresUnlock: "nether",
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
    id: "netherite_upgrade_dupe",
    label: "鍛冶型の複製",
    emoji: "📜",
    outputs: [{ material: "netherite_upgrade", amount: 2 }],
    costs: [
      { material: "netherite_upgrade", amount: 1 },
      { material: "diamond", amount: 3 },
      { material: "netherrack", amount: 1 },
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

  // ダイヤ（鉄どうぐでしんそう解放後）
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

/** いまの材料・燃料で何回つくれるか。装備／設備は常に最大1。ベッドは残り枠まで。 */
export function maxCraftTimes(
  recipe: MiningRecipe,
  have: (id: MaterialId) => number,
  opts?: { fuel?: RecipeCost | null; remainingBeds?: number },
): number {
  if (recipe.craftFlag) {
    return canAffordRecipe(recipe.costs, have, recipe.fuelOptions) ? 1 : 0;
  }

  const per = new Map<MaterialId, number>();
  for (const c of recipe.costs) {
    per.set(c.material, (per.get(c.material) ?? 0) + c.amount);
  }
  let fuel: RecipeCost | null = null;
  if (recipe.fuelOptions?.length) {
    fuel = opts?.fuel ?? pickFuelOption(recipe.fuelOptions, have);
    if (!fuel) return 0;
  }

  let times = Number.POSITIVE_INFINITY;
  for (const [material, amount] of per) {
    if (amount <= 0) continue;
    times = Math.min(times, Math.floor(have(material) / amount));
  }
  if (fuel) {
    const fuelHave = have(fuel.material);
    const fromFuel = Math.floor(fuelHave / fuel.amount) * fuelCraftsPerUnit(fuel);
    times = Math.min(times, fromFuel);
  }
  if (!Number.isFinite(times)) times = 0;
  times = Math.max(0, times);

  if (recipe.grantsBed) {
    const remaining = Math.max(0, Math.floor(opts?.remainingBeds ?? 0));
    times = Math.min(times, remaining);
  }
  return times;
}

/** 解放状況に応じて表示するレシピ */
export function visibleRecipes(unlockedGachas: GachaId[]): MiningRecipe[] {
  const set = new Set(unlockedGachas);
  return MINING_RECIPES.filter((r) => !r.requiresUnlock || set.has(r.requiresUnlock));
}

export type CraftRecipeTab =
  | "all"
  | "material"
  | "sword"
  | "axe"
  | "pickaxe"
  | "armor"
  | "facility";

export const CRAFT_RECIPE_TABS: { id: CraftRecipeTab; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "material", label: "素材" },
  { id: "sword", label: "剣" },
  { id: "axe", label: "斧" },
  { id: "pickaxe", label: "ツルハシ" },
  { id: "armor", label: "防具" },
  { id: "facility", label: "せつび" },
];

const FACILITY_RECIPE_IDS = new Set<string>([
  "workbench",
  "furnace",
  "bed",
  "enchanting_table",
  "smithing_table",
  "bucket_iron",
]);

export function craftRecipeTabOf(recipe: MiningRecipe): Exclude<CraftRecipeTab, "all"> {
  const id = String(recipe.craftFlag ?? recipe.id);
  if (id.startsWith("sword_")) return "sword";
  if (id.startsWith("axe_")) return "axe";
  if (id.startsWith("pickaxe_")) return "pickaxe";
  if (
    id.startsWith("helmet_")
    || id.startsWith("chest_")
    || id.startsWith("leggings_")
    || id.startsWith("boots_")
  ) {
    return "armor";
  }
  if (recipe.grantsBed || FACILITY_RECIPE_IDS.has(id)) return "facility";
  return "material";
}

export function recipeMatchesCraftTab(recipe: MiningRecipe, tab: CraftRecipeTab): boolean {
  if (tab === "all") return true;
  return craftRecipeTabOf(recipe) === tab;
}

export function craftTabForRecipeId(recipeId: string): CraftRecipeTab {
  const recipe = MINING_RECIPES.find((r) => r.id === recipeId);
  return recipe ? craftRecipeTabOf(recipe) : "all";
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
  if (recipe.id === "paper_batch") {
    const g = empty();
    g[3] = "sugar_cane";
    g[4] = "sugar_cane";
    g[5] = "sugar_cane";
    return g;
  }
  if (recipe.id === "book_craft") {
    const g = empty();
    g[0] = "paper";
    g[1] = "paper";
    g[2] = "paper";
    g[4] = "leather";
    return g;
  }
  if (recipe.id === "bucket_iron") {
    const g = empty();
    g[3] = "iron_ingot";
    g[5] = "iron_ingot";
    g[7] = "iron_ingot";
    return g;
  }
  if (recipe.id === "obsidian_craft") {
    const g = empty();
    g[3] = "water";
    g[5] = "lava";
    return g;
  }
  if (recipe.id === "enchanting_table") {
    const g = empty();
    g[1] = "book";
    g[3] = "diamond";
    g[4] = "obsidian";
    g[5] = "diamond";
    g[6] = "obsidian";
    g[7] = "obsidian";
    g[8] = "obsidian";
    return g;
  }
  if (recipe.id === "smithing_table") {
    const g = empty();
    g[0] = "iron_ingot";
    g[1] = "iron_ingot";
    g[3] = "iron_ingot";
    g[4] = "iron_ingot";
    g[6] = "plank";
    g[7] = "plank";
    return g;
  }
  if (recipe.id === "netherite_upgrade_dupe") {
    const g = empty();
    g[1] = "diamond";
    g[3] = "diamond";
    g[4] = "netherite_upgrade";
    g[5] = "diamond";
    g[7] = "netherrack";
    return g;
  }
  if (main && id.includes("netherite") && id !== "netherite_ingot_craft" && id !== "netherite_upgrade_dupe") {
    const g = empty();
    g[3] = "netherite_upgrade";
    g[4] = "netherite_ingot";
    return g;
  }
  return null;
}
