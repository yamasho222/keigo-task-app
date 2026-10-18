/** Isolated campaign fixtures and pure rules. No production state or storage imports. */
export type ArmorTier = "none" | "gold" | "iron" | "diamond" | "netherite";
export type ArmorSlot = "helmet" | "chest" | "leggings" | "boots";
export type SwordTier = "none" | "wood" | "stone" | "iron" | "gold" | "diamond" | "netherite";
export const SWORD_POWER: Record<SwordTier, number> = { none: 1, wood: 2, stone: 3, iron: 3, gold: 2, diamond: 4, netherite: 6 };
export type EnchantRank = 0 | 1 | 2 | 3;
export type AttackEnchant = "none" | "power" | "ultimate" | "break";
export type DefenseEnchant = "none" | "protection" | "health" | "fire";
export type CampaignEquipment = {
  sword: SwordTier;
  armor: Record<ArmorSlot, ArmorTier>;
  shield: boolean;
  attack: { kind: AttackEnchant; rank: EnchantRank };
  defense: { kind: DefenseEnchant; rank: EnchantRank };
  buddies: { id: string; image: string; level: number }[];
};
export type CampaignSupplies = {
  materials: Record<string, number>;
  partySlots: number;
  hasTable: boolean;
  owned: Record<string, boolean>;
};
export type CampaignPlace = "farm" | "wood" | "ranch" | "lapis" | "nether";
export type CampaignTool = "wood" | "stone" | "iron" | "gold" | "diamond" | "netherite";

export const ARMOR_SLOTS: readonly ArmorSlot[] = ["helmet", "chest", "leggings", "boots"];
export const ARMOR_WEIGHTS: Record<ArmorSlot, number> = { helmet: 5, chest: 8, leggings: 7, boots: 4 };
export const ARMOR_PERCENT: Record<ArmorTier, number> = { none: 0, gold: 20, iron: 25, diamond: 40, netherite: 55 };
export const TOOL_BONUS: Record<CampaignTool, number> = { wood: .10, stone: .15, iron: .20, gold: .22, diamond: .25, netherite: .30 };

export function fullArmor(tier: ArmorTier): CampaignEquipment["armor"] {
  return { helmet: tier, chest: tier, leggings: tier, boots: tier };
}

export function defaultEquipment(): CampaignEquipment {
  return {
    sword: "diamond",
    armor: { ...fullArmor("iron"), chest: "diamond" },
    shield: true,
    attack: { kind: "none", rank: 0 },
    defense: { kind: "none", rank: 0 },
    buddies: ["mc-sheep", "mc-pig", "mc-iron-golem"].map(id => ({ id, image: `/stickers/${id}.png`, level: 10 })),
  };
}

export function defaultSupplies(): CampaignSupplies {
  return {
    materials: {
      plank: 18, wool: 9, wheat: 6, lapis_lazuli: 12, book: 2, quartz: 0,
      bread: 0, spare_bed: 0, sugar_cane: 0, paper: 0, leather: 0,
      log: 0, stick: 0, cobble: 0, iron_ingot: 0, gold_ingot: 0,
      diamond: 0, obsidian: 0, netherite_ingot: 0, netherite_upgrade: 0,
    },
    partySlots: 3,
    hasTable: true,
    owned: {
      sword_diamond: true, armor_helmet_iron: true, armor_chest_diamond: true,
      armor_leggings_iron: true, armor_boots_iron: true, shield: true,
      enchanting_table: true, axe_wood: true, pickaxe_wood: true,
    },
  };
}

function rankOf(value: number): EnchantRank {
  return (Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0) as EnchantRank;
}

function armorNumerator(equipment: CampaignEquipment): number {
  return ARMOR_SLOTS.reduce((sum, slot) => sum + ARMOR_WEIGHTS[slot] * (ARMOR_PERCENT[equipment.armor[slot]] ?? 0), 0);
}

