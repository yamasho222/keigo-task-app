/** ドロップ解決・パーティ／道具補正・解放判定 */

import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import { REWARD_LOOKUP } from "./stickerRewards";
import {
  canAffordRecipe,
  fuelAmountForTimes,
  maxCraftTimes,
  NETHERITE_UPGRADE_REQUIRES,
  pickFuelOption,
  visibleRecipes,
  type MiningRecipe,
  type RecipeCost,
} from "./miningRecipes";
import {
  bonusStarChance,
  efficiencyBonus,
  fortuneBonus,
  prospectBonus,
  refundBonus,
  sumEnchantBonus,
  bargainStars,
} from "./miningEnchant";
import {
  CATEGORY_SPECIALTY,
  GACHA_META,
  LUCKY_GACHA_EXCLUDE,
  MAX_BEDS,
  enchantTargetOfGear,
  gearLabel,
  getMaterialCount,
  writeMaterialCount,
  MATERIAL_META,
  parseToolId,
  partySlotCount,
  tierRank,
  armorTierEffectCopy,
  isAxeGacha,
  isBucketGacha,
  type ArmorKind,
  type CraftedGearId,
  type GachaId,
  type GearTier,
  type MaterialId,
  type MiningSpecialty,
  type MiningState,
  type ToolKind,
} from "./miningTypes";

const TIER_PLUS1: Record<GearTier, number> = {
  wood: 0.1,
  stone: 0.15,
  iron: 0.2,
  gold: 0.22,
  diamond: 0.25,
  netherite: 0.3,
};

const TIER_LEGGINGS_BYPRODUCT: Record<"iron" | "gold" | "diamond" | "netherite", number> = {
  iron: 0.09,
  gold: 0.13,
  diamond: 0.17,
  netherite: 0.21,
};

const TIER_BOOTS: Record<GearTier, number> = {
  wood: 0,
  stone: 0,
  iron: 0.05,
  gold: 0.08,
  diamond: 0.11,
  netherite: 0.15,
};

const TIER_JACKPOT: Record<GearTier, number> = {
  wood: 0.07,
  stone: 0.09,
  iron: 0.11,
  gold: 0.12,
  diamond: 0.13,
  netherite: 0.15,
};

/** 掘り弱体化・直ドロップ（1箇所に集約） */
export const DIG_TWO_RATE = 0.18;
export const SWORD_INGOT_DIRECT_RATE = 0.12;
export const SWORD_DIAMOND_DIRECT_RATE = 0.1;
export const DEBRIS_BASE_RATE = 0.2;
export const DEBRIS_RATE_CAP = 0.45;
export const BASTION_TEMPLATE_RATE = 0.1;

export const GACHA_PRIMARY: Record<GachaId, MaterialId | null> = {
  wood: "log",
  farm: "sugar_cane",
  ranch: "wool",
  stone: "cobble",
  river: null,
  iron: "iron_ore",
  coal: "coal",
  gold: "gold_ore",
  lava_cave: null,
  diamond: "diamond_shard",
  lapis_cave: "lapis",
  nether: "nether_quartz",
  bastion: "netherrack",
};

export function specialtyForGacha(gacha: GachaId): MiningSpecialty {
  return GACHA_META[gacha].specialty;
}

export function bestOwnedTool(
  state: MiningState,
  kind: ToolKind,
): CraftedGearId | null {
  const tiers: GearTier[] = ["netherite", "diamond", "gold", "iron", "stone", "wood"];
  for (const tier of tiers) {
    const id = `${kind}_${tier}` as CraftedGearId;
    if (state.crafted[id]) return id;
  }
  return null;
}

export function recommendToolKind(gacha: GachaId): ToolKind {
  if (isAxeGacha(gacha)) return "axe";
  return "pickaxe";
}

export function hasWorkbench(state: MiningState): boolean {
  return !!state.crafted.workbench;
}

export function hasFurnace(state: MiningState): boolean {
  return !!state.crafted.furnace;
}

export function hasEnchantingTable(state: MiningState): boolean {
  return !!state.crafted.enchanting_table;
}

export function hasSmithingTable(state: MiningState): boolean {
  return !!state.crafted.smithing_table;
}

export function hasBucket(state: MiningState): boolean {
  return !!state.crafted.bucket_iron;
}

function toolAtLeast(state: MiningState, kind: ToolKind, minTier: GearTier): boolean {
  const best = bestOwnedTool(state, kind);
  if (!best) return false;
  const parsed = parseToolId(best);
  if (!parsed) return false;
  return tierRank(parsed.tier) >= tierRank(minTier);
}

function armorAtLeast(state: MiningState, kind: ArmorKind, minTier: GearTier): boolean {
  const tiers: GearTier[] = ["netherite", "diamond", "gold", "iron"];
  for (const tier of tiers) {
    if (tierRank(tier) < tierRank(minTier)) continue;
    const id = `${kind}_${tier}` as CraftedGearId;
    if (state.crafted[id]) return true;
  }
  return false;
}

export function woodToolsComplete(state: MiningState): boolean {
  return toolAtLeast(state, "sword", "wood")
    && toolAtLeast(state, "axe", "wood")
    && toolAtLeast(state, "pickaxe", "wood");
}

export function stoneToolsComplete(state: MiningState): boolean {
  return toolAtLeast(state, "sword", "stone")
    && toolAtLeast(state, "axe", "stone")
    && toolAtLeast(state, "pickaxe", "stone");
}

export function ironToolsComplete(state: MiningState): boolean {
  return toolAtLeast(state, "sword", "iron")
    && toolAtLeast(state, "axe", "iron")
    && toolAtLeast(state, "pickaxe", "iron");
}

export function ironArmorComplete(state: MiningState): boolean {
  return (
    armorAtLeast(state, "helmet", "iron")
    && armorAtLeast(state, "chest", "iron")
    && armorAtLeast(state, "leggings", "iron")
    && armorAtLeast(state, "boots", "iron")
  );
}

/** 鉄フル（道具3＋防具4） */
export function ironFullComplete(state: MiningState): boolean {
  return ironToolsComplete(state) && ironArmorComplete(state);
}

export function diamondToolsComplete(state: MiningState): boolean {
  return toolAtLeast(state, "sword", "diamond")
    && toolAtLeast(state, "axe", "diamond")
    && toolAtLeast(state, "pickaxe", "diamond");
}

