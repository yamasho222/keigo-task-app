/** ドロップ解決・パーティ／道具補正・解放判定 */

import { getBuddyEntry, type BuddyProgressMap } from "./buddyProgress";
import { REWARD_LOOKUP } from "./stickerRewards";
import {
  canAffordRecipe,
  NETHERITE_UPGRADE_REQUIRES,
  pickFuelOption,
  visibleRecipes,
  type MiningRecipe,
  type RecipeCost,
} from "./miningRecipes";
import {
  CATEGORY_SPECIALTY,
  GACHA_META,
  MAX_BEDS,
  gearLabel,
  getMaterialCount,
  parseToolId,
  partySlotCount,
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

const TIER_LEGGINGS: Record<GearTier, number> = {
  wood: 0.08,
  stone: 0.1,
  iron: 0.12,
  gold: 0.13,
  diamond: 0.14,
  netherite: 0.15,
};

const TIER_BOOTS: Record<GearTier, number> = {
  wood: 0,
  stone: 0,
  iron: 0.05,
  gold: 0.06,
  diamond: 0.08,
  netherite: 0.1,
};

const TIER_JACKPOT: Record<GearTier, number> = {
  wood: 0.07,
  stone: 0.09,
  iron: 0.11,
  gold: 0.12,
  diamond: 0.13,
  netherite: 0.15,
};

/** 基礎: 85%→1 / 10%→2 / 5%→3 */
export function rollBaseCount(rand = Math.random): number {
  const r = rand();
  if (r < 0.05) return 3;
  if (r < 0.15) return 2;
  return 1;
}

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
  return gacha === "wood" ? "axe" : "pickaxe";
}

export function hasWorkbench(state: MiningState): boolean {
  return !!state.crafted.workbench;
}

export function hasFurnace(state: MiningState): boolean {
  return !!state.crafted.furnace;
}

export function woodToolsComplete(state: MiningState): boolean {
  return !!(state.crafted.sword_wood && state.crafted.axe_wood && state.crafted.pickaxe_wood);
}

export function stoneToolsComplete(state: MiningState): boolean {
  return !!(state.crafted.sword_stone && state.crafted.axe_stone && state.crafted.pickaxe_stone);
}

export function ironToolsComplete(state: MiningState): boolean {
  return !!(state.crafted.sword_iron && state.crafted.axe_iron && state.crafted.pickaxe_iron);
}

export function ironArmorComplete(state: MiningState): boolean {
  return !!(
    state.crafted.helmet_iron
    && state.crafted.chest_iron
    && state.crafted.leggings_iron
    && state.crafted.boots_iron
  );
}

/** 鉄フル（道具3＋防具4） */
export function ironFullComplete(state: MiningState): boolean {
  return ironToolsComplete(state) && ironArmorComplete(state);
}

export function diamondToolsComplete(state: MiningState): boolean {
  return !!(state.crafted.sword_diamond && state.crafted.axe_diamond && state.crafted.pickaxe_diamond);
}

export function diamondFullComplete(state: MiningState): boolean {
  return !!(
    diamondToolsComplete(state)
    && state.crafted.helmet_diamond
    && state.crafted.chest_diamond
    && state.crafted.leggings_diamond
    && state.crafted.boots_diamond
  );
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
  if (woodToolsComplete(state)) unlocked.add("stone");
  if (stoneToolsComplete(state)) {
    unlocked.add("iron");
    unlocked.add("coal");
    unlocked.add("gold");
  }
  if (ironToolsComplete(state)) unlocked.add("diamond");
  if (diamondToolsComplete(state)) unlocked.add("nether");
  return { ...state, unlockedGachas: [...unlocked] };
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
  if (parsed.kind === "axe" && gacha === "wood") return TIER_PLUS1[parsed.tier];
  if (parsed.kind === "pickaxe" && gacha !== "wood") return TIER_PLUS1[parsed.tier];
  return 0;
}

export function leggingsPlus1Chance(state: MiningState): number {
  const id = state.equipped.leggings;
  if (!id) return 0;
  const m = /^leggings_(iron|gold|diamond|netherite)$/.exec(id);
  if (!m) return 0;
  return TIER_LEGGINGS[m[1] as GearTier];
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
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return unlocked[h % unlocked.length];
}