/** Fraction removed, e.g. 0.4 for full diamond. Mixed armor uses 5:8:7:4 weights. */
export function armorRate(equipment: CampaignEquipment): number {
  return armorNumerator(equipment) / 2400;
}

export function maxHp(equipment: CampaignEquipment): number {
  return 20 + (equipment.defense.kind === "health" ? rankOf(equipment.defense.rank) * 2 : 0);
}

export function attackDamage(eq: CampaignEquipment, special: boolean, part: boolean, weak: boolean): { weapon: number; companions: number; total: number } {
  const rank = rankOf(eq.attack.rank);
  let weapon = SWORD_POWER[eq.sword] * (special ? 2 : 1);
  if (eq.attack.kind === "power" && !special) weapon += rank;
  if (eq.attack.kind === "ultimate" && special) weapon += rank * 4;
  if (eq.attack.kind === "break" && part) weapon += rank * (special ? 2 : 1);
  if (weak) weapon *= 2;
  const companions = special ? eq.buddies.slice(0, 3).reduce((sum, buddy) => {
    const level = Number.isFinite(buddy.level) ? Math.max(1, Math.min(10, Math.floor(buddy.level))) : 1;
    return sum + Math.ceil(level / 4);
  }, 0) : 0;
  return { weapon, companions, total: weapon + companions };
}

/** All reductions multiply as integer fractions; ceil exactly once at the end. */
export function incomingDamage(eq: CampaignEquipment, raw: number, kind: "physical" | "fire", guarding: boolean): number {
  if (!Number.isSafeInteger(raw) || raw <= 0) return 0;
  const rank = rankOf(eq.defense.rank);
  const reduction = eq.defense.kind === "protection" ? [0, 5, 10, 20][rank]
    : eq.defense.kind === "fire" && kind === "fire" ? [0, 20, 35, 50][rank] : 0;
  const guardPercent = guarding ? (eq.shield ? 20 : 50) : 100;
  const numerator = BigInt(raw) * BigInt(2400 - armorNumerator(eq)) * BigInt(100 - reduction) * BigInt(guardPercent);
  const denominator = 2400n * 100n * 100n;
  return Math.max(1, Number((numerator + denominator - 1n) / denominator));
}

export type CampaignRecipe = {
  id: string;
  label: string;
  image?: string;
  cost: Readonly<Record<string, number>>;
  output?: { material: string; count: number };
  owned?: string;
  requiresOwned?: string;
  effect?: "table" | "party";
};

/** Campaign material IDs intentionally use lapis_lazuli/quartz, not legacy lapis/nether_quartz. */
export const CAMPAIGN_MATERIALS: Readonly<Record<string, { label: string; image?: string }>> = {
  wheat: { label: "こむぎ" }, bread: { label: "パン" },
  spare_bed: { label: "バトルベッド", image: "/mining/White_Bed.png" },
  plank: { label: "いた", image: "/mining/Oak_Planks.webp" },
  log: { label: "げんぼく", image: "/mining/Oak_Genboku.png" },
  stick: { label: "ぼう", image: "/mining/Stick.png" },
  wool: { label: "ようもう", image: "/mining/White_Wool.png" },
  sugar_cane: { label: "さとうきび", image: "/mining/Sugar_Cane.webp" },
  paper: { label: "かみ", image: "/mining/Paper.webp" },
  leather: { label: "かわ", image: "/mining/Leather.webp" },
  book: { label: "ほん", image: "/mining/Book.webp" },
  lapis_lazuli: { label: "ラピス", image: "/mining/Lapis_Lazuli.webp" },
  quartz: { label: "クォーツ", image: "/mining/Nether_Quartz.png" },
  cobble: { label: "まるいし", image: "/mining/Cobblestone.png" },
  iron_ingot: { label: "てつ", image: "/mining/Iron_Ingot.png" },
  gold_ingot: { label: "きん", image: "/mining/Gold_Ingot.png" },
  diamond: { label: "ダイヤ", image: "/mining/Diamond.png" },
  obsidian: { label: "こくようせき", image: "/mining/Obsidian.png" },
  netherite_ingot: { label: "ネザライト", image: "/mining/Netherite_Ingot.png" },
  netherite_upgrade: { label: "きょうかの かた", image: "/mining/Netherite_Upgrade.png" },
};