/** ネザライトどうぐ3＋よろい4をクラフト済み（揃え特典の条件） */
export function netheriteFullComplete(state: MiningState): boolean {
  return !!(
    state.crafted.sword_netherite
    && state.crafted.axe_netherite
    && state.crafted.pickaxe_netherite
    && state.crafted.helmet_netherite
    && state.crafted.chest_netherite
    && state.crafted.leggings_netherite
    && state.crafted.boots_netherite
  );
}

export function refreshUnlocks(state: MiningState): MiningState {
  const unlocked = new Set(state.unlockedGachas);
  unlocked.add("wood");
  if (woodToolsComplete(state)) {
    unlocked.add("stone");
    unlocked.add("farm");
    unlocked.add("ranch");
  }
  if (stoneToolsComplete(state)) {
    unlocked.add("iron");
    unlocked.add("coal");
    unlocked.add("gold");
    unlocked.add("river");
  }
  if (ironToolsComplete(state)) {
    unlocked.add("diamond");
    unlocked.add("lava_cave");
    unlocked.add("lapis_cave");
  }
  if (diamondToolsComplete(state)) {
    unlocked.add("nether");
    unlocked.add("bastion");
  }
  return { ...state, unlockedGachas: [...unlocked] };
}

const WOOD_UNLOCK_REQ: CraftedGearId[] = ["sword_wood", "axe_wood", "pickaxe_wood"];
const STONE_UNLOCK_REQ: CraftedGearId[] = ["sword_stone", "axe_stone", "pickaxe_stone"];
const IRON_UNLOCK_REQ: CraftedGearId[] = ["sword_iron", "axe_iron", "pickaxe_iron"];
const NETHER_UNLOCK_REQ: CraftedGearId[] = [
  "sword_diamond",
  "axe_diamond",
  "pickaxe_diamond",
];

/** refreshUnlocks と同じ条件。ロック中の表示用 */
export function gachaUnlockRequirementIds(gacha: GachaId): CraftedGearId[] {
  switch (gacha) {
    case "stone":
    case "farm":
    case "ranch":
      return WOOD_UNLOCK_REQ;
    case "iron":
    case "coal":
    case "gold":
    case "river":
      return STONE_UNLOCK_REQ;
    case "diamond":
    case "lava_cave":
    case "lapis_cave":
      return IRON_UNLOCK_REQ;
    case "nether":
    case "bastion":
      return NETHER_UNLOCK_REQ;
    default:
      return [];
  }
}

function isGachaUnlockReqMet(state: MiningState, id: CraftedGearId): boolean {
  if (id === "enchanting_table") return hasEnchantingTable(state);
  const parsed = parseToolId(id);
  if (parsed) return toolAtLeast(state, parsed.kind, parsed.tier);
  return !!state.crafted[id];
}

export function gachaLockBadge(gacha: GachaId): string {
  const ids = gachaUnlockRequirementIds(gacha);
  if (!ids.length) return "まだひらいてない";
  return ids.map(gearLabel).join("・");
}

export function gachaLockHint(gacha: GachaId, state: MiningState): string {
  const ids = gachaUnlockRequirementIds(gacha);
  const place = GACHA_META[gacha].label;
  if (!ids.length) return `${place}はまだひらいてない`;
  const lines = ids.map((id) => {
    const done = isGachaUnlockReqMet(state, id);
    return `${gearLabel(id)}（${done ? "できた" : "まだ"}）`;
  });
  return `${place}をひらくには\n${lines.join("\n")}`;
}

export function partySpecialtyBonus(
  state: MiningState,
  buddyProgress: BuddyProgressMap | undefined,
  gacha: GachaId,
): { bonusChance: number; matchCount: number; detail: string[] } {
  const want = specialtyForGacha(gacha);
  const detail: string[] = [];
  let bonusChance = 0;
  let matchCount = 0;

  for (let i = 0; i < partySlotCount(state); i++) {
    const id = state.partyIds[i];
    if (!id) continue;
    const item = REWARD_LOOKUP[id];
    if (!item) continue;
    const entry = getBuddyEntry(buddyProgress, id);
    const spec = CATEGORY_SPECIALTY[item.category] ?? "wood";
    const levelFactor = (entry.level / 10) * 0.15;
    if (spec === want) {
      matchCount += 1;
      bonusChance += levelFactor;
      detail.push(`${item.label} Lv${entry.level}（とくい）`);
    } else if (gacha === "wood" && spec !== "wood") {
      bonusChance += levelFactor * 0.5;
      detail.push(`${item.label}（半分・き）`);
    }
  }

  if (matchCount >= 3) bonusChance += 0.05;
  else if (matchCount >= 2) bonusChance += 0.03;

  bonusChance = Math.min(0.45, bonusChance);
  return { bonusChance, matchCount, detail };
}

export function toolPlus1Chance(toolId: CraftedGearId | null, gacha: GachaId): number {
  const parsed = parseToolId(toolId);
  if (!parsed) return 0;
  if (parsed.kind === "axe" && isAxeGacha(gacha)) {
    return TIER_PLUS1[parsed.tier];
  }
  if (
    parsed.kind === "pickaxe"
    && !isAxeGacha(gacha)
    && !isBucketGacha(gacha)
  ) {
    return TIER_PLUS1[parsed.tier];
  }
  return 0;
}

export function equippedArmorTier(
  state: MiningState,
  slot: ArmorKind,
): "iron" | "gold" | "diamond" | "netherite" | null {
  const id = state.equipped[slot];
  if (!id || !state.crafted[id]) return null;
  const m = new RegExp(`^${slot}_(iron|gold|diamond|netherite)$`).exec(id);
  if (!m) return null;
  return m[1] as "iron" | "gold" | "diamond" | "netherite";
}

/** @deprecated レギンスは副産物へ。互換のため常に0 */
export function leggingsPlus1Chance(_state: MiningState): number {
  return 0;
}

export function leggingsByproductChance(state: MiningState): number {
  const tier = equippedArmorTier(state, "leggings");
  if (!tier) return 0;
  return TIER_LEGGINGS_BYPRODUCT[tier];
}

const LEGGINGS_BYPRODUCT_BASIC: Partial<Record<GachaId, MaterialId>> = {
  wood: "stick",
  farm: "paper",
  ranch: "leather",
  stone: "coal",
  iron: "cobble",
  coal: "cobble",
  gold: "coal",
  diamond: "coal",
  lapis_cave: "cobble",
  nether: "gold_ore",
  bastion: "netherrack",
};

