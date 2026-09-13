/** DEV限定：歪んだ森／要塞の戦闘 */

import {
  GEAR_IMAGE,
  getMaterialCount,
  parseToolId,
  writeMaterialCount,
  type CraftedGearId,
  type GachaId,
  type GearTier,
  type MaterialId,
  type MiningState,
} from "./miningTypes";
import type { DigResult, HelmetRockHint } from "./miningProgress";

function bestSword(state: MiningState): CraftedGearId | null {
  const tiers: GearTier[] = ["netherite", "diamond", "gold", "iron", "stone", "wood"];
  for (const tier of tiers) {
    const id = `sword_${tier}` as CraftedGearId;
    if (state.crafted[id]) return id;
  }
  return null;
}

export function isEndChapterDevEnabled(): boolean {
  return import.meta.env.DEV;
}

export type CombatGachaId = "warped_forest" | "fortress";

export function isCombatGacha(gacha: GachaId): gacha is CombatGachaId {
  return gacha === "warped_forest" || gacha === "fortress";
}

export const ENDERMAN_MAX_HP = 40;
export const BLAZE_MAX_HP = 20;

export const HEART_FULL_IMAGE = "/mining/Heart_Full.jpg";
export const HEART_HALF_IMAGE = "/mining/Heart_Half.jpg";
export const ENDERMAN_IMAGE = "/mining/Enderman.jpg";
export const BLAZE_IMAGE = "/mining/Blaze.webp";

export type CombatTier = "normal" | "hit" | "jackpot";

export type CombatMob = {
  hp: number;
};

export type CombatEncounter = {
  mobs: CombatMob[];
};

const SWORD_DAMAGE: Record<GearTier, number> = {
  wood: 4,
  stone: 5,
  iron: 6,
  gold: 4,
  diamond: 7,
  netherite: 8,
};

export function combatMaxHp(gacha: CombatGachaId): number {
  return gacha === "warped_forest" ? ENDERMAN_MAX_HP : BLAZE_MAX_HP;
}

export function combatKillDrop(gacha: CombatGachaId): MaterialId {
  return gacha === "warped_forest" ? "ender_pearl" : "blaze_rod";
}

export function combatCommonDrop(gacha: CombatGachaId): MaterialId {
  return gacha === "warped_forest" ? "warped_wart" : "netherrack";
}

export function combatHeartCount(gacha: CombatGachaId): number {
  return combatMaxHp(gacha) / 2;
}

export function livingMobs(encounter: CombatEncounter | undefined): CombatMob[] {
  return (encounter?.mobs ?? []).filter((m) => m.hp > 0);
}

export function ensureCombatEncounter(
  state: MiningState,
  gacha: CombatGachaId,
): CombatEncounter {
  const current = state.combatEncounters?.[gacha];
  const living = livingMobs(current);
  if (living.length > 0) {
    return { mobs: living.map((m) => ({ hp: m.hp })) };
  }
  const hp = combatMaxHp(gacha);
  return { mobs: [{ hp }, { hp }] };
}

export function shuffleCombatTiers(rand: () => number = Math.random): CombatTier[] {
  const tiers: CombatTier[] = ["normal", "hit", "jackpot"];
  for (let i = tiers.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = tiers[i];
    tiers[i] = tiers[j];
    tiers[j] = tmp;
  }
  return tiers;
}

export function combatSwings(tier: CombatTier): { swings: number; both: boolean } {
  if (tier === "jackpot") return { swings: 3, both: true };
  if (tier === "hit") return { swings: 1, both: true };
  return { swings: 1, both: false };
}

export function combatCommonAmount(tier: CombatTier): number {
  if (tier === "jackpot") return 3;
  if (tier === "hit") return 2;
  return 1;
}

export type CombatResult = DigResult & {
  killed: number[];
  swings: number;
  both: boolean;
  swingDamage: number;
  targets: number[];
};

export function swordSwingDamage(state: MiningState, gacha: CombatGachaId): number {
  const sword = bestSword(state);
  const parsed = parseToolId(sword);
  const base = parsed && parsed.kind === "sword" ? SWORD_DAMAGE[parsed.tier] : 0;
  const water =
    gacha === "warped_forest" && state.equipped.held === "water" ? 2 : 0;
  return base + water;
}

export function combatSwordId(state: MiningState): CraftedGearId | null {
  return bestSword(state);
}

export function combatSwordImage(state: MiningState): string {
  const id = combatSwordId(state);
  return (id && GEAR_IMAGE[id]) || "/mining/Diamond_Sword.png";
}

/** 1ハート=HP2。full / half / empty を左から並べる */
export function heartSlots(hp: number, hearts: number): Array<"full" | "half" | "empty"> {
  const maxHp = hearts * 2;
  const clamped = Math.max(0, Math.min(maxHp, Math.floor(hp)));
  const slots: Array<"full" | "half" | "empty"> = [];
  for (let i = 0; i < hearts; i++) {
    const remain = clamped - i * 2;
    if (remain >= 2) slots.push("full");
    else if (remain === 1) slots.push("half");
    else slots.push("empty");
  }
  return slots;
}