export const ARMOR_LABELS: Record<ArmorSlot, string> = { helmet: "あたま", chest: "むね", leggings: "あし", boots: "くつ" };
export const TIER_LABELS: Record<ArmorTier | "wood" | "stone", string> = {
  none: "なし", wood: "き", stone: "いし", gold: "きん", iron: "てつ", diamond: "ダイヤ", netherite: "ネザライト",
};

export function campaignGearImage(id: string): string | undefined {
  const parts = id.replace(/^armor_/, "").split("_");
  const [slot, tier] = parts;
  if (id === "shield") return "/mining/Shield.webp";
  if (id === "enchanting_table") return "/mining/Enchanting_Table.png";
  const prefix: Record<string, string> = { wood: "Wooden", stone: "Stone", gold: "Golden", iron: "Iron", diamond: "Diamond", netherite: "Netherite" };
  const suffix: Record<string, string> = { sword: "Sword", axe: "Axe", pickaxe: "Pickaxe", helmet: "Helmet", chest: "Chestplate", leggings: "Leggings", boots: "Boots" };
  if (!prefix[tier] || !suffix[slot]) return undefined;
  if (tier === "netherite" && (slot === "chest" || slot === "leggings")) return `/mining/netherite_${suffix[slot].toLowerCase()}.png`;
  const webp = ARMOR_SLOTS.includes(slot as ArmorSlot) || (tier === "netherite" && slot !== "axe") || (tier === "wood" && slot === "pickaxe");
  return `/mining/${prefix[tier]}_${suffix[slot]}.${webp ? "webp" : "png"}`;
}

const gearRecipes: CampaignRecipe[] = [];
for (const tier of ["gold", "iron", "diamond", "netherite"] as const) {
  for (const slot of ARMOR_SLOTS) {
    const id = `armor_${slot}_${tier}`;
    gearRecipes.push({
      id, label: `${TIER_LABELS[tier]}の ${ARMOR_LABELS[slot]}`, image: campaignGearImage(id), owned: id,
      cost: tier === "netherite" ? { netherite_ingot: 1, netherite_upgrade: 1 } : { [tier === "diamond" ? "diamond" : `${tier}_ingot`]: ARMOR_WEIGHTS[slot] },
      requiresOwned: tier === "netherite" ? `armor_${slot}_diamond` : undefined,
    });
  }
}
for (const tier of ["wood", "stone", "iron", "gold", "diamond", "netherite"] as const) {
  for (const tool of ["axe", "pickaxe", "sword"] as const) {
    if (tool === "sword" && tier !== "diamond" && tier !== "netherite") continue;
    const id = `${tool}_${tier}`;
    const material = tier === "wood" ? "plank" : tier === "stone" ? "cobble" : tier === "diamond" ? "diamond" : `${tier}_ingot`;
    gearRecipes.push({
      id, label: `${TIER_LABELS[tier]}の ${tool === "sword" ? "けん" : tool === "axe" ? "おの" : "つるはし"}`, image: campaignGearImage(id), owned: id,
      cost: tier === "netherite" ? { netherite_ingot: 1, netherite_upgrade: 1 } : { [material]: tool === "sword" ? 2 : 3, stick: tool === "sword" ? 1 : 2 },
      requiresOwned: tier === "netherite" ? `${tool}_diamond` : undefined,
    });
  }
}