const LEGGINGS_BYPRODUCT_BETTER: Partial<Record<GachaId, MaterialId>> = {
  wood: "plank",
  farm: "paper",
  ranch: "leather",
  stone: "coal",
  iron: "coal",
  coal: "cobble",
  gold: "iron_ore",
  diamond: "lapis",
  lapis_cave: "coal",
  nether: "gold_ore",
  bastion: "netherrack",
};

export function rollLeggingsByproduct(
  state: MiningState,
  gacha: GachaId,
  rand: () => number = Math.random,
): { material: MaterialId; amount: number } | null {
  const tier = equippedArmorTier(state, "leggings");
  if (!tier) return null;
  if (rand() >= TIER_LEGGINGS_BYPRODUCT[tier]) return null;
  let material = LEGGINGS_BYPRODUCT_BASIC[gacha];
  if (!material) return null;
  if (tier === "diamond" || tier === "netherite") {
    const better = LEGGINGS_BYPRODUCT_BETTER[gacha];
    const betterChance = tier === "netherite" ? 0.55 : 0.35;
    if (better && rand() < betterChance) material = better;
  }
  let amount = 1;
  if ((tier === "gold" || tier === "netherite") && rand() < 0.25) amount = 2;
  return { material, amount };
}

export type HelmetRockHint =
  | { kind: "none" }
  | { kind: "miss"; index: number }
  | { kind: "hit"; index: number };

/** ヘルメット材質に応じた岩ヒント（鉄=なし／金=たまにはずれ1／ダイヤ=はずれ1／ネザ=あたり） */
export function resolveHelmetRockHint(
  state: MiningState,
  luckyIndex: number,
  rand: () => number = Math.random,
): HelmetRockHint {
  const tier = equippedArmorTier(state, "helmet");
  if (!tier) return { kind: "none" };
  if (tier === "iron") return { kind: "none" };
  if (tier === "netherite") {
    return { kind: "hit", index: Math.max(0, Math.min(2, luckyIndex)) };
  }
  const missPool = [0, 1, 2].filter((i) => i !== luckyIndex);
  const missIndex = missPool[Math.floor(rand() * missPool.length)] ?? 0;
  if (tier === "diamond") return { kind: "miss", index: missIndex };
  // gold: たまに
  if (rand() < 0.4) return { kind: "miss", index: missIndex };
  return { kind: "none" };
}

export function swordJackpotRate(toolId: CraftedGearId | null): number {
  const parsed = parseToolId(toolId);
  if (!parsed || parsed.kind !== "sword") return 0.05;
  return TIER_JACKPOT[parsed.tier];
}

export function bootsRefundChance(state: MiningState): number {
  const id = state.equipped.boots;
  if (!id) return 0;
  const m = /^boots_(iron|gold|diamond|netherite)$/.exec(id);
  if (!m) return 0;
  return TIER_BOOTS[m[1] as GearTier];
}

export function luckyGachaForDate(
  dateKey: string,
  unlocked: GachaId[],
  hasHelmet: boolean,
): GachaId | null {
  if (!hasHelmet || unlocked.length === 0) return null;
  const pool = unlocked.filter((id) => !LUCKY_GACHA_EXCLUDE.has(id));
  if (pool.length === 0) return null;
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}

export interface DigBoostLine {
  label: string;
  value: string;
  hint?: string;
  active: boolean;
}

export interface OddsSegment {
  key: string;
  label: string;
  rate: number;
}

export interface ArmorOddsNote {
  slot: ArmorKind;
  gear: CraftedGearId;
  text: string;
}

export interface DigBoostPreview {
  usedTool: CraftedGearId | null;
  recommended: boolean;
  jackpotRate: number;
  twoRate: number;
  toolPlus1Rate: number;
  leggingsPlus1Rate: number;
  partyPlus1Rate: number;
  partyDetail: string[];
  bootsRefundRate: number;
  luckyToday: boolean;
  expectedExtra: number;
  /** 1回で出るきほん素材の見込み個数 */
  expectedCount: number;
  lines: DigBoostLine[];
  bucketMode: boolean;
  baseOdds: OddsSegment[];
  finalOdds: OddsSegment[];
  armorNotes: ArmorOddsNote[];
}

const COUNT_ODDS_ORDER = ["1", "2", "3", "4+"] as const;

/** どうぐ・ぼうぐ・なかま・まほうを外した比較用 */
export function strippedMiningStateForOdds(state: MiningState): MiningState {
  return {
    ...state,
    crafted: {},
    partyIds: [null, null, null],
    equipped: {
      tool: null,
      helmet: null,
      chest: null,
      leggings: null,
      boots: null,
    },
    enchants: {},
  };
}

export function compareDigCountOdds(
  bare: OddsSegment[],
  current: OddsSegment[],
): { key: string; label: string; before: number; after: number }[] {
  const labelOf = (key: string, segments: OddsSegment[]): string =>
    segments.find((s) => s.key === key)?.label ?? (key === "4+" ? "4こ+" : `${key}こ`);
  const rateOf = (segments: OddsSegment[], key: string): number =>
    segments.find((s) => s.key === key)?.rate ?? 0;
  return COUNT_ODDS_ORDER.flatMap((key) => {
    const before = rateOf(bare, key);
    const after = rateOf(current, key);
    if (before < 0.005 && after < 0.005) return [];
    return [{
      key,
      label: labelOf(key, after >= 0.005 ? current : bare),
      before,
      after,
    }];
  });
}

function poissonBinomial(probs: number[]): number[] {
  let dp = [1];
  for (const raw of probs) {
    const p = Math.min(1, Math.max(0, raw));
    if (p <= 0) continue;
    const next = Array.from({ length: dp.length + 1 }, () => 0);
    for (let k = 0; k < dp.length; k++) {
      next[k] += dp[k] * (1 - p);
      next[k + 1] += dp[k] * p;
    }
    dp = next;
  }
  return dp;
}

function keepOdds(segments: OddsSegment[]): OddsSegment[] {
  return segments.filter((s) => s.rate >= 0.005);
}

function equippedArmorId(state: MiningState, slot: ArmorKind): CraftedGearId | null {
  const id = state.equipped[slot];
  if (!id || !state.crafted[id]) return null;
  return id;
}