export function resolveCombatHelmetHint(
  state: MiningState,
  layout: CombatTier[],
  rand: () => number = Math.random,
): HelmetRockHint {
  const jackpot = layout.indexOf("jackpot");
  const normal = layout.indexOf("normal");
  const id = state.equipped.helmet;
  if (!id || !state.crafted[id]) return { kind: "none" };
  const m = /^helmet_(iron|gold|diamond|netherite)$/.exec(id);
  if (!m) return { kind: "none" };
  const tier = m[1];
  if (tier === "iron") return { kind: "none" };
  if (tier === "netherite" && jackpot >= 0) {
    return { kind: "hit", index: jackpot };
  }
  if (tier === "diamond" && normal >= 0) {
    return { kind: "miss", index: normal };
  }
  if (tier === "gold" && normal >= 0 && rand() < 0.4) {
    return { kind: "miss", index: normal };
  }
  return { kind: "none" };
}

function weakerIndex(mobs: CombatMob[]): number {
  let idx = 0;
  for (let i = 1; i < mobs.length; i++) {
    if (mobs[i].hp < mobs[idx].hp) idx = i;
  }
  return idx;
}

export function resolveCombat(params: {
  state: MiningState;
  gacha: CombatGachaId;
  tier: CombatTier;
}): CombatResult | { error: string } {
  const { gacha, tier } = params;
  if (!isEndChapterDevEnabled()) {
    return { error: "まだひらいてないよ" };
  }
  if (params.state.tickets < 1) return { error: "チケットが足りないよ" };
  const sword = combatSwordId(params.state);
  if (!sword) return { error: "剣を作ってからたたこう" };

  const swingDmg = swordSwingDamage(params.state, gacha);
  if (swingDmg <= 0) return { error: "剣を作ってからたたこう" };

  let encounter = ensureCombatEncounter(params.state, gacha);
  const beforeHp = encounter.mobs.map((m) => m.hp);
  const { swings, both } = combatSwings(tier);
  const dmg = swingDmg * swings;
  const targets = both
    ? encounter.mobs.map((_, i) => i)
    : [weakerIndex(encounter.mobs)];

  const killed: number[] = [];
  const mobs = encounter.mobs.map((m) => ({ hp: m.hp }));
  for (const i of targets) {
    mobs[i] = { hp: Math.max(0, mobs[i].hp - dmg) };
    if (beforeHp[i] > 0 && mobs[i].hp <= 0) killed.push(i);
  }
  encounter = { mobs };

  const materials = { ...params.state.materials };
  const drops: { material: MaterialId; amount: number }[] = [];
  const addDrop = (material: MaterialId, amount: number) => {
    if (amount <= 0) return;
    writeMaterialCount(materials, material, (materials[material] ?? 0) + amount);
    const existing = drops.find((d) => d.material === material);
    if (existing) existing.amount += amount;
    else drops.push({ material, amount });
  };

  const common = combatCommonAmount(tier);
  addDrop(combatCommonDrop(gacha), common);
  for (let n = 0; n < killed.length; n++) {
    addDrop(combatKillDrop(gacha), 1);
  }

  const breakdown: string[] = [];
  const hitReasons: string[] = [];
  if (tier === "jackpot") {
    breakdown.push("大当たり 2体に3振り");
    hitReasons.push("大当たり");
  } else if (tier === "hit") {
    breakdown.push("あたり 2体に1振り");
    hitReasons.push("あたり");
  } else {
    breakdown.push("普通 1体に1振り");
  }
  breakdown.push(`ダメージ ${dmg}`);
  if (killed.length) {
    breakdown.push(gacha === "warped_forest" ? "パールゲット！" : "棒ゲット！");
    hitReasons.push(gacha === "warped_forest" ? "エンダーパール" : "ブレイズロッド");
  }

  const next: MiningState = {
    ...params.state,
    tickets: params.state.tickets - 1,
    materials,
    equipped: { ...params.state.equipped, tool: sword },
    lastSelectedGacha: gacha,
    combatEncounters: {
      ...params.state.combatEncounters,
      [gacha]: encounter,
    },
  };

  return {
    state: next,
    drops,
    breakdown,
    hitReasons,
    ticketRefunded: false,
    usedTool: sword,
    baseCount: common,
    killed,
    swings,
    both,
    swingDamage: swingDmg,
    targets,
  };
}

export const WARPED_WART_TO_POINTS = 2;

export function exchangeWarpedWartForPoints(
  state: MiningState,
): { state: MiningState; error?: string } {
  const have = getMaterialCount(state, "warped_wart");
  if (have < 1) {
    return { state, error: "ウォートが足りないよ" };
  }
  return {
    state: {
      ...state,
      miningPoints: state.miningPoints + WARPED_WART_TO_POINTS,
      materials: (() => {
        const materials = { ...state.materials };
        writeMaterialCount(materials, "warped_wart", have - 1);
        return materials;
      })(),
    },
  };
}