export const CAMPAIGN_RECIPES: readonly CampaignRecipe[] = [
  { id: "bread", label: "パン", cost: { wheat: 3 }, output: { material: "bread", count: 1 } },
  { id: "paper", label: "かみ ×3", image: "/mining/Paper.webp", cost: { sugar_cane: 3 }, output: { material: "paper", count: 3 } },
  { id: "book", label: "ほん", image: "/mining/Book.webp", cost: { paper: 3, leather: 1 }, output: { material: "book", count: 1 } },
  { id: "enchanting_table", label: "まほうのテーブル", image: "/mining/Enchanting_Table.png", cost: { obsidian: 4, diamond: 2, book: 1 }, owned: "enchanting_table", effect: "table" },
  { id: "shield", label: "たて", image: "/mining/Shield.webp", cost: { plank: 6, iron_ingot: 1 }, owned: "shield" },
  { id: "party_bed", label: "なかまのベッド", image: "/mining/White_Bed.png", cost: { plank: 3, wool: 3 }, effect: "party" },
  { id: "battle_bed", label: "バトルベッド", image: "/mining/White_Bed.png", cost: { plank: 3, wool: 3 }, output: { material: "spare_bed", count: 1 } },
  { id: "plank", label: "いた ×4", image: "/mining/Oak_Planks.webp", cost: { log: 1 }, output: { material: "plank", count: 4 } },
  { id: "stick", label: "ぼう ×4", image: "/mining/Stick.png", cost: { plank: 2 }, output: { material: "stick", count: 4 } },
  ...gearRecipes,
];

function validSupplies(supplies: CampaignSupplies): boolean {
  return Number.isInteger(supplies.partySlots) && supplies.partySlots >= 1 && supplies.partySlots <= 3
    && Object.values(supplies.materials).every(value => Number.isSafeInteger(value) && value >= 0);
}

function copySupplies(supplies: CampaignSupplies): CampaignSupplies {
  return { ...supplies, materials: { ...supplies.materials }, owned: { ...supplies.owned } };
}

function addMaterials(supplies: CampaignSupplies, gains: Record<string, number>): CampaignSupplies | undefined {
  const next = copySupplies(supplies);
  for (const [id, amount] of Object.entries(gains)) {
    const value = (next.materials[id] ?? 0) + amount;
    if (!Number.isSafeInteger(value)) return undefined;
    next.materials[id] = value;
  }
  return next;
}

export function campaignRecipeError(supplies: CampaignSupplies, recipeId: string): string | undefined {
  if (!validSupplies(supplies)) return "ざいりょうの かずを かくにんしてね";
  const recipe = CAMPAIGN_RECIPES.find(item => item.id === (recipeId === "table" ? "enchanting_table" : recipeId));
  if (!recipe) return "そのレシピは ないよ";
  if (recipe.effect === "party" && supplies.partySlots >= 3) return "なかまは 3にんまでだよ";
  if (recipe.effect === "table" && supplies.hasTable) return "テーブルは もうあるよ";
  if (recipe.owned && supplies.owned[recipe.owned]) return "もう もっているよ";
  if (recipe.requiresOwned && !supplies.owned[recipe.requiresOwned]) return "さきに ダイヤの そうびを つくってね";
  if (Object.entries(recipe.cost).some(([id, count]) => (supplies.materials[id] ?? 0) < count)) return "ざいりょうが たりないよ";
  if (recipe.output && !Number.isSafeInteger((supplies.materials[recipe.output.material] ?? 0) + recipe.output.count)) return "これいじょう もてないよ";
  return undefined;
}

export function craftCampaign(supplies: CampaignSupplies, recipeId: string): { supplies: CampaignSupplies; error?: string } {
  const error = campaignRecipeError(supplies, recipeId);
  if (error) return { supplies, error };
  const recipe = CAMPAIGN_RECIPES.find(item => item.id === (recipeId === "table" ? "enchanting_table" : recipeId))!;
  const next = copySupplies(supplies);
  for (const [id, count] of Object.entries(recipe.cost)) next.materials[id] = (next.materials[id] ?? 0) - count;
  if (recipe.output) next.materials[recipe.output.material] = (next.materials[recipe.output.material] ?? 0) + recipe.output.count;
  if (recipe.owned) next.owned[recipe.owned] = true;
  if (recipe.effect === "table") next.hasTable = true;
  if (recipe.effect === "party") next.partySlots += 1;
  return { supplies: next };
}