function buildArmorNotes(
  state: MiningState,
  gacha: GachaId,
  lucky: GachaId | null,
  leggingsByproductRate: number,
  bootsRefundRate: number,
): ArmorOddsNote[] {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const notes: ArmorOddsNote[] = [];
  const helm = equippedArmorTier(state, "helmet");
  const helmId = equippedArmorId(state, "helmet");
  if (helm && helmId) {
    let text = armorTierEffectCopy("helmet", helm);
    if (lucky) {
      text += lucky === gacha
        ? "（きょうはここ）"
        : `（きょうは${GACHA_META[lucky].label}）`;
    }
    notes.push({ slot: "helmet", gear: helmId, text });
  }
  const chest = equippedArmorTier(state, "chest");
  const chestId = equippedArmorId(state, "chest");
  if (chest && chestId) {
    notes.push({ slot: "chest", gear: chestId, text: armorTierEffectCopy("chest", chest) });
  }
  const legs = equippedArmorTier(state, "leggings");
  const legsId = equippedArmorId(state, "leggings");
  if (legs && legsId) {
    const copy = armorTierEffectCopy("leggings", legs);
    notes.push({
      slot: "leggings",
      gear: legsId,
      text: leggingsByproductRate > 0 ? `${copy} ${pct(leggingsByproductRate)}` : copy,
    });
  }
  const boots = equippedArmorTier(state, "boots");
  const bootsId = equippedArmorId(state, "boots");
  if (boots && bootsId) {
    const copy = armorTierEffectCopy("boots", boots);
    notes.push({
      slot: "boots",
      gear: bootsId,
      text: bootsRefundRate > 0 ? `${copy} ${pct(bootsRefundRate)}` : copy,
    });
  }
  return notes;
}

/** 掘る直前のパーティ＋装備補正プレビュー */
export function previewDigBoost(params: {
  state: MiningState;
  gacha: GachaId;
  toolKind: ToolKind;
  buddyProgress?: BuddyProgressMap;
  dateKey: string;
}): DigBoostPreview {
  const usedTool = bestOwnedTool(params.state, params.toolKind);
  const jackpotRate = Math.min(
    0.25,
    swordJackpotRate(usedTool)
      + sumEnchantBonus(params.state, "fortune", fortuneBonus, params.toolKind),
  );
  const toolPlus1Rate = isBucketGacha(params.gacha) ? 0 : toolPlus1Chance(usedTool, params.gacha);
  const enchantPlus1 = isBucketGacha(params.gacha) ? 0 : Math.min(
    0.35,
    sumEnchantBonus(params.state, "efficiency", efficiencyBonus, params.toolKind),
  );
  const leggingsByproductRate = isBucketGacha(params.gacha) ? 0 : leggingsByproductChance(params.state);
  const party = isBucketGacha(params.gacha)
    ? { bonusChance: 0, matchCount: 0, detail: [] as string[] }
    : partySpecialtyBonus(params.state, params.buddyProgress, params.gacha);
  const bootsRefundRate = isBucketGacha(params.gacha) ? 0 : Math.min(
    0.25,
    bootsRefundChance(params.state)
      + sumEnchantBonus(params.state, "refund", refundBonus, params.toolKind),
  );
  const hasHelmet = !!(params.state.equipped.helmet && params.state.crafted[params.state.equipped.helmet]);
  const lucky = luckyGachaForDate(params.dateKey, params.state.unlockedGachas, hasHelmet);
  const luckyToday =
    !isBucketGacha(params.gacha)
    && lucky === params.gacha
    && hasHelmet
    && params.state.luckyBonusClaimedDate !== params.dateKey;
  const prospectPlus1 = (
    !isBucketGacha(params.gacha) && lucky === params.gacha
  )
    ? Math.min(0.35, sumEnchantBonus(params.state, "prospect", prospectBonus, params.toolKind))
    : 0;
  const expectedExtra =
    toolPlus1Rate + enchantPlus1 + party.bonusChance + prospectPlus1 + (luckyToday ? 1 : 0);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const twoRate = isBucketGacha(params.gacha) ? 0 : DIG_TWO_RATE;
  const oneRate = isBucketGacha(params.gacha) ? 1 : Math.max(0, 1 - jackpotRate - twoRate);
  const shownJackpot = isBucketGacha(params.gacha) ? 0 : jackpotRate;
  const lines: DigBoostLine[] = [
    {
      label: "きほん個数",
      value: `1個 ${pct(oneRate)} / +1 ${pct(twoRate)} / +3 ${pct(shownJackpot)}`,
      hint: parseToolId(usedTool)?.kind === "sword" ? "剣でたまに素材+3（+1より弱め）" : "剣なしは素材+3が5%",
      active: true,
    },
    {
      label: "どうぐ +1",
      value: toolPlus1Rate > 0 ? pct(toolPlus1Rate) : "なし",
      hint: usedTool ? gearLabel(usedTool) : "ほるどうぐなし",
      active: toolPlus1Rate > 0,
    },
    {
      label: "パーティ +1",
      value: party.bonusChance > 0 ? pct(party.bonusChance) : "なし",
      hint: party.detail.length ? party.detail.join(" / ") : "とくいが合うと上がる",
      active: party.bonusChance > 0,
    },
    {
      label: "レギンスおまけ",
      value: leggingsByproductRate > 0 ? pct(leggingsByproductRate) : "なし",
      hint: "べつの素材がころがることがある",
      active: leggingsByproductRate > 0,
    },
    {
      label: "きょうのこううん日",
      value: luckyToday ? "今回+1かくてい" : (hasHelmet ? "きょうはべつのほりば" : "ヘルメットが必要"),
      active: luckyToday,
    },
    {
      label: "ブーツで🎫もどり",
      value: bootsRefundRate > 0 ? pct(bootsRefundRate) : "なし",
      hint: "たまにチケットがもどる",
      active: bootsRefundRate > 0,
    },
  ];

  const armorNotes = buildArmorNotes(
    params.state,
    params.gacha,
    lucky,
    leggingsByproductRate,
    bootsRefundRate,
  );

  if (isBucketGacha(params.gacha)) {
    const one = [{ key: "1", label: "1こ", rate: 1 }];
    return {
      usedTool,
      recommended: recommendToolKind(params.gacha) === params.toolKind,
      jackpotRate: 0,
      twoRate: 0,
      toolPlus1Rate: 0,
      leggingsPlus1Rate: 0,
      partyPlus1Rate: 0,
      partyDetail: [],
      bootsRefundRate: 0,
      luckyToday: false,
      expectedExtra: 0,
      expectedCount: 1,
      lines,
      bucketMode: true,
      baseOdds: one,
      finalOdds: one,
      armorNotes,
    };
  }

  const plus1s = [toolPlus1Rate, enchantPlus1, party.bonusChance, prospectPlus1];
  const bonusDist = poissonBinomial(plus1s);
  const luckyShift = luckyToday ? 1 : 0;
  const countRate: number[] = [];
  const addCount = (n: number, p: number) => {
    if (p <= 0) return;
    countRate[n] = (countRate[n] ?? 0) + p;
  };
  for (const [base, pBase] of [[1, oneRate], [2, twoRate], [3, shownJackpot]] as const) {
    for (let k = 0; k < bonusDist.length; k++) {
      addCount(base + k + luckyShift, pBase * bonusDist[k]);
    }
  }
  let fourPlus = 0;
  const finalOdds: OddsSegment[] = [];
  for (let n = 1; n < countRate.length; n++) {
    const p = countRate[n] ?? 0;
    if (n >= 4) fourPlus += p;
    else if (p >= 0.005) finalOdds.push({ key: String(n), label: `${n}こ`, rate: p });
  }
  if (fourPlus >= 0.005) finalOdds.push({ key: "4+", label: "4こ+", rate: fourPlus });

  return {
    usedTool,
    recommended: recommendToolKind(params.gacha) === params.toolKind,
    jackpotRate: shownJackpot,
    twoRate,
    toolPlus1Rate,
    leggingsPlus1Rate: enchantPlus1,
    partyPlus1Rate: party.bonusChance,
    partyDetail: party.detail,
    bootsRefundRate,
    luckyToday,
    expectedExtra,
    expectedCount: oneRate + 2 * twoRate + 3 * shownJackpot + expectedExtra,
    lines,
    bucketMode: false,
    baseOdds: keepOdds([
      { key: "1", label: "1こ", rate: oneRate },
      { key: "+1", label: "+1", rate: twoRate },
      { key: "+3", label: "+3", rate: shownJackpot },
    ]),
    finalOdds,
    armorNotes,
  };
}