export interface DigBoostLine {
  label: string;
  value: string;
  hint?: string;
  active: boolean;
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
  lines: DigBoostLine[];
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
  const jackpotRate = swordJackpotRate(usedTool);
  const toolPlus1Rate = toolPlus1Chance(usedTool, params.gacha);
  const leggingsPlus1Rate = leggingsPlus1Chance(params.state);
  const party = partySpecialtyBonus(params.state, params.buddyProgress, params.gacha);
  const bootsRefundRate = bootsRefundChance(params.state);
  const hasHelmet = !!(params.state.equipped.helmet && params.state.crafted[params.state.equipped.helmet]);
  const lucky = luckyGachaForDate(params.dateKey, params.state.unlockedGachas, hasHelmet);
  const luckyToday =
    lucky === params.gacha
    && hasHelmet
    && params.state.luckyBonusClaimedDate !== params.dateKey;
  const expectedExtra =
    toolPlus1Rate + leggingsPlus1Rate + party.bonusChance + (luckyToday ? 1 : 0);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  // きほん個数（1 / +1=2 / +3）。+1 はだいたい3〜4回に1回
  const twoRate = 0.28;
  const oneRate = Math.max(0, 1 - jackpotRate - twoRate);
  const lines: DigBoostLine[] = [
    {
      label: "きほん個数",
      value: `1個 ${pct(oneRate)} / +1 ${pct(twoRate)} / +3 ${pct(jackpotRate)}`,
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
      label: "レギンス +1",
      value: leggingsPlus1Rate > 0 ? pct(leggingsPlus1Rate) : "なし",
      hint: "鉄のぼうぐから",
      active: leggingsPlus1Rate > 0,
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
  return {
    usedTool,
    recommended: recommendToolKind(params.gacha) === params.toolKind,
    jackpotRate,
    twoRate,
    toolPlus1Rate,
    leggingsPlus1Rate,
    partyPlus1Rate: party.bonusChance,
    partyDetail: party.detail,
    bootsRefundRate,
    luckyToday,
    expectedExtra,
    lines,
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
}): DigResult | { error: string } {
  const rand = params.rand ?? Math.random;
  let state = { ...params.state, materials: { ...params.state.materials }, crafted: { ...params.state.crafted } };

  if (state.tickets < 1) return { error: "チケットが足りないよ" };
  if (!state.unlockedGachas.includes(params.gacha)) return { error: "まだ解放されていないよ" };

  const usedTool = bestOwnedTool(state, params.toolKind);
  const breakdown: string[] = [];
  const hitReasons: string[] = [];

  const jackpotRate = swordJackpotRate(usedTool);
  let baseCount: number;
  {
    const r = rand();
    // きほん素材+1（=2個）をだいたい3〜4回に1回
    const twoRate = 0.28;
    if (r < jackpotRate) baseCount = 3;
    else if (r < jackpotRate + twoRate) baseCount = 2;
    else baseCount = 1;
  }
  breakdown.push(`きほん ${baseCount}`);
  if (baseCount >= 3) hitReasons.push("きほんが素材+3");
  else if (baseCount === 2) hitReasons.push("きほんが素材+1");

  let bonus = 0;
  const toolChance = toolPlus1Chance(usedTool, params.gacha);
  if (toolChance > 0 && rand() < toolChance) {
    bonus += 1;
    breakdown.push("どうぐ +1");
  }
  const legChance = leggingsPlus1Chance(state);
  if (legChance > 0 && rand() < legChance) {
    bonus += 1;
    breakdown.push("レギンス +1");
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

  const primary: MaterialId =
    params.gacha === "wood" ? "log"
      : params.gacha === "stone" ? "cobble"
        : params.gacha === "iron" ? "iron_ore"
          : params.gacha === "coal" ? "coal"
            : params.gacha === "gold" ? "gold_ore"
              : params.gacha === "diamond" ? "diamond_shard"
                : "nether_quartz";

  const drops: { material: MaterialId; amount: number }[] = [];
  const primaryAmount = baseCount + bonus + luckyBonus;
  const toolParsed = parseToolId(usedTool);
  const hasSword = toolParsed?.kind === "sword";

  if (params.gacha === "diamond") {
    drops.push({ material: "diamond_shard", amount: primaryAmount });
    const directRate = hasSword ? 0.14 : 0.05;
    if (rand() < directRate) {
      drops.push({ material: "diamond", amount: 1 });
      breakdown.push(hasSword ? "剣でダイヤ直！" : "ダイヤ直！");
      hitReasons.push(hasSword ? "剣でダイヤ直" : "ダイヤ直");
    }
  } else if (params.gacha === "nether") {
    // 主ドロップはネザークォーツ（⚡にこうかん可）。金はおまけ。
    drops.push({ material: "nether_quartz", amount: primaryAmount });
    // A': 基本40%／ネザライトツルハシで約55%。揃え特典でさらに+。
    const setBonus = netheriteFullComplete(state);
    let debrisRate = 0.32;
    if (toolParsed?.kind === "pickaxe") {
      debrisRate += TIER_PLUS1[toolParsed.tier] * 0.5;
    }
    if (setBonus) debrisRate += 0.08;
    if (rand() < Math.min(0.65, debrisRate)) {
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
  } else if (params.gacha === "iron") {
    if (hasSword && rand() < 0.22) {
      drops.push({ material: "iron_ingot", amount: primaryAmount });
      breakdown.push("剣でインゴット直！");
      hitReasons.push("剣で鉄インゴット直");
    } else {
      drops.push({ material: "iron_ore", amount: primaryAmount });
    }
  } else if (params.gacha === "gold") {
    if (hasSword && rand() < 0.22) {
      drops.push({ material: "gold_ingot", amount: primaryAmount });
      breakdown.push("剣でインゴット直！");
      hitReasons.push("剣で金インゴット直");
    } else {
      drops.push({ material: "gold_ore", amount: primaryAmount });
    }
  } else {
    drops.push({ material: primary, amount: primaryAmount });
  }

  if (params.gacha === "wood" && rand() < 0.25) {
    drops.push({ material: "stick", amount: 1 });
    breakdown.push("おまけ 棒");
  }
  if (params.gacha === "wood") {
    const woolRate = usedTool && parseToolId(usedTool)?.kind === "axe" ? 0.28 : 0.2;
    if (rand() < woolRate) {
      drops.push({ material: "wool", amount: 1 });
      breakdown.push(usedTool && parseToolId(usedTool)?.kind === "axe" ? "斧で羊毛！" : "羊毛ゲット");
    }
  }
  if (params.gacha === "stone" && rand() < 0.2) {
    drops.push({ material: "log", amount: 1 });
    breakdown.push("おまけ 原木");
  }
  if (params.gacha === "coal" && rand() < 0.15) {
    drops.push({ material: "cobble", amount: 1 });
    breakdown.push("おまけ 丸石");
  }
  // 石炭の主産地は「せきたんのやま」。鉄・金ではごくまれなおまけのみ
  if ((params.gacha === "iron" || params.gacha === "gold") && rand() < 0.05) {
    drops.push({ material: "coal", amount: 1 });
    breakdown.push("おまけ 石炭");
  }

  state.tickets -= 1;
  let ticketRefunded = false;
  const refund = bootsRefundChance(state);
  if (refund > 0 && rand() < refund) {
    state.tickets += 1;
    ticketRefunded = true;
    breakdown.push("ブーツでチケットもどった！");
    hitReasons.push("ブーツでチケットもどり");
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

export function tryCraft(
  state: MiningState,
  recipe: MiningRecipe,
  opts?: { fuel?: RecipeCost },
): { state: MiningState; error?: string } {
  if (recipe.needsWorkbench && !hasWorkbench(state)) {
    return { state, error: "先に作業台を作ってね" };
  }
  if (recipe.needsFurnace && !hasFurnace(state)) {
    return { state, error: "先にかまどを作ってね" };
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
      if (!match || have(match.material) < match.amount) {
        return { state, error: "選んだ燃料が足りないよ" };
      }
      fuel = match;
    } else {
      fuel = pickFuelOption(recipe.fuelOptions, have);
    }
    if (!fuel) return { state, error: "燃料が足りないよ" };
  }

  const materials = { ...state.materials };
  for (const c of recipe.costs) {
    materials[c.material] = getMaterialCount(state, c.material) - c.amount;
    if ((materials[c.material] ?? 0) <= 0) delete materials[c.material];
  }
  if (fuel) {
    const left = (materials[fuel.material] ?? getMaterialCount(state, fuel.material)) - fuel.amount;
    if (left > 0) materials[fuel.material] = left;
    else delete materials[fuel.material];
  }
  if (recipe.outputs) {
    for (const o of recipe.outputs) {
      materials[o.material] = (materials[o.material] ?? 0) + o.amount;
    }
  }
  const crafted = { ...state.crafted };
  if (recipe.craftFlag) crafted[recipe.craftFlag] = true;

  let bedCount = partySlotCount(state);
  if (recipe.grantsBed) {
    bedCount = Math.min(MAX_BEDS, bedCount + 1);
  }

  let next: MiningState = { ...state, materials, crafted, bedCount };
  next = refreshUnlocks(next);
  return { state: next };
}

export function v1Recipes(): MiningRecipe[] {
  return visibleRecipes(["wood", "stone"]);
}

export function recipesForState(state: MiningState): MiningRecipe[] {
  return visibleRecipes(refreshUnlocks(state).unlockedGachas);
}

export function addTickets(state: MiningState, n: number): MiningState {
  return { ...state, tickets: state.tickets + Math.max(0, Math.floor(n)) };
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
  return Math.max(1, Math.ceil(base * (1 - discount)));
}

export const EXCHANGE_LOG_COST = 5;
/** 羊毛は救済ルート。もり掘りより高め */
export const EXCHANGE_WOOL_COST = 28;
/** 古代の残骸は救済。ネザー掘りよりかなり高め */
export const EXCHANGE_DEBRIS_COST = 90;
/** ネザークォーツ1個を⚡にかえしたときの量（むねあて割引なし） */
export const QUARTZ_TO_POINTS = 3;

export function exchangePointsForLog(state: MiningState): { state: MiningState; error?: string } {
  const cost = exchangeCost(EXCHANGE_LOG_COST, state);
  if (state.miningPoints < cost) {
    return { state, error: `こうかん⭐が${cost}ひつようだよ` };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints - cost,
      materials: {
        ...state.materials,
        log: getMaterialCount(state, "log") + 1,
      },
    },
  };
}

export function exchangePointsForCobble(state: MiningState): { state: MiningState; error?: string } {
  const cost = exchangeCost(8, state);
  if (state.miningPoints < cost) {
    return { state, error: `こうかん⭐が${cost}ひつようだよ` };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints - cost,
      materials: {
        ...state.materials,
        cobble: getMaterialCount(state, "cobble") + 1,
      },
    },
  };
}

export function exchangePointsForWool(state: MiningState): { state: MiningState; error?: string } {
  const cost = exchangeCost(EXCHANGE_WOOL_COST, state);
  if (state.miningPoints < cost) {
    return { state, error: `こうかん⭐が${cost}ひつようだよ` };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints - cost,
      materials: {
        ...state.materials,
        wool: getMaterialCount(state, "wool") + 1,
      },
    },
  };
}

export function exchangePointsForDebris(state: MiningState): { state: MiningState; error?: string } {
  const cost = exchangeCost(EXCHANGE_DEBRIS_COST, state);
  if (state.miningPoints < cost) {
    return { state, error: `こうかん⭐が${cost}ひつようだよ` };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints - cost,
      materials: {
        ...state.materials,
        ancient_debris: getMaterialCount(state, "ancient_debris") + 1,
      },
    },
  };
}

/** ネザークォーツ → 採掘ポイント（外れ掘りの価値） */
export function exchangeQuartzForPoints(state: MiningState): { state: MiningState; error?: string } {
  const have = getMaterialCount(state, "nether_quartz");
  if (have < 1) {
    return { state, error: "ネザークォーツが足りないよ" };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints + QUARTZ_TO_POINTS,
      materials: {
        ...state.materials,
        nether_quartz: have - 1,
      },
    },
  };
}

export { MINING_RECIPES, canAffordRecipe, recipeProgress } from "./miningRecipes";
export type { MiningRecipe } from "./miningRecipes";