export function campaignUpgradeCost(rank: EnchantRank): Readonly<Record<string, number>> | undefined {
  if (rank === 0) return { lapis_lazuli: 6, book: 1 };
  if (rank === 1) return { lapis_lazuli: 10, quartz: 4 };
  if (rank === 2) return { lapis_lazuli: 14, quartz: 8 };
  return undefined;
}

export function upgradeCampaign(eq: CampaignEquipment, supplies: CampaignSupplies, category: "attack" | "defense"): { equipment: CampaignEquipment; supplies: CampaignSupplies; error?: string } {
  const fail = (error: string) => ({ equipment: eq, supplies, error });
  if (category !== "attack" && category !== "defense") return fail("まほうを えらんでね");
  if (!validSupplies(supplies)) return fail("ざいりょうの かずを かくにんしてね");
  if (!supplies.hasTable) return fail("まほうのテーブルが ひつようだよ");
  const enchant = eq[category];
  if (!Number.isInteger(enchant.rank) || enchant.rank < 0 || enchant.rank > 3) return fail("まほうの ほしを かくにんしてね");
  if (enchant.kind === "none") return fail("まほうの しゅるいを えらんでね");
  const cost = campaignUpgradeCost(enchant.rank);
  if (!cost) return fail("ほしは 3つまでだよ");
  if (Object.entries(cost).some(([id, count]) => (supplies.materials[id] ?? 0) < count)) return fail("ざいりょうが たりないよ");
  const next = copySupplies(supplies);
  for (const [id, count] of Object.entries(cost)) next.materials[id] = (next.materials[id] ?? 0) - count;
  const equipment = { ...eq, [category]: { ...enchant, rank: (enchant.rank + 1) as EnchantRank } };
  return { equipment, supplies: next };
}

/** roll must be finite in [0,1). One Bernoulli draw grants at most one extra wheat. Tickets belong to the parent. */
export function harvestCampaign(supplies: CampaignSupplies, place: CampaignPlace, roll: number, options?: { tool?: CampaignTool; buddyBonus?: number; outcome?: "normal" | "hit" | "jackpot" }): { supplies: CampaignSupplies; message: string } {
  const fail = (message: string) => ({ supplies, message });
  if (!validSupplies(supplies)) return fail("ざいりょうの かずを かくにんしてね");
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return fail("さいしゅうの すうじを かくにんしてね");
  const tool = options?.tool ?? "wood";
  const buddyBonus = options?.buddyBonus ?? 0;
  const outcome = options?.outcome ?? "normal";
  if (!Object.hasOwn(TOOL_BONUS, tool) || !Number.isFinite(buddyBonus) || buddyBonus < 0 || !["normal", "hit", "jackpot"].includes(outcome)) return fail("さいしゅうの せっていを かくにんしてね");
  let gains: Record<string, number>;
  switch (place) {
    case "farm": gains = { wheat: 3 + (outcome === "jackpot" ? 2 : outcome === "hit" ? 1 : 0) + (roll < Math.min(1, TOOL_BONUS[tool] + buddyBonus) ? 1 : 0), sugar_cane: 3 }; break;
    case "wood": gains = { log: 3, plank: 6, stick: 2 }; break;
    case "ranch": gains = { wool: 3, leather: 2 }; break;
    case "lapis": gains = { lapis_lazuli: 6, iron_ingot: 3, diamond: 2, cobble: 3 }; break;
    case "nether": gains = { quartz: 4, obsidian: 2, gold_ingot: 3, netherite_ingot: 1, netherite_upgrade: 1 }; break;
    default: return fail("その ばしょは ないよ");
  }
  const next = addMaterials(supplies, gains);
  if (!next) return fail("これいじょう もてないよ");
  return { supplies: next, message: Object.entries(gains).map(([id, count]) => `${CAMPAIGN_MATERIALS[id]?.label ?? id} +${count}`).join("、") };
}