export function equipTool(state: MiningState, toolId: CraftedGearId | null): MiningState {
  if (toolId && !state.crafted[toolId]) return state;
  return { ...state, equipped: { ...state.equipped, tool: toolId } };
}

export function equipArmor(
  state: MiningState,
  slot: "helmet" | "chest" | "leggings" | "boots",
  gearId: CraftedGearId | null,
): MiningState {
  if (gearId && !state.crafted[gearId]) return state;
  return { ...state, equipped: { ...state.equipped, [slot]: gearId } };
}

export function ownedArmorForSlot(
  state: MiningState,
  slot: "helmet" | "chest" | "leggings" | "boots",
): CraftedGearId[] {
  const tiers: GearTier[] = ["netherite", "diamond", "gold", "iron"];
  return tiers
    .map((tier) => `${slot}_${tier}` as CraftedGearId)
    .filter((id) => !!state.crafted[id]);
}

export interface DigResult {
  state: MiningState;
  drops: { material: MaterialId; amount: number }[];
  breakdown: string[];
  /** あたり／大あたりの理由（子ども向け表示） */
  hitReasons: string[];
  ticketRefunded: boolean;
  usedTool: CraftedGearId | null;
  baseCount: number;
}

/** 掘り結果の盛り上がり段階（演出用） */
export type DigHitTier = "normal" | "good" | "great";

const GREAT_DROP_MATERIALS: ReadonlySet<MaterialId> = new Set([
  "diamond",
  "iron_ingot",
  "gold_ingot",
  "netherite_upgrade",
]);

const GOOD_DROP_MATERIALS: ReadonlySet<MaterialId> = new Set([
  "ancient_debris",
]);

/** ふつう / あたり / 大あたり
 * あたり: きほん素材+1（baseCount===2）、または残骸（ネザー）
 * 大あたり: きほん素材+3、ダイヤ直、インゴット直、チケットもどり
 * おまけ（棒・羊毛・石炭おまけ等）は演出に入れない
 */
export function digHitTier(result: DigResult): DigHitTier {
  if (
    result.ticketRefunded
    || result.baseCount >= 3
    || result.drops.some((d) => GREAT_DROP_MATERIALS.has(d.material))
  ) {
    return "great";
  }
  if (
    result.baseCount === 2
    || result.drops.some((d) => GOOD_DROP_MATERIALS.has(d.material))
  ) {
    return "good";
  }
  return "normal";
}

/** 結果一覧で目立たせるドロップか */
export function isDigHighlightDrop(
  material: MaterialId,
  amount: number,
  tier: DigHitTier,
): boolean {
  if (GREAT_DROP_MATERIALS.has(material) || GOOD_DROP_MATERIALS.has(material)) return true;
  if (tier !== "normal" && amount >= 2) return true;
  return false;
}

export function resolveDig(params: {
  state: MiningState;
  gacha: GachaId;
  toolKind: ToolKind;
  buddyProgress?: BuddyProgressMap;
  dateKey: string;
  rand?: () => number;
  /** 掘り3択であたり岩を選んだ */
  luckyRock?: boolean;
}): DigResult | { error: string } {
  const rand = params.rand ?? Math.random;
  let state = {
    ...params.state,
    materials: { ...params.state.materials },
    crafted: { ...params.state.crafted },
    enchants: { ...params.state.enchants },
  };

  if (state.tickets < 1) return { error: "チケットが足りないよ" };
  if (!state.unlockedGachas.includes(params.gacha)) return { error: "まだ解放されていないよ" };
  if (params.gacha === "lava_cave" || params.gacha === "river") {
    return { error: "バケツをそうびして、くんでね" };
  }

  const usedTool = bestOwnedTool(state, params.toolKind);
  const breakdown: string[] = [];
  const hitReasons: string[] = [];
  const digKind = params.toolKind;

  const jackpotRate = Math.min(
    0.25,
    swordJackpotRate(usedTool) + sumEnchantBonus(state, "fortune", fortuneBonus, digKind),
  );
  let baseCount: number;
  {
    const r = rand();
    const twoRate = DIG_TWO_RATE;
    if (r < jackpotRate) baseCount = 3;
    else if (r < jackpotRate + twoRate) baseCount = 2;
    else baseCount = 1;
  }
  breakdown.push(`きほん ${baseCount}`);
  if (baseCount >= 3) hitReasons.push("きほんが素材+3");
  else if (baseCount === 2) hitReasons.push("きほんが素材+1");

  let bonus = 0;
  if (params.luckyRock) {
    bonus += 1;
    breakdown.push("あたり岩 +1");
    hitReasons.push("あたり岩");
  }

  const toolChance = toolPlus1Chance(usedTool, params.gacha);
  if (toolChance > 0 && rand() < toolChance) {
    bonus += 1;
    breakdown.push("どうぐ +1");
  }

  const plus1Pool = Math.min(
    0.35,
    sumEnchantBonus(state, "efficiency", efficiencyBonus, digKind),
  );
  if (plus1Pool > 0 && rand() < plus1Pool) {
    bonus += 1;
    breakdown.push("エンチャント +1");
  }

  const party = partySpecialtyBonus(state, params.buddyProgress, params.gacha);
  if (party.bonusChance > 0 && rand() < party.bonusChance) {
    bonus += 1;
    breakdown.push("パーティ +1");
  }

  const hasHelmet = !!(state.equipped.helmet && state.crafted[state.equipped.helmet]);
  const lucky = luckyGachaForDate(params.dateKey, state.unlockedGachas, hasHelmet);
  let luckyBonus = 0;
  if (
    lucky === params.gacha
    && hasHelmet
    && state.luckyBonusClaimedDate !== params.dateKey
  ) {
    luckyBonus = 1;
    state.luckyBonusClaimedDate = params.dateKey;
    breakdown.push("あたり日おまけ +1");
  }

  if (lucky === params.gacha) {
    const prospect = Math.min(0.35, sumEnchantBonus(state, "prospect", prospectBonus, digKind));
    if (prospect > 0 && rand() < prospect) {
      bonus += 1;
      breakdown.push("あたり日エンチャント +1");
      hitReasons.push("あたり日エンチャント");
    }
  }

  const primary = GACHA_PRIMARY[params.gacha];
  if (!primary) return { error: "ここではほれないよ" };

  const drops: { material: MaterialId; amount: number }[] = [];
  const primaryAmount = baseCount + bonus + luckyBonus;
  const toolParsed = parseToolId(usedTool);
  const hasSword = toolParsed?.kind === "sword";

  if (params.gacha === "diamond") {
    drops.push({ material: "diamond_shard", amount: primaryAmount });
    const directRate = hasSword ? SWORD_DIAMOND_DIRECT_RATE : 0.05;
    if (rand() < directRate) {
      drops.push({ material: "diamond", amount: 1 });
      breakdown.push(hasSword ? "剣でダイヤ直！" : "ダイヤ直！");
      hitReasons.push(hasSword ? "剣でダイヤ直" : "ダイヤ直");
    }
  } else if (params.gacha === "lapis_cave") {
    let lapisAmt = primaryAmount >= 2 ? 3 : 2;
    if (rand() < 0.2) lapisAmt += 2;
    drops.push({ material: "lapis", amount: lapisAmt });
  } else if (params.gacha === "nether") {
    drops.push({ material: "nether_quartz", amount: primaryAmount });
    const setBonus = netheriteFullComplete(state);
    let debrisRate = DEBRIS_BASE_RATE;
    if (toolParsed?.kind === "pickaxe") {
      debrisRate += TIER_PLUS1[toolParsed.tier] * 0.5;
    }
    if (setBonus) debrisRate += 0.08;
    if (rand() < Math.min(DEBRIS_RATE_CAP, debrisRate)) {
      drops.push({ material: "ancient_debris", amount: 1 });
      breakdown.push(setBonus ? "古代の残骸！（そろいボーナス）" : "古代の残骸！");
      hitReasons.push(setBonus ? "古代の残骸（そろいボーナス）" : "古代の残骸");
      if (setBonus && rand() < 0.15) {
        drops.push({ material: "ancient_debris", amount: 1 });
        breakdown.push("そろいおまけ残骸+1！");
        hitReasons.push("そろいおまけ残骸+1");
      }
    }
    if (rand() < 0.12) {
      drops.push({ material: "gold_ore", amount: 1 });
      breakdown.push("おまけ 金の原石");
    }
  } else if (params.gacha === "bastion") {
    drops.push({ material: "netherrack", amount: primaryAmount });
    if (rand() < BASTION_TEMPLATE_RATE) {
      drops.push({ material: "netherite_upgrade", amount: 1 });
      breakdown.push("鍛冶型ゲット！");
      hitReasons.push("ネザライト強化用鍛冶型");
    }
  } else if (params.gacha === "iron") {
    if (hasSword && rand() < SWORD_INGOT_DIRECT_RATE) {
      drops.push({ material: "iron_ingot", amount: primaryAmount });
      breakdown.push("剣でインゴット直！");
      hitReasons.push("剣で鉄インゴット直");
    } else {
      drops.push({ material: "iron_ore", amount: primaryAmount });
    }
  } else if (params.gacha === "gold") {
    if (hasSword && rand() < SWORD_INGOT_DIRECT_RATE) {
      drops.push({ material: "gold_ingot", amount: primaryAmount });
      breakdown.push("剣でインゴット直！");
      hitReasons.push("剣で金インゴット直");
    } else {
      drops.push({ material: "gold_ore", amount: primaryAmount });
    }
  } else {
    drops.push({ material: primary, amount: primaryAmount });
  }

  const hasLeggings = !!equippedArmorTier(state, "leggings");
  // レギンスなしのときだけ弱い場所おまけ。ありのときはレギンス副産物に寄せる
  if (!hasLeggings) {
    if (params.gacha === "wood" && rand() < 0.12) {
      drops.push({ material: "stick", amount: 1 });
      breakdown.push("おまけ 棒");
    }
    if (params.gacha === "stone" && rand() < 0.1) {
      drops.push({ material: "log", amount: 1 });
      breakdown.push("おまけ 原木");
    }
    if (params.gacha === "coal" && rand() < 0.08) {
      drops.push({ material: "cobble", amount: 1 });
      breakdown.push("おまけ 丸石");
    }
    if ((params.gacha === "iron" || params.gacha === "gold") && rand() < 0.03) {
      drops.push({ material: "coal", amount: 1 });
      breakdown.push("おまけ 石炭");
    }
    if (params.gacha === "farm" && rand() < 0.15) {
      drops.push({ material: "paper", amount: 1 });
      breakdown.push("おまけ 紙");
    }
    if (params.gacha === "ranch" && rand() < 0.2) {
      drops.push({ material: "leather", amount: 1 });
      breakdown.push("皮ゲット");
    }
  } else {
    const side = rollLeggingsByproduct(state, params.gacha, rand);
    if (side) {
      drops.push(side);
      breakdown.push(
        `レギンスおまけ ${MATERIAL_META[side.material].label}${side.amount > 1 ? `×${side.amount}` : ""}`,
      );
    }
  }

  const starChance = Math.min(0.25, sumEnchantBonus(state, "bonus_star", bonusStarChance, digKind));
  if (starChance > 0 && rand() < starChance) {
    const stars = 1;
    state.miningPoints += stars;
    breakdown.push(`エメラルドおまけ +${stars}`);
    hitReasons.push("エメラルドおまけ");
  }

  state.tickets -= 1;
  let ticketRefunded = false;
  const refund = Math.min(
    0.25,
    bootsRefundChance(state) + sumEnchantBonus(state, "refund", refundBonus, digKind),
  );
  if (refund > 0 && rand() < refund) {
    state.tickets += 1;
    ticketRefunded = true;
    breakdown.push("🎫チケットがもどった！");
    hitReasons.push("チケットもどり");
  }

  for (const d of drops) {
    state.materials[d.material] = getMaterialCount(state, d.material) + d.amount;
  }

  state.miningPoints += 1;

  if (usedTool) {
    state.equipped = { ...state.equipped, tool: usedTool };
  }

  state = refreshUnlocks(state);

  return {
    state,
    drops,
    breakdown,
    hitReasons,
    ticketRefunded,
    usedTool,
    baseCount,
  };
}

/** うみ／ようがんでバケツくみ（🎫1）。3択のあたりで+1 */
export function resolveBucketFill(params: {
  state: MiningState;
  gacha: "river" | "lava_cave";
  luckyRock?: boolean;
}): DigResult | { error: string } {
  let state = {
    ...params.state,
    materials: { ...params.state.materials },
    crafted: { ...params.state.crafted },
  };
  if (state.tickets < 1) return { error: "チケットが足りないよ" };
  if (!state.unlockedGachas.includes(params.gacha)) return { error: "まだ解放されていないよ" };
  if (!hasBucket(state)) return { error: "鉄のバケツがひつようだよ" };

  const material: MaterialId = params.gacha === "river" ? "water" : "lava";
  let amount = 1;
  const breakdown = ["きほん 1"];
  const hitReasons: string[] = [];
  if (params.luckyRock) {
    amount += 1;
    breakdown.push("あたり +1");
    hitReasons.push("あたり");
  }
  state.tickets -= 1;
  state.materials[material] = getMaterialCount(state, material) + amount;
  state.miningPoints += 1;
  state = refreshUnlocks(state);

  return {
    state,
    drops: [{ material, amount }],
    breakdown,
    hitReasons,
    ticketRefunded: false,
    usedTool: null,
    baseCount: amount,
  };
}

export function tryCraft(
  state: MiningState,
  recipe: MiningRecipe,
  opts?: { fuel?: RecipeCost; times?: number },
): { state: MiningState; error?: string } {
  const times = recipe.craftFlag
    ? 1
    : Math.max(1, Math.floor(opts?.times ?? 1));
  if (recipe.needsWorkbench && !hasWorkbench(state)) {
    return { state, error: "先に作業台を作ってね" };
  }
  if (recipe.needsFurnace && !hasFurnace(state)) {
    return { state, error: "先にかまどを作ってね" };
  }
  if (recipe.needsEnchantingTable && !hasEnchantingTable(state)) {
    return { state, error: "エンチャントテーブルのあとでつくれるよ" };
  }
  if (recipe.needsSmithingTable && !hasSmithingTable(state)) {
    return { state, error: "先に鍛冶台を作ってね" };
  }
  if (recipe.craftFlag && state.crafted[recipe.craftFlag]) {
    return { state, error: "もう持っているよ" };
  }
  if (recipe.grantsBed && partySlotCount(state) >= MAX_BEDS) {
    return { state, error: "ベッドはもう3つあるよ（なかまいっぱい）" };
  }
  const upgradeFrom = recipe.craftFlag ? NETHERITE_UPGRADE_REQUIRES[recipe.craftFlag] : undefined;
  if (upgradeFrom && !state.crafted[upgradeFrom]) {
    return { state, error: `先に${gearLabel(upgradeFrom)} を作ってね` };
  }
  const have = (id: MaterialId) => getMaterialCount(state, id);
  if (!canAffordRecipe(recipe.costs, have, recipe.fuelOptions)) {
    return { state, error: recipe.fuelOptions?.length ? "材料か燃料が足りないよ" : "材料が足りないよ" };
  }

  let fuel: RecipeCost | null = null;
  if (recipe.fuelOptions?.length) {
    if (opts?.fuel) {
      const match = recipe.fuelOptions.find(
        (f) => f.material === opts.fuel!.material && f.amount === opts.fuel!.amount,
      );
      if (!match || have(match.material) < fuelAmountForTimes(match, times)) {
        return { state, error: "選んだ燃料が足りないよ" };
      }
      fuel = match;
    } else {
      fuel = pickFuelOption(recipe.fuelOptions, have);
    }
    if (!fuel) return { state, error: "燃料が足りないよ" };
  }

  const maxTimes = maxCraftTimes(recipe, have, {
    fuel,
    remainingBeds: recipe.grantsBed ? MAX_BEDS - partySlotCount(state) : undefined,
  });
  if (times > maxTimes) {
    return { state, error: recipe.fuelOptions?.length ? "材料か燃料が足りないよ" : "材料が足りないよ" };
  }

  const materials = { ...state.materials };
  for (const c of recipe.costs) {
    writeMaterialCount(
      materials,
      c.material,
      (materials[c.material] ?? 0) - c.amount * times,
    );
  }
  if (fuel) {
    writeMaterialCount(
      materials,
      fuel.material,
      (materials[fuel.material] ?? 0) - fuelAmountForTimes(fuel, times),
    );
  }
  if (recipe.outputs) {
    for (const o of recipe.outputs) {
      writeMaterialCount(
        materials,
        o.material,
        (materials[o.material] ?? 0) + o.amount * times,
      );
    }
  }
  const crafted = { ...state.crafted };
  let equipped = { ...state.equipped };
  if (recipe.craftFlag) {
    const replaced = clearSameKindGear(crafted, equipped, recipe.craftFlag);
    crafted[recipe.craftFlag] = true;
    equipped = replaced.equipped;
  }

  let bedCount = partySlotCount(state);
  if (recipe.grantsBed) {
    bedCount = Math.min(MAX_BEDS, bedCount + times);
  }

  let next: MiningState = { ...state, materials, crafted, equipped, bedCount };
  next = refreshUnlocks(next);
  return { state: next };
}

/** 種類ごとに1つ：同種の下位・別ティアを消して装備を差し替え */
function clearSameKindGear(
  crafted: Partial<Record<CraftedGearId, boolean>>,
  equipped: MiningState["equipped"],
  newId: CraftedGearId,
): { equipped: MiningState["equipped"] } {
  const target = enchantTargetOfGear(newId);
  if (!target) return { equipped };
  const tiers: GearTier[] = ["wood", "stone", "iron", "gold", "diamond", "netherite"];
  for (const tier of tiers) {
    const id = `${target}_${tier}` as CraftedGearId;
    if (id !== newId && crafted[id]) crafted[id] = false;
  }
  const nextEq = { ...equipped };
  if (target === "sword" || target === "axe" || target === "pickaxe") {
    nextEq.tool = newId;
  } else {
    nextEq[target] = newId;
  }
  return { equipped: nextEq };
}

export function recipesForState(state: MiningState): MiningRecipe[] {
  return visibleRecipes(refreshUnlocks(state).unlockedGachas);
}

export function addTickets(state: MiningState, n: number): MiningState {
  return { ...state, tickets: state.tickets + Math.max(0, Math.floor(n)) };
}

export function adjustTickets(state: MiningState, delta: number): MiningState {
  const d = Math.floor(delta);
  if (!Number.isFinite(d) || d === 0) return state;
  return { ...state, tickets: Math.max(0, state.tickets + d) };
}

export function addMiningPoints(state: MiningState, n: number): MiningState {
  return { ...state, miningPoints: state.miningPoints + Math.max(0, Math.floor(n)) };
}

export function setPartySlot(
  state: MiningState,
  index: number,
  stickerId: string | null,
): MiningState {
  const slots = partySlotCount(state);
  const partyIds = [...state.partyIds] as (string | null)[];
  if (index < 0 || index >= slots) return state;
  if (stickerId) {
    for (let i = 0; i < slots; i++) {
      if (i !== index && partyIds[i] === stickerId) partyIds[i] = null;
    }
  }
  partyIds[index] = stickerId;
  for (let i = slots; i < MAX_BEDS; i++) partyIds[i] = null;
  return { ...state, partyIds };
}

export function chestExchangeDiscount(state: MiningState): number {
  const id = state.equipped.chest;
  if (!id || !state.crafted[id]) return 0;
  const m = /^chest_(iron|gold|diamond|netherite)$/.exec(id);
  if (!m) return 0;
  const tier = m[1] as GearTier;
  const rate: Partial<Record<GearTier, number>> = {
    iron: 0.1,
    gold: 0.12,
    diamond: 0.15,
    netherite: 0.2,
  };
  return rate[tier] ?? 0;
}

export function exchangeCost(base: number, state: MiningState): number {
  const discount = chestExchangeDiscount(state);
  const afterPct = Math.ceil(base * (1 - discount));
  const bargain = Math.min(5, sumEnchantBonus(state, "bargain", bargainStars));
  return Math.max(1, afterPct - bargain);
}

export const EXCHANGE_LOG_COST = 15;
export const EXCHANGE_COBBLE_COST = 20;
/** さとうきびは紙・本の救済。農場掘りより高め */
export const EXCHANGE_SUGAR_CANE_COST = 30;
/** 石炭は精錬の救済。せきたんのやまより高め */
export const EXCHANGE_COAL_COST = 25;
/** 羊毛は救済ルート。牧場掘りより高め */
export const EXCHANGE_WOOL_COST = 30;
/** 皮は本の救済。牧場のおまけより高め */
export const EXCHANGE_LEATHER_COST = 60;
/** 古代の残骸は救済。ネザー掘りよりかなり高め */
export const EXCHANGE_DEBRIS_COST = 90;
/** 鍛冶型は初回救済。砦掘りより高め */
export const EXCHANGE_TEMPLATE_COST = 120;
/** ネザークォーツ1個をエメラルドにかえしたときの量（むねあて割引なし） */
export const QUARTZ_TO_POINTS = 3;
/** ネザーラック1個をエメラルドにかえしたときの量 */
export const NETHERRACK_TO_POINTS = 1;

export const EXCHANGE_BUY_OFFERS: { material: MaterialId; baseCost: number }[] = [
  { material: "log", baseCost: EXCHANGE_LOG_COST },
  { material: "cobble", baseCost: EXCHANGE_COBBLE_COST },
  { material: "coal", baseCost: EXCHANGE_COAL_COST },
  { material: "sugar_cane", baseCost: EXCHANGE_SUGAR_CANE_COST },
  { material: "wool", baseCost: EXCHANGE_WOOL_COST },
  { material: "leather", baseCost: EXCHANGE_LEATHER_COST },
  { material: "ancient_debris", baseCost: EXCHANGE_DEBRIS_COST },
  { material: "netherite_upgrade", baseCost: EXCHANGE_TEMPLATE_COST },
];

export function exchangePointsForMaterial(
  state: MiningState,
  material: MaterialId,
): { state: MiningState; error?: string } {
  const offer = EXCHANGE_BUY_OFFERS.find((row) => row.material === material);
  if (!offer) return { state, error: "こうかんできないよ" };
  const cost = exchangeCost(offer.baseCost, state);
  if (state.miningPoints < cost) {
    return { state, error: `エメラルドが${cost}ひつようだよ` };
  }
  const materials = { ...state.materials };
  writeMaterialCount(materials, material, getMaterialCount(state, material) + 1);
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints - cost,
      materials,
    },
  };
}

/** ネザークォーツ → エメラルド（外れ掘りの価値） */
export function exchangeQuartzForPoints(state: MiningState): { state: MiningState; error?: string } {
  const have = getMaterialCount(state, "nether_quartz");
  if (have < 1) {
    return { state, error: "ネザークォーツが足りないよ" };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints + QUARTZ_TO_POINTS,
      materials: (() => {
        const materials = { ...state.materials };
        writeMaterialCount(materials, "nether_quartz", have - 1);
        return materials;
      })(),
    },
  };
}

/** ネザーラック → エメラルド */
export function exchangeNetherrackForPoints(state: MiningState): { state: MiningState; error?: string } {
  const have = getMaterialCount(state, "netherrack");
  if (have < 1) {
    return { state, error: "ネザーラックが足りないよ" };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints + NETHERRACK_TO_POINTS,
      materials: (() => {
        const materials = { ...state.materials };
        writeMaterialCount(materials, "netherrack", have - 1);
        return materials;
      })(),
    },
  };
}

export { MINING_RECIPES, canAffordRecipe, maxCraftTimes, recipeProgress } from "./miningRecipes";
export type { CraftRecipeTab, MiningRecipe } from "./miningRecipes";
